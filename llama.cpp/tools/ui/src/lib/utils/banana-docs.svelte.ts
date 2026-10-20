// Documenti locali di Banana (RAG): PDF e file di testo vengono spezzati in blocchi,
// salvati nel browser (IndexedDB) e, a ogni domanda, i blocchi più pertinenti
// (ricerca BM25 per parole chiave, senza modelli di embedding) vengono passati ad Banana.
import { convertPDFToPages } from '$lib/utils/pdf-processing';
import { readFileAsText } from '$lib/utils/text-files';

import { pushSync } from '$lib/utils/banana-sync';

const DB_NAME = 'BananaDocs';
const STORE = 'docs';
const KEY_ENABLED = 'Banana.docs';

const CHUNK_SIZE = 700;
const CHUNK_OVERLAP = 100;
const TOP_K = 4;
const MAX_CONTEXT_CHARS = 2600;

interface Chunk {
	page: number;
	text: string;
}

export interface BananaDoc {
	id: string;
	name: string;
	addedAt: number;
	chunks: Chunk[];
	/** Se presente, il documento appartiene a un progetto e lo usano solo le sue chat. */
	projectId?: string;
}

interface IndexedChunk {
	doc: BananaDoc;
	chunk: Chunk;
	tf: Map<string, number>;
	len: number;
}

const STOP = new Set(
	(
		'il lo la i gli le un uno una di a da in con su per tra fra e ed o ma se che chi cui non ' +
		'del dello della dei degli delle al allo alla ai agli alle dal dallo dalla dai dagli dalle ' +
		'nel nello nella nei negli nelle sul sullo sulla sui sugli sulle come anche più piu ' +
		'sono è era essere ho ha hanno questo questa questi queste quello quella ' +
		'the of and to in is for on with as by an at or be this that are from it'
	).split(' ')
);

export function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.split(/[^a-z0-9]+/)
		.filter((t) => t.length >= 3 && !STOP.has(t))
		.map((t) => (t.length > 6 ? t.slice(0, 6) : t)); // stemming grezzo: prefisso di 6 lettere
}

function splitChunks(pageText: string, page: number): Chunk[] {
	const text = pageText.replace(/\s+/g, ' ').trim();
	if (!text) return [];
	const out: Chunk[] = [];
	let start = 0;
	while (start < text.length) {
		let end = Math.min(start + CHUNK_SIZE, text.length);
		if (end < text.length) {
			const cut = text.lastIndexOf('. ', end);
			if (cut > start + CHUNK_SIZE / 2) end = cut + 1;
		}
		out.push({ page, text: text.slice(start, end).trim() });
		if (end >= text.length) break;
		start = Math.max(end - CHUNK_OVERLAP, start + 1);
	}
	return out;
}

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function dbAll(): Promise<BananaDoc[]> {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const req = db.transaction(STORE).objectStore(STORE).getAll();
		req.onsuccess = () => resolve(req.result as BananaDoc[]);
		req.onerror = () => reject(req.error);
	});
}

async function dbPut(doc: BananaDoc): Promise<void> {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).put(doc);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

async function dbDelete(id: string): Promise<void> {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).delete(id);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

class BananaDocs {
	docs = $state<BananaDoc[]>([]);
	enabled = $state(true);
	busy = $state(false);
	error = $state('');

	private index: IndexedChunk[] = [];
	private df = new Map<string, number>();
	private avgLen = 1;
	private pending = '';
	/** Si risolve quando i documenti sono stati caricati da IndexedDB. */
	ready: Promise<void> = Promise.resolve();

	constructor() {
		try {
			this.enabled = localStorage.getItem(KEY_ENABLED) !== '0';
		} catch {
			/* ignore */
		}
		if (typeof indexedDB !== 'undefined') {
			this.ready = dbAll()
				.then((docs) => {
					this.docs = docs.sort((a, b) => a.addedAt - b.addedAt);
					this.rebuild();
				})
				.catch(() => {
					/* ignore */
				});
		}
	}

	/** Se true, la prossima richiesta non usa la ricerca nei documenti (il testo è già nel messaggio). */
	skipNext = false;

	/** Numero di pagine (o sezioni) del documento. */
	maxPage(doc: BananaDoc): number {
		return doc.chunks.reduce((m, c) => Math.max(m, c.page), 1);
	}

