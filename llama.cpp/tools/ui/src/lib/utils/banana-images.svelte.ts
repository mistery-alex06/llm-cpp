// Modelli per creare immagini di Banana (Stable Diffusion, solo CPU), sullo stesso piano dei modelli
// di testo: si scelgono a mano dall'elenco dei modelli (sezione "Immagini") oppure, con "Auto"
// attivo, li sceglie Banana quando chiedi un disegno ("disegna un gatto astronauta", "genera
// un'immagine di…", "/immagine …"). Il lavoro lo fa il servizio locale servers/image_server.py
// (porta 8094), che usa stable-diffusion.cpp; le immagini restano in ~/Banana/image/out.
const SERVICE = 'http://127.0.0.1:8094';
const STALE_MS = 30_000;

export interface ImageModel {
	id: string;
	name: string;
	desc: string;
}

export const IMAGE_MODELS: ImageModel[] = [
	{ id: 'sd-turbo', name: 'SD-Turbo', desc: 'Veloce (circa 2 minuti)' },
	{ id: 'sd15', name: 'Stable Diffusion 1.5', desc: 'Più curato, molto più lento' }
];

/** Richieste di disegno riconosciute da "Auto" (o dopo "/immagine"). */
const DRAW_START = /^\s*(?:disegna|disegnami|dipingi|dipingimi|illustra|illustrami)\b\s*\S/i;
const DRAW_ASK =
	/^\s*(?:genera|generami|crea|creami|fammi|fai|realizza|produci|voglio|vorrei|puoi|potresti|mi fai|mi generi|mi crei|mi disegni)\b[^.?!\n]{0,40}\b(?:un'?\s*immagine|delle immagini|un'?\s*foto|una foto|un disegno|un'?\s*illustrazione|un dipinto|un quadro|un logo|uno sfondo|un wallpaper|un poster|un ritratto)\b/i;
const SLASH = /^\s*\/immagine\b\s*/i;
const QUALITY =
	/\b(realistic\w*|fotorealistic\w*|foto-?realistic\w*|dettagliat\w*|alta qualit\w*|di qualit[aà]|curat\w*|professionale)\b/i;

class BananaImages {
	/** Modello immagine scelto a mano (resta attivo finché non scegli un modello di testo). */
	selected = $state<string | null>(null);
	/** Modelli installati (dal servizio). */
	available = $state<Record<string, boolean>>({});
	/** True se il servizio risponde. */
	online = $state(false);
	private checkedAt = 0;

	get installed(): ImageModel[] {
		return IMAGE_MODELS.filter((m) => this.available[m.id]);
	}

	get active(): ImageModel | null {
		return IMAGE_MODELS.find((m) => m.id === this.selected) ?? null;
	}

	select(id: string): void {
		this.selected = IMAGE_MODELS.some((m) => m.id === id) ? id : null;
	}

	clear(): void {
		this.selected = null;
	}

	/** Controlla quali modelli sono installati (al massimo ogni 30 s, salvo `force`). */
	async refresh(force = false): Promise<void> {
		if (!force && Date.now() - this.checkedAt < STALE_MS) return;
		this.checkedAt = Date.now();
		try {
			const r = await fetch(`${SERVICE}/health`, { signal: AbortSignal.timeout(2500) });
			const j = await r.json();
			this.available = j.modelli ?? {};
			this.online = true;
		} catch {
			this.available = {};
			this.online = false;
		}
	}

	/** Se il messaggio chiede un disegno, restituisce l'id del modello da usare (altrimenti null). */
	async pick(content: string, hasExtras: boolean, auto: boolean): Promise<string | null> {
		const text = content.trim();
		if (!text || hasExtras) return null;
		const slash = SLASH.test(text);
		if (text.startsWith('/') && !slash) return null;
		await this.refresh();
		if (this.installed.length === 0) return null;
		if (this.selected && this.available[this.selected]) return this.selected;
		if (!slash && !(auto && (DRAW_START.test(text) || DRAW_ASK.test(text)))) return null;
		const want = QUALITY.test(text) ? 'sd15' : 'sd-turbo';
		return this.available[want] ? want : this.installed[0].id;
	}

	/** Testo della richiesta senza il comando "/immagine". */
	cleanPrompt(content: string): string {
		return content.replace(SLASH, '').trim();
	}

	/**
	 * Fa disegnare l'immagine e restituisce l'indirizzo. `onStatus` riceve lo stato corrente.
	 * `shouldStop` permette di interrompere l'attesa (il servizio finisce comunque il lavoro in corso).
	 */
	async draw(
		prompt: string,
		model: string,
		onStatus: (text: string) => void,
		shouldStop: () => boolean
	): Promise<{ url: string; promptEn: string } | null> {
		onStatus('Preparo il disegno…');
		const r = await fetch(`${SERVICE}/generate`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ prompt, modello: model }),
			signal: AbortSignal.timeout(10000)
		});
		const start = await r.json();
		if (!r.ok || !start.id) throw new Error(start.errore || `errore ${r.status}`);
		const label: Record<string, string> = {
			coda: 'In coda…',
			traduzione: 'Traduco la richiesta in inglese…',
			scarico: 'Libero la memoria dai modelli di testo…',
			caricamento: 'Carico il modello di immagini…'
		};
		for (;;) {
			if (shouldStop()) return null;
			await new Promise((res) => setTimeout(res, 1500));
			const jr = await fetch(`${SERVICE}/job/${start.id}`, { signal: AbortSignal.timeout(8000) });
			const job = await jr.json();
			if (!jr.ok) throw new Error(job.errore || `errore ${jr.status}`);
			if (job.stato === 'errore') throw new Error(job.errore || 'disegno non riuscito');
			if (job.stato === 'pronto') {
				return { url: `${SERVICE}/image/${job.file}`, promptEn: job.prompt_en || '' };
			}
			onStatus(
				job.stato === 'disegno'
					? `Disegno… passaggio ${job.passo}/${job.passi}`
					: (label[job.stato] ?? 'Lavoro in corso…')
			);
		}
	}
}

export const bananaImages = new BananaImages();
