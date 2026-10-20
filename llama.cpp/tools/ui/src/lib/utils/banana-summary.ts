// Riassunto di testi lunghi (pagine web e documenti) per Banana.
// Il contesto del modello è piccolo (4096 token), quindi il testo viene diviso in blocchi:
// ogni blocco è riassunto a parte (passo "map", richiesta diretta al server) e i riassunti
// parziali vengono uniti in un prompt finale, che la chat risponde in streaming.
import { toast } from 'svelte-sonner';
import { modelsStore } from '$lib/stores/models.svelte';
import { convertPDFToPages } from '$lib/utils/pdf-processing';

const SEARCH_URL = 'http://127.0.0.1:8091';
const CHUNK_CHARS = 2800;
const MAX_CHUNKS = 6;

const URL_RE = /https?:\/\/[^\s<>"')\]]+/i;
const ASK_RE = /^\s*(riassum\w*|riassunto|sintetizz\w*|riepilog\w*|fammi un riassunto|summari[sz]e)\b/i;

export interface SummaryResult {
	/** Prompt finale da inviare alla chat (con i riassunti parziali). */
	prompt?: string;
	/** True se l'operazione è fallita o annullata: il messaggio non va inviato. */
	abort?: boolean;
}

/** Divide il testo in blocchi di circa `size` caratteri, spezzando sui ritorni a capo. */
export function splitForSummary(text: string, size = CHUNK_CHARS): string[] {
	const chunks: string[] = [];
	let cur = '';
	for (const line of text.split('\n')) {
		const piece = line.length > size ? line.match(new RegExp(`.{1,${size}}`, 'g')) ?? [] : [line];
		for (const p of piece) {
			if (cur && cur.length + p.length + 1 > size) {
				chunks.push(cur);
				cur = '';
			}
			cur += (cur ? '\n' : '') + p;
		}
	}
	if (cur.trim()) chunks.push(cur);
	return chunks;
}

/** Richiesta diretta (senza streaming) al modello, fuori dalla chat. */
async function complete(prompt: string, maxTokens: number): Promise<string> {
	const body: Record<string, unknown> = {
		stream: false,
		max_tokens: maxTokens,
		temperature: 0.3,
		messages: [
			{
				role: 'system',
				content:
					'Sei un assistente che riassume testi in italiano. Rispondi solo con il riassunto richiesto, senza introduzioni.'
			},
			{ role: 'user', content: prompt }
		]
	};
	const model = modelsStore.selectedModelName;
	if (model) body.model = model;
	const r = await fetch('./v1/chat/completions', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(300000)
	});
	if (!r.ok) throw new Error(`server ${r.status}`);
	const j = await r.json();
	return String(j?.choices?.[0]?.message?.content ?? '')
		.replace(/<think>[\s\S]*?<\/think>/g, '')
		.trim();
}

/** Riassume `text` a blocchi e restituisce il prompt finale. */
export async function summarizeText(title: string, text: string): Promise<SummaryResult> {
	const all = splitForSummary(text);
	const truncated = all.length > MAX_CHUNKS;
	const chunks = all.slice(0, MAX_CHUNKS);
	const note = truncated
		? `\n\n(Il testo è lungo: ho riassunto solo la parte iniziale, circa ${chunks.length * CHUNK_CHARS} caratteri su ${text.length}. Dillo all'utente alla fine.)`
		: '';
	const label = title ? `"${title.slice(0, 120)}"` : 'il testo';

	if (chunks.length <= 1) {
		return {
			prompt:
				`Riassumi in modo chiaro e conciso, in italiano e con punti elenco, ${label}.${note}\n\n` +
				chunks[0]
		};
	}

	const id = toast.loading(`Riassunto: parte 1/${chunks.length}…`, { duration: Infinity });
	const partials: string[] = [];
	try {
		for (let i = 0; i < chunks.length; i++) {
			toast.loading(`Riassunto: parte ${i + 1}/${chunks.length}…`, { id, duration: Infinity });
			const s = await complete(
				`Riassumi in massimo 3 punti elenco brevi (15 parole ciascuno) i fatti importanti di questa parte (${i + 1} di ${chunks.length}) di ${label}:\n\n${chunks[i]}`,
				140
			);
			if (s) partials.push(`Parte ${i + 1}:\n${s}`);
		}
	} catch (e) {
		toast.error(`Riassunto non riuscito: ${e instanceof Error ? e.message : 'errore'}`, { id });
		return { abort: true };
	}
	toast.dismiss(id);
	if (partials.length === 0) {
		toast.error('Riassunto non riuscito: nessuna risposta dal modello');
		return { abort: true };
	}
	return {
		prompt:
			`Scrivi un riassunto finale chiaro e ben organizzato, in italiano, di ${label}: un titolo e al massimo 8 punti elenco. ` +
			`Usa solo questi riassunti parziali, in ordine.${note}\n\n` +
			partials.join('\n\n')
	};
}

