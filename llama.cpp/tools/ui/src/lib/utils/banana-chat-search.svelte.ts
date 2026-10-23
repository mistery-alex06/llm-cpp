// Ricerca nelle chat dalla barra laterale: oltre ai titoli cerca dentro i messaggi (tutte le parole
// scritte devono comparire nella conversazione, senza distinguere maiuscole e accenti) e permette di
// limitare i risultati per data dell'ultima modifica. Tutto in locale: l'indice è in memoria e si
// ricostruisce dal database del browser quando si apre la ricerca.
import { DatabaseService } from '$lib/services/database.service';

export type DateRange = 'all' | 'today' | '7' | '30';

export const DATE_RANGES: { id: DateRange; label: string }[] = [
	{ id: 'all', label: 'Tutte' },
	{ id: 'today', label: 'Oggi' },
	{ id: '7', label: '7 giorni' },
	{ id: '30', label: '30 giorni' }
];

const REBUILD_MS = 30_000;
const DAY_MS = 86_400_000;

interface Msg {
	text: string;
	norm: string;
}

interface ConvIndex {
	msgs: Msg[];
	all: string;
}

/** Minuscolo e senza accenti, ma con la stessa lunghezza (gli indici valgono sul testo originale). */
export function fold(s: string): string {
	return s
		.toLowerCase()
		.replace(/[àáâä]/g, 'a')
		.replace(/[èéêë]/g, 'e')
		.replace(/[ìíîï]/g, 'i')
		.replace(/[òóôö]/g, 'o')
		.replace(/[ùúûü]/g, 'u');
}

/** Parole della ricerca (almeno 2 lettere). */
export function searchWords(query: string): string[] {
	return [...new Set(fold(query).split(/\s+/).filter((w) => w.length >= 2))];
}

/** Estratto di `text` attorno alla posizione `at` di una parola lunga `len`. */
export function makeSnippet(text: string, at: number, len: number): string {
	const start = Math.max(0, at - 40);
	const end = Math.min(text.length, at + len + 90);
	return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

class BananaChatSearch {
	range = $state<DateRange>('all');
	/** Cambia a ogni ricostruzione dell'indice, per far riscrivere i risultati. */
	version = $state(0);
	private index = new Map<string, ConvIndex>();
	private builtAt = 0;
	private building: Promise<void> | null = null;

	private async build(): Promise<void> {
		const convs = await DatabaseService.getAllConversations();
		const data = await DatabaseService.getConversationsWithMessages(convs.map((c) => c.id));
		const index = new Map<string, ConvIndex>();
		for (const { conv, messages } of data.values()) {
			const msgs: Msg[] = [];
			for (const m of messages) {
				if (m.role !== 'user' && m.role !== 'assistant') continue;
				const text = (m.content || '').replace(/\s+/g, ' ').trim();
				if (text) msgs.push({ text, norm: fold(text) });
			}
			index.set(conv.id, { msgs, all: msgs.map((m) => m.norm).join('\n') });
		}
		this.index = index;
		this.builtAt = Date.now();
		this.version++;
	}

	/** Prepara l'indice (se è vecchio o vuoto lo ricostruisce). */
	ensure(): Promise<void> {
		if (Date.now() - this.builtAt < REBUILD_MS && this.index.size) return Promise.resolve();
		if (!this.building) {
			this.building = this.build()
				.catch(() => {
					/* ricerca solo sui titoli */
				})
				.finally(() => {
					this.building = null;
				});
		}
		return this.building;
	}

	/** Estratto del primo messaggio che contiene la prima parola, se la chat contiene tutte le parole. */
	find(query: string, convId: string): string | null {
		const words = searchWords(query);
		const c = this.index.get(convId);
		if (!words.length || !c || !words.every((w) => c.all.includes(w))) return null;
		const m = c.msgs.find((x) => x.norm.includes(words[0])) ?? c.msgs[0];
		return makeSnippet(m.text, Math.max(0, m.norm.indexOf(words[0])), words[0].length);
	}

	/** True se la data (ms) rientra nell'intervallo scelto. */
	inRange(ts: number): boolean {
		if (this.range === 'all') return true;
		const now = new Date();
		const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
		const min = this.range === 'today' ? startOfToday : Date.now() - Number(this.range) * DAY_MS;
		return ts >= min;
	}
}

export const chatSearch = new BananaChatSearch();
