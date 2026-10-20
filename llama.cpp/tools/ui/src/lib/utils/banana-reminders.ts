// Timer e promemoria di Banana. I comandi in italiano ("ricordami tra 20 minuti di chiamare
// Marco", "timer 10 minuti", "ricordami domani alle 9 di ...", "sveglia alle 7:30") sono
// riconosciuti qui, senza passare dal modello (che sbaglierebbe orari e calcoli). L'elenco è
// tenuto da actions_server.py (porta 8093), che a scadenza manda notifica, suono e voce anche
// se la scheda del browser è chiusa.
import { toast } from 'svelte-sonner';

const URL = 'http://127.0.0.1:8093/action';
const MAX_SECONDS = 366 * 86400;

const NUM_WORDS: Record<string, number> = {
	un: 1, uno: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8,
	nove: 9, dieci: 10, undici: 11, dodici: 12, quindici: 15, venti: 20, venticinque: 25,
	trenta: 30, quaranta: 40, quarantacinque: 45, cinquanta: 50, sessanta: 60
};
const WEEKDAYS = ['domenica', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato'];

const UNIT =
	"(?:\\d+(?:[.,]\\d+)?|[a-z']+)\\s*(?:second\\w*|minut\\w*|or[ae]\\b|giorn\\w*|settiman\\w*|min\\b|sec\\b)";
const DUR = `(?:un quarto d'ora|mezz'?\\s?ora|mezza ora|${UNIT}(?:(?:\\s+e\\s+|\\s*,\\s*|\\s+)(?:${UNIT}|mezz[oa]\\b))*)`;
const REL_RE = new RegExp(`\\b(?:tra|fra)\\s+(${DUR})`);
const DUR_RE = new RegExp(`(${DUR})`);

const TIMER_RE =
	/^\s*(?:(?:imposta|metti|avvia|attiva|fai partire|programma|crea)\s+)?(?:un\s+|il\s+|uno\s+)?timer\b[\s:,]*/;
const REMIND_RE =
	/^\s*(?:(?:imposta|metti|crea|aggiungi|programma)\s+(?:un\s+|una\s+)?)?(ricordami|avvisami|avvertimi|promemoria|svegliami|sveglia)\b[\s:,]*/;
const LIST_RE =
	/^\s*\/?(?:i miei\s+)?(?:promemoria|timer|sveglie)\s*\??\s*$|^\s*(?:quali|mostra|elenca|vedi|fammi vedere|dimmi)\b.*\b(?:promemoria|timer|sveglie)\b/;
const CANCEL_RE =
	/^\s*(?:annulla|cancella|elimina|togli|ferma|disattiva)\s+(?:tutt[ie]\s+)?(?:(?:i|il|le|la|gli)\s+)?(?:miei\s+|mie\s+)?(?:promemoria|timer|sveglie|sveglia)\b/;
const DAY_RE =
	/\b(oggi|domani|dopodomani|stasera|questa sera|stamattina|stamani|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b(?:\s+(?:prossimo|prossima))?/;
const TIME_RE =
	/\b(?:alle ore|alle|all'|verso le|per le|a(?=\s*mezz))\s*(\d{1,2}|una|mezzogiorno|mezzanotte)\b(?:\s*[:.]\s*(\d{2})|\s+e\s+(mezza|mezzo|un quarto|\d{2})\b|\s+meno\s+un\s+quarto\b)?(?:\s+(?:di|del|della)\s+(mattina|mattino|pomeriggio|sera|notte)\b)?/;

/** Minuscolo e senza accenti, ma con la stessa lunghezza (gli indici valgono sul testo originale). */
function fold(s: string): string {
	return s
		.toLowerCase()
		.replace(/[’`´]/g, "'")
		.replace(/[àá]/g, 'a')
		.replace(/[èé]/g, 'e')
		.replace(/[ìí]/g, 'i')
		.replace(/[òó]/g, 'o')
		.replace(/[ùú]/g, 'u');
}

function durSeconds(d: string): number {
	if (/quarto d'ora/.test(d)) return 900;
	if (/^mezz/.test(d)) return 1800;
	let total = 0;
	let last = 0;
	for (const m of d.matchAll(
		/(\d+(?:[.,]\d+)?|[a-z']+)\s*(second\w*|minut\w*|or[ae]\b|giorn\w*|settiman\w*|min\b|sec\b)/g
	)) {
		const tok = m[1].replace(/'$/, '');
		const n = /^\d/.test(tok) ? parseFloat(tok.replace(',', '.')) : NUM_WORDS[tok];
		if (n === undefined) continue;
		const u = m[2];
		const mult = u.startsWith('s') && u !== 'settimana' && !u.startsWith('sett') ? 1
			: u.startsWith('sett') ? 604800
			: u.startsWith('m') ? 60
			: u.startsWith('o') ? 3600
			: 86400;
		last = n * mult;
		total += last;
	}
	if (/\bmezz[oa]\s*$/.test(d)) total += last / 2;
	return total;
}

type Range = [number, number];

/** Toglie dal testo originale gli intervalli già interpretati e ripulisce il resto. */
function leftover(original: string, ranges: Range[]): string {
	let out = '';
	let pos = 0;
	for (const [a, b] of ranges.sort((x, y) => x[0] - y[0])) {
		if (a < pos) continue;
		out += original.slice(pos, a) + ' ';
		pos = b;
	}
	out += original.slice(pos);
	out = out.replace(/\s+/g, ' ').trim();
	let prev = '';
	while (prev !== out) {
		prev = out;
		out = out
			.replace(/^(?:[,:;.\-–]|\s|di\b|che\b|per\b|a\b|ad\b|dammi\b)+/i, '')
			.replace(/(?:[,:;\-–\s]+|\s(?:di|alle|per|a|e))+$/i, '')
			.trim();
	}
	return out ? out[0].toUpperCase() + out.slice(1) : '';
}

export type Parsed =
	| { kind: 'add'; when: number; message: string; title: string; note?: string }
	| { kind: 'list' }
	| { kind: 'cancel' }
	| { kind: 'past' };

/** Interpreta un comando; esportata per i test. */
export function parseReminder(content: string): Parsed | null {
	const orig = content.trim();
	if (!orig || orig.length > 300 || orig.startsWith('/') && !/^\/(promemoria|timer)\s*$/i.test(orig)) {
		return null;
	}
	const f = fold(orig);
	if (CANCEL_RE.test(f)) return { kind: 'cancel' };
	if (LIST_RE.test(f)) return { kind: 'list' };
	const now = Date.now();

	const tm = TIMER_RE.exec(f);
	if (tm) {
		const dm = DUR_RE.exec(f.slice(tm[0].length));
		if (!dm) return null;
		const sec = durSeconds(dm[1]);
		if (sec < 1 || sec > MAX_SECONDS) return null;
		const start = tm[0].length + dm.index;
		const label = leftover(orig, [[0, tm[0].length], [start, start + dm[0].length]]);
		return {
			kind: 'add',
			when: now + sec * 1000,
			message: label ? `Timer scaduto: ${label}` : 'Timer scaduto',
			title: 'Timer impostato'
		};
	}

	const rm = REMIND_RE.exec(f);
	if (!rm) return null;
	const isAlarm = rm[1].startsWith('sveglia');
	const ranges: Range[] = [[0, rm[0].length]];
	const body = f.slice(rm[0].length);
	const off = rm[0].length;

	let when: number;
	let note: string | undefined;
	const rel = REL_RE.exec(body);
	if (rel) {
		const sec = durSeconds(rel[1]);
		if (sec < 1 || sec > MAX_SECONDS) return null;
		when = now + sec * 1000;
		ranges.push([off + rel.index, off + rel.index + rel[0].length]);
	} else {
		const dm = DAY_RE.exec(body);
		const tmx = TIME_RE.exec(body);
		if (!dm && !tmx) return null;
		let h: number;
		let min = 0;
		if (tmx) {
			const tok = tmx[1];
			h = tok === 'mezzogiorno' ? 12 : tok === 'mezzanotte' ? 0 : tok === 'una' ? 1 : parseInt(tok, 10);
			if (tmx[2]) min = parseInt(tmx[2], 10);
			else if (tmx[3]) {
				min = tmx[3] === 'mezza' || tmx[3] === 'mezzo' ? 30 : tmx[3] === 'un quarto' ? 15 : parseInt(tmx[3], 10);
			} else if (/meno\s+un\s+quarto/.test(tmx[0])) {
				h -= 1;
				min = 45;
			}
			const part = tmx[4] ?? '';
			const evening = /pomeriggio|sera/.test(part) || (dm && /sera/.test(dm[1]));
			if (evening && h < 12) h += 12;
			if (h < 0 || h > 24 || min > 59) return null;
			ranges.push([off + tmx.index, off + tmx.index + tmx[0].length]);
		} else {
			// Solo il giorno: 21:00 per "stasera", altrimenti 09:00
			const w = dm![1];
			if (w === 'oggi' || w === 'stamattina' || w === 'stamani') return null;
			h = /sera/.test(w) ? 21 : 9;
			note = `ora non indicata: ${String(h).padStart(2, '0')}:00`;
		}
		const d = new Date(now);
		d.setHours(h, min, 0, 0);
		let past = false;
		if (dm) {
			ranges.push([off + dm.index, off + dm.index + dm[0].length]);
			const w = dm[1];
			let add = 0;
			if (w === 'domani') add = 1;
			else if (w === 'dopodomani') add = 2;
			else if (WEEKDAYS.includes(w)) {
				add = (WEEKDAYS.indexOf(w) - d.getDay() + 7) % 7;
				if (add === 0 && d.getTime() <= now) add = 7;
			}
			d.setDate(d.getDate() + add);
			past = add === 0 && d.getTime() <= now;
		} else if (d.getTime() <= now) {
			d.setDate(d.getDate() + 1); // orario già passato oggi: domani
		}
		if (past) return { kind: 'past' };
		when = d.getTime();
		// "dopo le X" non esiste: tutto il resto è il testo
	}
	const text = leftover(orig, ranges);
	const fallback = isAlarm ? 'Sveglia!' : '';
	return {
		kind: 'add',
		when,
		message: text ? `Promemoria: ${text}` : fallback || 'Promemoria',
		title: isAlarm ? 'Sveglia impostata' : 'Promemoria impostato',
		note
	};
}

function hhmm(d: Date): string {
	return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

/** Es. "oggi alle 11:42 (tra 20 min)" oppure "ven 23/10 alle 09:00". */
function describeWhen(ms: number): string {
	const d = new Date(ms);
	const now = new Date();
	const days = Math.round(
		(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
			new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
			86400000
	);
	const day =
		days === 0
			? 'oggi'
			: days === 1
				? 'domani'
				: d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' });
	const diff = Math.max(0, Math.round((ms - Date.now()) / 1000));
	const h = Math.floor(diff / 3600);
	const m = Math.floor((diff % 3600) / 60);
	const rel =
		diff < 60 ? `tra ${diff} s` : diff < 3600 ? `tra ${Math.round(diff / 60)} min` : diff < 86400 ? `tra ${h} h${m ? ` ${m} min` : ''}` : '';
	return `${day} alle ${hhmm(d)}${rel ? ` (${rel})` : ''}`;
}

async function call(body: Record<string, unknown>): Promise<{ ok: boolean; testo: string }> {
	try {
		const res = await fetch(URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(8000)
		});
		const j = await res.json();
		return j.ok ? { ok: true, testo: j.risultato ?? '' } : { ok: false, testo: j.errore ?? 'errore' };
	} catch {
		return { ok: false, testo: 'Servizio non raggiungibile: avvia Banana con lo script (actions_server.py).' };
	}
}

/** Mostra i promemoria e i timer attivi. */
export async function listReminders(): Promise<void> {
	const r = await call({ azione: 'promemoria_elenca' });
	if (!r.ok) return void toast.error(r.testo);
	let items: { t: number; testo: string }[] = [];
	try {
		items = JSON.parse(r.testo);
	} catch {
		/* elenco vuoto */
	}
	if (!items.length) return void toast.info('Nessun promemoria o timer attivo');
	toast.info(`${items.length} attiv${items.length === 1 ? 'o' : 'i'}`, {
		description: items
			.map((i) => `${describeWhen(i.t * 1000)}: ${i.testo || 'Timer'}`)
			.join(' · '),
		duration: 15000
	});
}

/**
 * Se il messaggio è un comando di timer/promemoria lo esegue e restituisce true
 * (il messaggio non va inviato al modello). Altrimenti restituisce false.
 */
export async function interceptReminder(content: string): Promise<boolean> {
	const p = parseReminder(content);
	if (!p) return false;
	if (p.kind === 'list') {
		await listReminders();
		return true;
	}
	if (p.kind === 'cancel') {
		const r = await call({ azione: 'promemoria_annulla', id: 'tutti' });
		if (r.ok) toast.success(`Annullati ${r.testo} tra promemoria e timer`);
		else toast.error(r.testo);
		return true;
	}
	if (p.kind === 'past') {
		toast.error("L'orario è già passato: indica un orario futuro o \"domani\".");
		return true;
	}
	const r = await call({ azione: 'promemoria_aggiungi', quando: p.when / 1000, testo: p.message });
	if (!r.ok) {
		toast.error(`Non impostato: ${r.testo}`);
		return true;
	}
	toast.success(p.title, {
		description: `${describeWhen(p.when)} · ${p.message}${p.note ? ` (${p.note})` : ''}`,
		duration: 8000
	});
	return true;
}