	/** Testo di una pagina, ricostruito dagli estratti togliendo le sovrapposizioni. */
	private pageText(doc: BananaDoc, page: number): string {
		let out = '';
		for (const c of doc.chunks.filter((x) => x.page === page)) {
			if (!out) {
				out = c.text;
				continue;
			}
			let k = Math.min(CHUNK_OVERLAP + 60, out.length, c.text.length);
			while (k > 10 && !out.endsWith(c.text.slice(0, k))) k--;
			out += ' ' + (k > 10 ? c.text.slice(k) : c.text);
		}
		return out.trim();
	}

	/** Testo completo del documento (pagine in ordine, senza sovrapposizioni). */
	fullText(doc: BananaDoc): string {
		const last = this.maxPage(doc);
		const parts: string[] = [];
		for (let p = 1; p <= last; p++) {
			const t = this.pageText(doc, p);
			if (t) parts.push(t);
		}
		return parts.join('\n');
	}

	/** Testo da pagina `from` in poi, fino a `maxChars` caratteri (almeno una pagina). */
	studyText(
		doc: BananaDoc,
		from: number,
		maxChars = 3000
	): { text: string; from: number; to: number } {
		const last = this.maxPage(doc);
		const start = Math.min(Math.max(1, Math.floor(from) || 1), last);
		let text = '';
		let to = start;
		for (let p = start; p <= last; p++) {
			const t = this.pageText(doc, p);
			if (!t) continue;
			const block = (text ? '\n\n' : '') + (last > 1 ? `[pagina ${p}] ` : '') + t;
			if (text && text.length + block.length > maxChars) break;
			text += block;
			to = p;
			if (text.length >= maxChars) break;
		}
		if (text.length > maxChars) text = text.slice(0, maxChars).replace(/\s+\S*$/, '') + '…';
		return { text, from: start, to };
	}

	/** Documenti globali (non legati a un progetto). */
	get globalDocs(): BananaDoc[] {
		return this.docs.filter((d) => !d.projectId);
	}

	/** Documenti usabili da una chat: globali + quelli del suo progetto. */
	visibleDocs(projectId?: string): BananaDoc[] {
		return this.docs.filter((d) => !d.projectId || d.projectId === projectId);
	}

	get totalChunks(): number {
		return this.docs.reduce((n, d) => n + d.chunks.length, 0);
	}

	toggle(): void {
		this.enabled = !this.enabled;
		try {
			localStorage.setItem(KEY_ENABLED, this.enabled ? '1' : '0');
		} catch {
			/* ignore */
		}
	}

	private rebuild(): void {
		this.index = [];
		this.df = new Map();
		let total = 0;
		for (const doc of this.docs) {
			for (const chunk of doc.chunks) {
				const toks = tokenize(chunk.text);
				const tf = new Map<string, number>();
				for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
				for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
				this.index.push({ doc, chunk, tf, len: toks.length });
				total += toks.length;
			}
		}
		this.avgLen = this.index.length ? total / this.index.length : 1;
	}

	async addFile(file: File, projectId?: string): Promise<void> {
		this.busy = true;
		this.error = '';
		try {
			const pages: string[] = file.name.toLowerCase().endsWith('.pdf')
				? await convertPDFToPages(file)
				: [await readFileAsText(file)];
			const chunks = pages.flatMap((p, i) => splitChunks(p, i + 1));
			if (chunks.length === 0) {
				this.error = `Nessun testo trovato in "${file.name}" (forse è una scansione).`;
				return;
			}
			const doc: BananaDoc = {
				id: crypto.randomUUID(),
				name: file.name,
				addedAt: Date.now(),
				chunks,
				...(projectId ? { projectId } : {})
			};
			await dbPut(doc);
			this.docs = [...this.docs, doc];
			this.rebuild();
			pushSync('docs', this.exportAll());
		} catch (e) {
			this.error = `Impossibile leggere "${file.name}": ${e instanceof Error ? e.message : 'errore'}`;
		} finally {
			this.busy = false;
		}
	}

	exportAll(): BananaDoc[] {
		return $state.snapshot(this.docs) as BananaDoc[];
	}

