// Ricerca web di Altea: se attiva, prima di ogni domanda cerca sul web (servizio locale
// search_server.py, porta 8091) e passa al modello i risultati come contesto.
const KEY = 'Altea.webSearch';
const SEARCH_URL = 'http://127.0.0.1:8091';

function loadEnabled(): boolean {
	try {
		return localStorage.getItem(KEY) === '1';
	} catch {
		return false;
	}
}

class AlteaWeb {
	enabled = $state(loadEnabled());
	/** Contesto da iniettare nella prossima richiesta (consumato una sola volta). */
	private pending = '';

	toggle(): void {
		this.enabled = !this.enabled;
		try {
			localStorage.setItem(KEY, this.enabled ? '1' : '0');
		} catch {
			/* ignore */
		}
	}

	/** Esegue la ricerca per la domanda dell'utente e prepara il contesto. */
	async prepare(question: string): Promise<void> {
		this.pending = '';
		if (!this.enabled) return;
		const q = question.trim().replace(/\s+/g, ' ').slice(0, 200);
		if (!q || q.startsWith('/')) return;
		try {
			const r = await fetch(`${SEARCH_URL}/search?q=${encodeURIComponent(q)}&n=5`, {
				signal: AbortSignal.timeout(12000)
			});
			if (!r.ok) throw new Error(String(r.status));
			const results: { title: string; url: string; snippet: string }[] = await r.json();
			if (!results.length) {
				this.pending = '\n\nHai provato a cercare sul web ma senza risultati: dillo all\'utente.';
				return;
			}
			const today = new Date().toLocaleDateString('it-IT', {
				weekday: 'long',
				day: 'numeric',
				month: 'long',
				year: 'numeric'
			});
			const lines = results.map(
				(x, i) => `[${i + 1}] ${x.title.slice(0, 120)} - ${x.snippet.slice(0, 220)} (${x.url})`
			);
			this.pending =
				`\n\nOggi è ${today}. Risultati di una ricerca web per "${q}":\n` +
				lines.join('\n') +
				'\nUsa questi risultati per rispondere in modo aggiornato e cita le fonti con [1], [2]. ' +
				'Alla fine scrivi "Fonti:" con gli indirizzi che hai usato. Se i risultati non bastano, dillo.';
		} catch {
			this.pending =
				"\n\nLa ricerca web non è riuscita (servizio non raggiungibile): dillo all'utente e rispondi con ciò che sai, avvisando che potrebbe essere superato.";
		}
	}

	consume(): string {
		const p = this.pending;
		this.pending = '';
		return p;
	}
}

export const alteaWeb = new AlteaWeb();
