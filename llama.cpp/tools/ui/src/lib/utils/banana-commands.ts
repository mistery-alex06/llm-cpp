// Comandi rapidi di testo, condivisi tra la barra superiore e il menu "/".
export interface QuickCommand {
	label: string;
	text: string;
}

export const COMMANDS: QuickCommand[] = [
	{ label: 'Riassumi', text: 'Riassumi in modo conciso il seguente testo:\n\n' },
	{ label: 'Traduci', text: 'Traduci in inglese il seguente testo:\n\n' },
	{ label: 'Spiega', text: 'Spiegami in modo semplice, con un esempio: ' },
	{ label: 'Correggi', text: 'Correggi grammatica e stile del seguente testo senza cambiarne il senso:\n\n' },
	{ label: 'Quiz', text: 'Crea 5 domande di verifica a risposta multipla su: ' }
];