	/** Aggiunge i documenti di un backup (salta quelli già presenti per id o nome). */
	async importAll(docs: BananaDoc[]): Promise<number> {
		let added = 0;
		for (const d of docs) {
			if (!d || typeof d.name !== 'string' || !Array.isArray(d.chunks)) continue;
			if (this.docs.some((x) => x.id === d.id || x.name === d.name)) continue;
			const doc: BananaDoc = {
				id: d.id || crypto.randomUUID(),
				name: d.name,
				addedAt: d.addedAt || Date.now(),
				...(d.projectId ? { projectId: d.projectId } : {}),
				chunks: d.chunks
					.filter((c) => c && typeof c.text === 'string')
					.map((c) => ({ page: Number(c.page) || 1, text: c.text }))
			};
			await dbPut(doc);
			this.docs = [...this.docs, doc];
			added++;
		}
		this.rebuild();
		if (added) pushSync('docs', this.exportAll());
		return added;
	}

	async remove(id: string): Promise<void> {
		await dbDelete(id);
		this.docs = this.docs.filter((d) => d.id !== id);
		this.rebuild();
		pushSync('docs', this.exportAll());
	}

	/** Sostituisce tutti i documenti con quelli ricaricati dal file (senza riscriverlo). */
	async replaceAll(docs: BananaDoc[]): Promise<void> {
		for (const d of this.docs) await dbDelete(d.id);
		for (const d of docs) await dbPut(d);
		this.docs = [...docs].sort((a, b) => a.addedAt - b.addedAt);
		this.rebuild();
	}

	/** Ricerca BM25: restituisce i blocchi più pertinenti alla domanda. */
	search(query: string, k = TOP_K, projectId?: string): IndexedChunk[] {
		const qTokens = [...new Set(tokenize(query))];
		if (qTokens.length === 0 || this.index.length === 0) return [];
		const N = this.index.length;
		const k1 = 1.4;
		const b = 0.75;
		const scored = this.index
			.filter((c) => !c.doc.projectId || c.doc.projectId === projectId)
			.map((c) => {
			let score = 0;
			for (const t of qTokens) {
				const f = c.tf.get(t);
				if (!f) continue;
				const n = this.df.get(t) ?? 0;
				const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
				score += (idf * (f * (k1 + 1))) / (f + k1 * (1 - b + (b * c.len) / this.avgLen));
			}
			return { c, score };
		});
		return scored
			.filter((s) => s.score > 0.5)
			.sort((a, b2) => b2.score - a.score)
			.slice(0, k)
			.map((s) => s.c);
	}

	/** Prepara il contesto per la prossima richiesta. */
	prepare(question: string, projectId?: string): void {
		this.pending = '';
		if (this.skipNext) {
			this.skipNext = false;
			return;
		}
		if (!this.enabled || this.visibleDocs(projectId).length === 0) return;
		const q = question.trim();
		if (q.length < 4 || q.startsWith('/')) return;
		const hits = this.search(q, TOP_K, projectId);
		if (hits.length === 0) {
			// avvisa solo se la domanda sembra riferirsi ai documenti: evita rumore nelle chat normali
			if (!/document|\bpdf\b|\bfile\b|capitol|pagin|appunti|dispens|slide|libro|testo|paragraf/i.test(q))
				return;
			this.pending =
				"\n\nL'utente ha dei documenti caricati, ma nessun estratto è pertinente a questa domanda: " +
				'se la risposta dipende dai documenti, dillo.';
			return;
		}
		let used = 0;
		const parts: string[] = [];
		hits.forEach((h, i) => {
			const text = h.chunk.text;
			if (used + text.length > MAX_CONTEXT_CHARS) return;
			used += text.length;
			parts.push(`[${i + 1}] ${h.doc.name}, pagina ${h.chunk.page}:\n${text}`);
		});
		this.pending =
			"\n\nEstratti dai documenti dell'utente:\n\n" +
			parts.join('\n\n') +
			'\n\nUsa questi estratti per rispondere e cita la fonte con nome del file e pagina, ' +
			'es. (manuale.pdf, p. 3). Se la risposta non è negli estratti, dillo senza inventare.';
	}

	consume(): string {
		const p = this.pending;
		this.pending = '';
		return p;
	}
}

export const bananaDocs = new BananaDocs();
