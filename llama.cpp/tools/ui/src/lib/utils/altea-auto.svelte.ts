// Scelta automatica del modello di Altea: domande semplici -> Qwen3-1.7B (veloce),
// domande complesse -> Qwen3-4B, immagini/audio/video -> Qwen2.5-Omni.
const KEY = 'Altea.autoModel';

function loadEnabled(): boolean {
	try {
		return localStorage.getItem(KEY) === '1';
	} catch {
		return false;
	}
}

const HARD =
	/\b(codice|code|funzione|script|algoritm\w*|dimostra\w*|analizz\w*|confront\w*|spiega\w*|perch[eé]|ragion\w*|calcol\w*|equazion\w*|passo|passi|step|debug\w*|errore|bug|riassum\w*|riassunto|traduc\w*|traduci|scrivi|scrivere|progett\w*|differenza|vantaggi|svantaggi|esempio|esercizio|integrale|derivata|dimostrazione)\b/i;

export type AutoTarget = 'fast' | 'smart' | 'omni';

class AlteaAuto {
	enabled = $state(loadEnabled());

	toggle(): void {
		this.enabled = !this.enabled;
		try {
			localStorage.setItem(KEY, this.enabled ? '1' : '0');
		} catch {
			/* ignore */
		}
	}

	/** Decide il livello di modello per il messaggio. */
	classify(content: string, extras: { type?: string }[] | undefined, hasContext: boolean): AutoTarget {
		if (extras?.some((e) => /image|audio|video/i.test(e.type ?? ''))) return 'omni';
		const text = content.trim();
		if (hasContext) return 'smart';
		if (text.length > 350) return 'smart';
		if (/```/.test(text) || (text.match(/\n/g)?.length ?? 0) >= 4) return 'smart';
		if (text.length > 60 && HARD.test(text)) return 'smart';
		return 'fast';
	}

	pattern(target: AutoTarget): RegExp {
		return target === 'omni' ? /omni/i : target === 'smart' ? /qwen3-4b/i : /qwen3-1\.7b/i;
	}
}

export const alteaAuto = new AlteaAuto();
