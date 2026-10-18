// Progetti di Banana: raggruppano più chat sullo stesso argomento.
// Ogni progetto ha istruzioni e una memoria propria, iniettate nel prompt di tutte le sue chat,
// insieme all'elenco delle altre chat del progetto (così le conversazioni restano collegate).
import { pushSync } from '$lib/utils/banana-sync';

const KEY = 'Banana.projects';
const KEY_OPEN = 'Banana.projectsSidebar';
const MAX_MEMORY = 50;

export interface BananaProject {
	id: string;
	name: string;
	instructions: string;
	memory: string[];
	chatIds: string[];
	createdAt: number;
}

function load(): BananaProject[] {
	try {
		const v = JSON.parse(localStorage.getItem(KEY) || '[]');
		if (!Array.isArray(v)) return [];
		return v
			.filter((p) => p && typeof p.id === 'string' && typeof p.name === 'string')
			.map((p) => ({
				id: p.id,
				name: p.name,
				instructions: typeof p.instructions === 'string' ? p.instructions : '',
				memory: Array.isArray(p.memory) ? p.memory.filter((m: unknown) => typeof m === 'string') : [],
				chatIds: Array.isArray(p.chatIds) ? p.chatIds.filter((c: unknown) => typeof c === 'string') : [],
				createdAt: Number(p.createdAt) || Date.now()
			}));
	} catch {
		return [];
	}
}

class BananaProjects {
	projects = $state<BananaProject[]>(typeof localStorage !== 'undefined' ? load() : []);
	sidebarOpen = $state(false);
	/** Progetto in cui verrà creata la prossima nuova chat. */
	pendingProjectId = $state<string | null>(null);
	/** Risolutore dei nomi delle chat (impostato dalla barra laterale). */
	chatNameOf: (id: string) => string | undefined = () => undefined;

	constructor() {
		try {
			this.sidebarOpen = localStorage.getItem(KEY_OPEN) === '1';
		} catch {
			/* ignore */
		}
	}

	private save(): void {
		try {
			localStorage.setItem(KEY, JSON.stringify($state.snapshot(this.projects)));
		} catch {
			/* ignore */
		}
		pushSync('projects', $state.snapshot(this.projects));
	}

	/** Sostituisce i progetti con quelli ricaricati dal file (senza riscriverlo). */
	replaceAll(items: BananaProject[]): void {
		this.projects = items;
		try {
			localStorage.setItem(KEY, JSON.stringify(items));
		} catch {
			/* ignore */
		}
	}

	toggleSidebar(): void {
		this.sidebarOpen = !this.sidebarOpen;
		try {
			localStorage.setItem(KEY_OPEN, this.sidebarOpen ? '1' : '0');
		} catch {
			/* ignore */
		}
	}

	create(name: string): BananaProject | null {
		const n = name.trim();
		if (!n) return null;
		const p: BananaProject = {
			id: crypto.randomUUID(),
			name: n,
			instructions: '',
			memory: [],
			chatIds: [],
			createdAt: Date.now()
		};
		this.projects = [...this.projects, p];
		this.save();
		return p;
	}

	rename(id: string, name: string): void {
		const p = this.projects.find((x) => x.id === id);
		if (!p || !name.trim()) return;
		p.name = name.trim();
		this.save();
	}

	setInstructions(id: string, text: string): void {
		const p = this.projects.find((x) => x.id === id);
		if (!p) return;
		p.instructions = text;
		this.save();
	}

	addMemory(id: string, fact: string): void {
		const p = this.projects.find((x) => x.id === id);
		const f = fact.trim();
		if (!p || !f || p.memory.includes(f)) return;
		p.memory = [...p.memory, f].slice(-MAX_MEMORY);
		this.save();
	}

	removeMemory(id: string, index: number): void {
		const p = this.projects.find((x) => x.id === id);
		if (!p) return;
		p.memory = p.memory.filter((_, i) => i !== index);
		this.save();
	}

	remove(id: string): void {
		this.projects = this.projects.filter((p) => p.id !== id);
		if (this.pendingProjectId === id) this.pendingProjectId = null;
		this.save();
	}

	projectOf(chatId: string | undefined | null): BananaProject | undefined {
		if (!chatId) return undefined;
		return this.projects.find((p) => p.chatIds.includes(chatId));
	}

	/** Mette la chat nel progetto (una chat appartiene a un solo progetto). */
	assign(projectId: string, chatId: string): void {
		for (const p of this.projects) p.chatIds = p.chatIds.filter((c) => c !== chatId);
		const p = this.projects.find((x) => x.id === projectId);
		if (p) p.chatIds = [...p.chatIds, chatId];
		this.save();
	}

	unassign(chatId: string): void {
		for (const p of this.projects) p.chatIds = p.chatIds.filter((c) => c !== chatId);
		this.save();
	}

	/** Chiamata alla creazione di una chat: la collega al progetto in attesa. */
	assignPending(chatId: string): void {
		if (!this.pendingProjectId) return;
		this.assign(this.pendingProjectId, chatId);
		this.pendingProjectId = null;
	}

	/** Pulisce i riferimenti a chat eliminate. */
	forget(chatId: string): void {
		this.unassign(chatId);
	}

	exportAll(): BananaProject[] {
		return $state.snapshot(this.projects) as BananaProject[];
	}

	importAll(items: BananaProject[]): number {
		let added = 0;
		for (const p of items) {
			if (!p || typeof p.name !== 'string' || this.projects.some((x) => x.id === p.id)) continue;
			this.projects = [
				...this.projects,
				{
					id: p.id || crypto.randomUUID(),
					name: p.name,
					instructions: p.instructions || '',
					memory: Array.isArray(p.memory) ? p.memory : [],
					chatIds: Array.isArray(p.chatIds) ? p.chatIds : [],
					createdAt: p.createdAt || Date.now()
				}
			];
			added++;
		}
		if (added) this.save();
		return added;
	}

	/** Aggiunge alla memoria del progetto i fatti estratti dal modello (una riga per fatto). */
	addExtractedFacts(projectId: string, raw: string): void {
		const p = this.projects.find((x) => x.id === projectId);
		if (!p) return;
		const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9àèéìòù ]/g, '').trim();
		let changed = false;
		for (let line of raw.split('\n')) {
			line = line.replace(/^[-*•\d.)\s]+/, '').trim();
			if (
				line.length < 8 ||
				line.length > 220 ||
				/^nessun/i.test(line) ||
				/non indicat|non specificat|n\/a|<think>/i.test(line)
			)
				continue;
			if (p.memory.some((x) => norm(x) === norm(line))) continue;
			p.memory = [...p.memory, line].slice(-MAX_MEMORY);
			changed = true;
		}
		if (changed) this.save();
	}

	/** Testo da aggiungere al prompt di sistema per le chat di un progetto. */
	promptFor(chatId: string | undefined): string {
		const chatNames = this.chatNameOf;
		const p = this.projectOf(chatId);
		if (!p) return '';
		let out = `\n\nStai lavorando nel progetto "${p.name}". Resta coerente con questo argomento.`;
		if (p.instructions.trim()) out += `\nIstruzioni del progetto: ${p.instructions.trim()}`;
		if (p.memory.length) out += `\nMemoria del progetto:\n` + p.memory.map((m) => `- ${m}`).join('\n');
		const others = p.chatIds
			.filter((c) => c !== chatId)
			.map((c) => chatNames(c))
			.filter((n): n is string => Boolean(n))
			.slice(-10);
		if (others.length) out += `\nAltre conversazioni dello stesso progetto: ${others.join('; ')}.`;
		return out;
	}
}

export const bananaProjects = new BananaProjects();
