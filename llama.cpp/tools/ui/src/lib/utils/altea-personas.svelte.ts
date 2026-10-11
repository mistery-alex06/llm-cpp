// Ruoli di Altea: cambiano il modo di rispondere aggiungendo un'istruzione al prompt di sistema.
const KEY = 'Altea.persona';

export interface AlteaPersona {
	id: string;
	name: string;
	prompt: string;
}

export const PERSONAS: AlteaPersona[] = [
	{ id: 'altea', name: 'Altea', prompt: '' },
	{
		id: 'tutor',
		name: 'Tutor Polimi',
		prompt:
			"Agisci da tutor universitario di Ingegneria al Politecnico di Milano: spiega passo passo con formule ed esempi, poi verifica la comprensione con una breve domanda finale."
	},
	{
		id: 'codice',
		name: 'Revisore di codice',
		prompt:
			'Agisci da revisore di codice: individua bug, problemi di sicurezza e miglioramenti, spiega il perché e proponi correzioni concise.'
	},
	{
		id: 'traduttore',
		name: 'Traduttore',
		prompt:
			"Agisci da traduttore: traduci il testo dell'utente tra italiano e inglese (nella lingua opposta a quella del testo), senza commenti, mantenendo tono e formattazione."
	},
	{
		id: 'sintetico',
		name: 'Ultra-sintetico',
		prompt: 'Rispondi in modo ultra-conciso: al massimo 3 frasi o 5 punti elenco.'
	}
];

function load(): string {
	try {
		const v = localStorage.getItem(KEY) || 'altea';
		return PERSONAS.some((p) => p.id === v) ? v : 'altea';
	} catch {
		return 'altea';
	}
}

class AlteaPersonas {
	id = $state(typeof localStorage !== 'undefined' ? load() : 'altea');

	set(id: string): void {
		if (!PERSONAS.some((p) => p.id === id)) return;
		this.id = id;
		try {
			localStorage.setItem(KEY, id);
		} catch {
			/* ignore */
		}
	}

	/** Testo da aggiungere al prompt di sistema (vuoto per il ruolo predefinito). */
	prompt(): string {
		const p = PERSONAS.find((x) => x.id === this.id);
		return p && p.prompt ? `\n\nRuolo: ${p.prompt}` : '';
	}
}

export const alteaPersonas = new AlteaPersonas();
