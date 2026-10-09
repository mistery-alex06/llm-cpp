// Memoria persistente di Altea: elenco di fatti salvati nel browser (localStorage)
// e iniettati come system prompt in ogni conversazione.
const KEY = 'Altea.memory';
const MAX_ITEMS = 50;

export function loadMemory(): string[] {
	try {
		const v = JSON.parse(localStorage.getItem(KEY) || '[]');
		return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
	} catch {
		return [];
	}
}

export function saveMemory(items: string[]): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(items.slice(-MAX_ITEMS)));
	} catch {
		/* ignore */
	}
}

export function memorySystemPrompt(): string {
	const items = loadMemory();
	if (items.length === 0) return '';
	return (
		'Informazioni che ricordi sull\'utente (memoria persistente, usale quando pertinenti):\n' +
		items.map((m) => `- ${m}`).join('\n')
	);
}

/**
 * Gestisce i comandi di memoria. Ritorna il testo da inviare al modello al posto
 * del comando, oppure null se il messaggio non è un comando.
 */
export function handleMemoryCommand(text: string): string | null {
	const t = text.trim();
	const m = t.match(/^\/(ricorda|dimentica|memoria)\b\s*(.*)$/is);
	if (!m) return null;
	const cmd = m[1].toLowerCase();
	const arg = m[2].trim();
	const items = loadMemory();

	if (cmd === 'ricorda') {
		if (!arg) return 'Usa: /ricorda <informazione da memorizzare>.';
		items.push(arg);
		saveMemory(items);
		return `/no_think Ho salvato nella tua memoria: "${arg}". Conferma in una frase breve.`;
	}
	if (cmd === 'dimentica') {
		if (/^(tutto|all)$/i.test(arg)) {
			saveMemory([]);
			return '/no_think Ho cancellato tutta la tua memoria. Conferma in una frase breve.';
		}
		const n = parseInt(arg, 10);
		if (!n || n < 1 || n > items.length)
			return '/no_think Spiega brevemente: uso /dimentica <numero> oppure /dimentica tutto (vedi i numeri con /memoria).';
		const [removed] = items.splice(n - 1, 1);
		saveMemory(items);
		return `/no_think Ho cancellato dalla memoria: "${removed}". Conferma in una frase breve.`;
	}
	// memoria
	if (items.length === 0)
		return '/no_think Dì brevemente che al momento non hai nulla in memoria sull\'utente.';
	return (
		'/no_think Elenca esattamente, in lista numerata e senza aggiungere altro, ciò che hai in memoria:\n' +
		items.map((x, i) => `${i + 1}. ${x}`).join('\n')
	);
}

// --- Memoria automatica ---
// Filtro economico: l'estrazione via LLM parte solo se il messaggio sembra contenere info personali.
const PERSONAL_RE =
	/\b(mi chiamo|il mio nome|sono (un|una|uno|di|nato|nata|studente)|ho \d+ anni|ho (un|una|due|tre)|mi piace|mi piacciono|non mi piace|preferisco|adoro|odio|studio|lavoro|vivo|abito|uso|il mio|la mia|i miei|le mie|sto (facendo|costruendo|imparando)|ricordati|ricorda che|d'ora in poi|sempre)\b/i;

export function looksPersonal(text: string): boolean {
	const t = text.trim();
	return t.length >= 12 && !t.startsWith('/') && PERSONAL_RE.test(t);
}

export const EXTRACT_PROMPT = (msg: string) =>
	`/no_think Dal seguente messaggio di un utente estrai SOLO fatti personali duraturi su di lui (nome, studi, lavoro, progetti, preferenze, abitudini, istruzioni su come rispondergli). Scrivi ogni fatto come frase breve e autonoma, una per riga, senza elenchi o numeri. Ignora domande, richieste temporanee e informazioni generiche. Se non c'è nessun fatto duraturo rispondi solo: NESSUNO\n\nEsempio\nMessaggio: "Mi chiamo Marco, studio medicina e mi piace il tennis. Cos'è un integrale?"\nFatti:\nL'utente si chiama Marco.\nL'utente studia medicina.\nL'utente ama il tennis.\n\nEsempio\nMessaggio: "Che tempo fa a Roma?"\nFatti:\nNESSUNO\n\nOra tocca a te.\nMessaggio: "${msg}"\nFatti:`;

export function addExtractedFacts(raw: string): void {
	const items = loadMemory();
	const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9àèéìòù ]/g, '').trim();
	let changed = false;
	for (let line of raw.split('\n')) {
		line = line.replace(/^[-*•\d.)\s]+/, '').trim();
		if (line.length < 5 || line.length > 200 || /^nessun/i.test(line) || /non indicat|non specificat|n\/a/i.test(line) || /<think>/i.test(line))
			continue;
		if (items.some((x) => norm(x) === norm(line))) continue;
		items.push(line);
		changed = true;
	}
	if (changed) saveMemory(items);
}
