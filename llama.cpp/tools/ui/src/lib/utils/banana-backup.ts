// Backup di Banana: memoria + documenti (RAG) in un unico file JSON.
// Le conversazioni hanno già il loro export/import (ZIP/JSONL) nella stessa pagina.
import { loadMemory, saveMemory } from '$lib/utils/banana-memory';
import { bananaDocs, type BananaDoc } from '$lib/utils/banana-docs.svelte';
import { bananaProjects, type BananaProject } from '$lib/utils/banana-projects.svelte';

interface BananaBackup {
	app: 'banana';
	version: 1;
	exportedAt: string;
	memory: string[];
	docs: BananaDoc[];
	projects?: BananaProject[];
}

export function exportBananaBackup(): { memory: number; docs: number; projects: number } {
	const data: BananaBackup = {
		app: 'banana',
		version: 1,
		exportedAt: new Date().toISOString(),
		memory: loadMemory(),
		docs: bananaDocs.exportAll(),
		projects: bananaProjects.exportAll()
	};
	const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `banana_backup_${new Date().toISOString().split('T')[0]}.json`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
	return { memory: data.memory.length, docs: data.docs.length, projects: data.projects?.length ?? 0 };
}

export async function importBananaBackup(file: File): Promise<{ memory: number; docs: number; projects: number }> {
	let data: Partial<BananaBackup>;
	try {
		data = JSON.parse(await file.text());
	} catch {
		throw new Error('File non valido');
	}
	if (data.app !== 'banana' || !Array.isArray(data.memory) || !Array.isArray(data.docs)) {
		throw new Error('Non è un backup di Banana');
	}
	// Memoria: unisce senza duplicati.
	const current = loadMemory();
	const seen = new Set(current.map((m) => m.trim().toLowerCase()));
	let addedMemory = 0;
	for (const m of data.memory) {
		if (typeof m !== 'string' || !m.trim()) continue;
		const k = m.trim().toLowerCase();
		if (seen.has(k)) continue;
		seen.add(k);
		current.push(m.trim());
		addedMemory++;
	}
	saveMemory(current);
	const addedDocs = await bananaDocs.importAll(data.docs);
	const addedProjects = Array.isArray(data.projects) ? bananaProjects.importAll(data.projects) : 0;
	return { memory: addedMemory, docs: addedDocs, projects: addedProjects };
}