/** Riassunto di un PDF online: il servizio locale lo scarica, il testo lo estrae il browser. */
async function summarizePdfUrl(url: string): Promise<SummaryResult> {
	const id = toast.loading('Scarico il PDF…', { duration: Infinity });
	try {
		const r = await fetch(`${SEARCH_URL}/pdf?url=${encodeURIComponent(url)}`, {
			signal: AbortSignal.timeout(45000)
		});
		if (!r.ok) {
			const err = await r.json().catch(() => ({ error: '' }));
			toast.error(`PDF non leggibile: ${err.error || `errore ${r.status}`}`, { id });
			return { abort: true };
		}
		let name = 'documento.pdf';
		try {
			name = decodeURIComponent(url.split('?')[0].split('/').pop() || name);
		} catch {
			/* nome non decodificabile: uso quello di default */
		}
		const pages = await convertPDFToPages(
			new File([await r.blob()], name, { type: 'application/pdf' })
		);
		const text = pages.join('\n').trim();
		if (text.length < 200) {
			toast.error('PDF senza testo (forse una scansione): non posso leggerlo.', { id });
			return { abort: true };
		}
		toast.dismiss(id);
		return summarizeText(name, text);
	} catch {
		toast.error('Servizio web non raggiungibile o PDF non valido.', { id });
		return { abort: true };
	}
}

/** Riassunto di una pagina web: scarica il testo tramite il servizio locale e lo riassume. */
export async function summarizeUrl(url: string): Promise<SummaryResult> {
	const id = toast.loading('Scarico la pagina…', { duration: Infinity });
	let page: { title: string; text: string };
	try {
		const r = await fetch(`${SEARCH_URL}/fetch?url=${encodeURIComponent(url)}`, {
			signal: AbortSignal.timeout(25000)
		});
		if (!r.ok) {
			const err = await r.json().catch(() => ({ error: '' }));
			if (err.error === 'pdf') {
				toast.dismiss(id);
				return summarizePdfUrl(url);
			}
			toast.error(`Pagina non leggibile: ${err.error || `errore ${r.status}`}`, { id });
			return { abort: true };
		}
		page = await r.json();
	} catch {
		toast.error('Servizio web non raggiungibile (avvia Banana con lo script).', { id });
		return { abort: true };
	}
	toast.dismiss(id);
	return summarizeText(page.title || url, page.text);
}

/**
 * Se il messaggio è una richiesta breve del tipo "riassumi https://…", prepara il riassunto.
 * Restituisce null se il messaggio non è una richiesta di riassunto da URL.
 */
export async function interceptSummary(content: string): Promise<SummaryResult | null> {
	const text = content.trim();
	if (text.length > 400 || !ASK_RE.test(text)) return null;
	const m = text.match(URL_RE);
	if (!m) return null;
	return summarizeUrl(m[0]);
}

interface TextExtra {
	type?: string;
	name?: string;
	content?: string;
}

/**
 * "Riassumi" con file di testo o PDF allegati alla chat: riassume il loro testo e toglie gli
 * allegati dal messaggio (altrimenti riempirebbero il contesto da 4096 token).
 * Restituisce null se non è una richiesta di riassunto o non ci sono allegati leggibili.
 */
export async function interceptAttachmentSummary(
	content: string,
	extras: unknown[] | undefined
): Promise<(SummaryResult & { rest?: unknown[] }) | null> {
	const text = content.trim();
	if (!extras?.length || text.length > 400 || !ASK_RE.test(text) || URL_RE.test(text)) return null;
	const docs = (extras as TextExtra[]).filter(
		(e) => (e.type === 'TEXT' || e.type === 'PDF') && (e.content ?? '').trim().length >= 50
	);
	if (!docs.length) return null;
	const rest = (extras as TextExtra[]).filter((e) => !docs.includes(e));
	const title = docs.map((d) => d.name ?? 'documento').join(', ');
	const joined = docs.map((d) => d.content!.trim()).join('\n\n');
	const res = await summarizeText(title, joined);
	return { ...res, rest };
}
