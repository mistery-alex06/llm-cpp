// Documenti locali di Altea (RAG): PDF e file di testo vengono spezzati in blocchi,
// salvati nel browser (IndexedDB) e, a ogni domanda, i blocchi più pertinenti
// (ricerca BM25 per parole chiave, senza modelli di embedding) vengono passati ad Altea.
import { convertPDFToPages } from '$lib/utils/pdf-processing';
import { readFileAsText } from '$lib/utils/text-files';

const DB_NAME = 'AlteaDocs';
const STORE = 'docs';
const KEY_ENABLED = 'Altea.docs';

const CHUNK_SIZE = 700;
const CHUNK_OVERLAP = 100;
const TOP_K = 4;
const MAX_CONTEXT_CHARS = 2600;

interface Chunk {
	page: number;
	text: string;
}

export interface AlteaDoc {
	id: string;
	name: string;
	addedAt: number;
	chunks: Chunk[];
	/** Se presente, il documento appartiene a un progetto e lo usano solo le sue chat. */
	projectId?: string;
}

interface IndexedChunk {
	doc: AlteaDoc;
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

function tokenize(text: string): string[] {
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

async function dbAll(): Promise<AlteaDoc[]> {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const req = db.transaction(STORE).objectStore(STORE).getAll();
		req.onsuccess = () => resolve(req.result as AlteaDoc[]);
		req.onerror = () => reject(req.error);
	});
}

async function dbPut(doc: AlteaDoc): Promise<void> {
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

class AlteaDocs {
	docs = $state<AlteaDoc[]>([]);
	enabled = $state(true);
	busy = $state(false);
	error = $state('');

	private index: IndexedChunk[] = [];
	private df = new Map<string, number>();
	private avgLen = 1;
	private pending = '';

	constructor() {
		try {
			this.enabled = localStorage.getItem(KEY_ENABLED) !== '0';
		} catch {
			/* ignore */
		}
		if (typeof indexedDB !== 'undefined') {
			dbAll()
				.then((docs) => {
					this.docs = docs.sort((a, b) => a.addedAt - b.addedAt);
					this.rebuild();
				})
				.catch(() => {
					/* ignore */
				});
		}
	}

	/** Documenti globali (non legati a un progetto). */
	get globalDocs(): AlteaDoc[] {
		return this.docs.filter((d) => !d.projectId);
	}

	/** Documenti usabili da una chat: globali + quelli del suo progetto. */
	visibleDocs(projectId?: string): AlteaDoc[] {
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
			const doc: AlteaDoc = {
				id: crypto.randomUUID(),
				name: file.name,
				addedAt: Date.now(),
				chunks,
				...(projectId ? { projectId } : {})
			};
			await dbPut(doc);
			this.docs = [...this.docs, doc];
			this.rebuild();
		} catch (e) {
			this.error = `Impossibile leggere "${file.name}": ${e instanceof Error ? e.message : 'errore'}`;
		} finally {
			this.busy = false;
		}
	}

	exportAll(): AlteaDoc[] {
		return $state.snapshot(this.docs) as AlteaDoc[];
	}

	/** Aggiunge i documenti di un backup (salta quelli già presenti per id o nome). */
	async importAll(docs: AlteaDoc[]): Promise<number> {
		let added = 0;
		for (const d of docs) {
			if (!d || typeof d.name !== 'string' || !Array.isArray(d.chunks)) continue;
			if (this.docs.some((x) => x.id === d.id || x.name === d.name)) continue;
			const doc: AlteaDoc = {
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
		return added;
	}

	async remove(id: string): Promise<void> {
		await dbDelete(id);
		this.docs = this.docs.filter((d) => d.id !== id);
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

export const alteaDocs = new AlteaDocs();
