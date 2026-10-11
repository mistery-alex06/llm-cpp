// Ricerca nelle chat passate di Altea: se il pulsante "Storico" è attivo, a ogni domanda
// Altea cerca (BM25 per parole chiave, tutto in locale) nelle altre conversazioni salvate
// e passa al modello i messaggi più pertinenti, citando il titolo della chat.
import { DatabaseService } from '$lib/services/database.service';
import { tokenize } from '$lib/utils/altea-docs.svelte';

const KEY = 'Altea.history';
const REBUILD_MS = 45_000;
const CHUNK = 600;
const MAX_CHARS_PER_MESSAGE = 2400;
const TOP_K = 3;
const SNIPPET = 380;

interface Entry {
	convId: string;
	title: string;
	role: string;
	time: number;
	text: string;
	tf: Map<string, number>;
	len: number;
}

function loadEnabled(): boolean {
	try {
		return localStorage.getItem(KEY) === '1';
	} catch {
		return false;
	}
}

class AlteaHistory {
	enabled = $state(loadEnabled());
	private index: Entry[] = [];
	private df = new Map<string, number>();
	private avgLen = 1;
	private builtAt = 0;
	private building: Promise<void> | null = null;
	private pending = '';

	toggle(): void {
		this.enabled = !this.enabled;
		try {
			localStorage.setItem(KEY, this.enabled ? '1' : '0');
		} catch {
			/* ignore */
		}
		if (this.enabled) void this.ensureIndex();
	}

	private async build(): Promise<void> {
		const convs = await DatabaseService.getAllConversations();
		const data = await DatabaseService.getConversationsWithMessages(convs.map((c) => c.id));
		const index: Entry[] = [];
		const df = new Map<string, number>();
		let total = 0;
		for (const { conv, messages } of data.values()) {
			for (const m of messages) {
				if (m.role !== 'user' && m.role !== 'assistant') continue;
				const raw = (m.content || '').replace(/\s+/g, ' ').trim();
				if (raw.length < 12 || raw.startsWith('/')) continue;
				const text = raw.slice(0, MAX_CHARS_PER_MESSAGE);
				for (let i = 0; i < text.length; i += CHUNK) {
					const piece = text.slice(i, i + CHUNK);
					const toks = tokenize(piece);
					if (toks.length < 2) continue;
					const tf = new Map<string, number>();
					for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
					for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
					index.push({
						convId: conv.id,
						title: conv.name,
						role: m.role,
						time: m.timestamp,
						text: piece,
						tf,
						len: toks.length
					});
					total += toks.length;
				}
			}
		}
		this.index = index;
		this.df = df;
		this.avgLen = index.length ? total / index.length : 1;
		this.builtAt = Date.now();
	}

	private ensureIndex(): Promise<void> {
		if (Date.now() - this.builtAt < REBUILD_MS && this.index.length) return Promise.resolve();
		if (!this.building) {
			this.building = this.build()
				.catch(() => {
					/* ignore */
				})
				.finally(() => {
					this.building = null;
				});
		}
		return this.building;
	}

	private search(query: string, excludeConvId?: string): Entry[] {
		const q = [...new Set(tokenize(query))];
		if (q.length === 0 || this.index.length === 0) return [];
		const N = this.index.length;
		const k1 = 1.4;
		const b = 0.75;
		const scored: { e: Entry; score: number }[] = [];
		for (const e of this.index) {
			if (e.convId === excludeConvId) continue;
			let score = 0;
			let hits = 0;
			for (const t of q) {
				const f = e.tf.get(t);
				if (!f) continue;
				hits++;
				const n = this.df.get(t) ?? 0;
				const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
				score += (idf * (f * (k1 + 1))) / (f + k1 * (1 - b + (b * e.len) / this.avgLen));
			}
			// serve almeno una corrispondenza forte o due parole in comune: meno rumore
			if (score > 2.2 || (hits >= 2 && score > 1.2)) scored.push({ e, score });
		}
		scored.sort((a, c) => c.score - a.score);
		// al massimo un estratto per conversazione
		const seen = new Set<string>();
		const out: Entry[] = [];
		for (const s of scored) {
			if (seen.has(s.e.convId)) continue;
			seen.add(s.e.convId);
			out.push(s.e);
			if (out.length >= TOP_K) break;
		}
		return out;
	}

	/** Prepara il contesto per la prossima richiesta. */
	async prepare(question: string, currentConvId?: string): Promise<void> {
		this.pending = '';
		if (!this.enabled) return;
		const q = question.trim();
		if (q.length < 8 || q.startsWith('/')) return;
		await this.ensureIndex();
		const hits = this.search(q, currentConvId);
		if (hits.length === 0) return;
		const parts = hits.map((h, i) => {
			const date = new Date(h.time).toLocaleDateString('it-IT');
			const who = h.role === 'user' ? "l'utente" : 'Altea';
			const snip = h.text.length > SNIPPET ? h.text.slice(0, SNIPPET) + '…' : h.text;
			return `[${i + 1}] Chat «${h.title}» (${date}), ${who}: ${snip}`;
		});
		this.pending =
			"\n\nDalle conversazioni passate con l'utente (usale solo se pertinenti alla domanda; " +
			'se le usi, cita il titolo della chat):\n\n' +
			parts.join('\n\n');
	}

	consume(): string {
		const p = this.pending;
		this.pending = '';
		return p;
	}
}

export const alteaHistory = new AlteaHistory();
