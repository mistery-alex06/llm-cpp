// Esportazione di una chat in Markdown: solo le domande dell'utente e le risposte di Altea,
// senza metadati, ragionamento, allegati o altri elementi dell'interfaccia.
interface Msg {
	role: string;
	content?: string;
}

function clean(text: string): string {
	return (text || '')
		.replace(/<think>[\s\S]*?(<\/think>|$)/gi, '') // ragionamento eventualmente incluso nel testo
		.replace(/\r\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

export function chatToMarkdown(title: string, messages: Msg[]): string {
	const parts: string[] = [];
	const name = clean(title).replace(/\s+/g, ' ');
	if (name) parts.push(`# ${name}`);
	for (const m of messages) {
		if (m.role !== 'user' && m.role !== 'assistant') continue;
		const text = clean(m.content ?? '');
		if (!text) continue;
		parts.push(m.role === 'user' ? `## Domanda\n\n${text}` : `## Risposta\n\n${text}`);
	}
	return parts.join('\n\n') + '\n';
}

function fileName(title: string): string {
	const base =
		(title || 'chat')
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/[^a-zA-Z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '')
			.slice(0, 50) || 'chat';
	return `${base}_${new Date().toISOString().split('T')[0]}.md`;
}

/** Scarica la chat come file .md. Ritorna false se non c'è nulla da esportare. */
export function exportChatMarkdown(title: string, messages: Msg[]): boolean {
	const md = chatToMarkdown(title, messages);
	if (!messages.some((m) => (m.role === 'user' || m.role === 'assistant') && clean(m.content ?? ''))) {
		return false;
	}
	const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' }));
	const a = document.createElement('a');
	a.href = url;
	a.download = fileName(title);
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
	return true;
}
