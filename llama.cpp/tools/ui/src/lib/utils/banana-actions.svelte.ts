// Azioni sul computer richieste da Banana. Il modello scrive un blocco ```azione {json}```;
// la UI lo mostra e lo esegue (tramite actions_server.py) SOLO dopo la conferma dell'utente.
const KEY = 'Banana.actions';
const URL = 'http://127.0.0.1:8093/action';

export const ACTIONS = ['elenca_file', 'leggi_file', 'scrivi_file', 'apri_file', 'apri_url'] as const;
export type ActionName = (typeof ACTIONS)[number];

export interface ActionRequest {
	azione: ActionName;
	percorso?: string;
	contenuto?: string;
	url?: string;
}

const PROMPT =
	"\n\nPuoi chiedere di eseguire azioni sul computer dell'utente, che le dovrà confermare. " +
	'Solo se l\'utente lo chiede esplicitamente, scrivi alla fine della risposta UN solo blocco in questo formato esatto:\n' +
	'```azione\n{"azione": "...", ...}\n```\n' +
	'Azioni disponibili: ' +
	'elenca_file {"percorso" (facoltativo)}; leggi_file {"percorso"}; scrivi_file {"percorso", "contenuto"}; ' +
	'apri_file {"percorso"}; apri_url {"url"}. ' +
	'I file esistono solo nella cartella di lavoro di Banana (percorsi relativi, es. "appunti/lezione1.md"). ' +
	"Non dire mai che l'azione è già stata eseguita: l'utente deve prima confermare.";

function load(): boolean {
	try {
		return localStorage.getItem(KEY) === '1';
	} catch {
		return false;
	}
}

class BananaActions {
	enabled = $state(load());

	toggle() {
		this.enabled = !this.enabled;
		try {
			localStorage.setItem(KEY, this.enabled ? '1' : '0');
		} catch {
			/* ignore */
		}
	}

	/** Istruzioni per il modello (vuote se le azioni sono disattivate). */
	prompt(): string {
		return this.enabled ? PROMPT : '';
	}

	/** Estrae la prima richiesta valida da una risposta di Banana, o null. */
	parse(text: string): ActionRequest | null {
		const m = /```azione\s*([\s\S]*?)```/.exec(text || '');
		if (!m) return null;
		try {
			const obj = JSON.parse(m[1]);
			if (!obj || !ACTIONS.includes(obj.azione)) return null;
			return obj as ActionRequest;
		} catch {
			return null;
		}
	}

	/** Descrizione leggibile per la conferma. */
	describe(r: ActionRequest): string {
		switch (r.azione) {
			case 'elenca_file':
				return `Elencare i file in «${r.percorso || 'cartella di lavoro'}»`;
			case 'leggi_file':
				return `Leggere il file «${r.percorso}»`;
			case 'scrivi_file':
				return `Scrivere il file «${r.percorso}» (sovrascrive se esiste)`;
			case 'apri_file':
				return `Aprire il file «${r.percorso}»`;
			case 'apri_url':
				return `Aprire l'indirizzo ${r.url}`;
		}
	}

	async execute(r: ActionRequest): Promise<{ ok: boolean; testo: string }> {
		try {
			const res = await fetch(URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(r)
			});
			const j = await res.json();
			return j.ok ? { ok: true, testo: j.risultato ?? '' } : { ok: false, testo: j.errore ?? 'errore' };
		} catch {
			return { ok: false, testo: 'Servizio azioni non raggiungibile (actions_server.py)' };
		}
	}
}

export const bananaActions = new BananaActions();
