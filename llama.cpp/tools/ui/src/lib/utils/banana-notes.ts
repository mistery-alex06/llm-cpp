// Appunti rapidi di Banana. Comandi in italiano riconosciuti qui, senza passare dal modello:
//   "salva negli appunti: comprare il latte" · "annota: chiamare Marco"
//   "cosa c'è negli appunti?" · "/appunti" · "apri gli appunti"
// Gli appunti sono righe di testo in ~/Banana/workspace/appunti.md, scritte da actions_server.py
// (porta 8093): restano su disco, in chiaro, e si possono modificare anche a mano.
import { toast } from 'svelte-sonner';

const URL = 'http://127.0.0.1:8093/action';
const MAX_LEN = 500;

const SAVE_RE =
	/^\s*(?:(?:salva|segna|scrivi|aggiungi|metti|annota|appunta)\s+(?:questo\s+)?(?:negli|agli|sugli|nei)\s+appunti\b[\s:,\-–]*|(?:annota|appunta|appunti)\s*[:\-–]\s*)(.+)$/s;
const LIST_RE =
	/^\s*\/?appunti\s*\??\s*$|^\s*(?:cosa|che cosa|quali)\s.{0,40}\bappunti\s*\??\s*$|^\s*(?:mostra|elenca|vedi|leggi|fammi vedere|dimmi)\s+(?:(?:tutti\s+)?(?:gli|i miei|le mie)\s+)?(?:miei\s+)?appunti\s*$/;
const OPEN_RE = /^\s*apri\s+(?:gli\s+|i miei\s+)?appunti\s*$/;

export type NoteCommand =
	| { kind: 'save'; text: string }
	| { kind: 'list' }
	| { kind: 'open' };

/** Minuscolo e senza accenti, con la stessa lunghezza del testo originale. */
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

/** Interpreta un comando sugli appunti; esportata per i test. */
export function parseNote(content: string): NoteCommand | null {
	const orig = content.trim();
	if (!orig || orig.length > MAX_LEN + 80) return null;
	if (orig.startsWith('/') && !/^\/appunti\s*$/i.test(orig)) return null;
	const f = fold(orig);
	if (OPEN_RE.test(f)) return { kind: 'open' };
	if (LIST_RE.test(f)) return { kind: 'list' };
	const m = SAVE_RE.exec(f);
	if (!m) return null;
	// Il testo si prende dall'originale (maiuscole e accenti intatti), alla stessa posizione
	const text = orig.slice(orig.length - m[1].length).replace(/\s+/g, ' ').trim();
	if (text.length < 2) return null;
	return { kind: 'save', text: text.slice(0, MAX_LEN) };
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

/** Mostra gli ultimi appunti. */
export async function listNotes(): Promise<void> {
	const r = await call({ azione: 'appunti_elenca', n: 8 });
	if (!r.ok) return void toast.error(r.testo);
	let data: { totale: number; ultimi: string[] } = { totale: 0, ultimi: [] };
	try {
		data = JSON.parse(r.testo);
	} catch {
		/* nessun appunto */
	}
	if (!data.totale) return void toast.info('Nessun appunto: scrivi "salva negli appunti: …"');
	toast.info(`Appunti (${data.totale}${data.totale > data.ultimi.length ? `, ultimi ${data.ultimi.length}` : ''})`, {
		description: data.ultimi.join(' · '),
		duration: 20000
	});
}

/**
 * Se il messaggio è un comando sugli appunti lo esegue e restituisce true
 * (il messaggio non va inviato al modello). Altrimenti restituisce false.
 */
export async function interceptNote(content: string): Promise<boolean> {
	const p = parseNote(content);
	if (!p) return false;
	if (p.kind === 'list') {
		await listNotes();
		return true;
	}
	if (p.kind === 'open') {
		const r = await call({ azione: 'apri_file', percorso: 'appunti.md' });
		if (!r.ok) toast.error(r.testo === 'file non trovato' ? 'Non hai ancora appunti.' : r.testo);
		return true;
	}
	const r = await call({ azione: 'appunti_aggiungi', testo: p.text });
	if (r.ok) toast.success('Appunto salvato', { description: p.text, duration: 6000 });
	else toast.error(`Appunto non salvato: ${r.testo}`);
	return true;
}
