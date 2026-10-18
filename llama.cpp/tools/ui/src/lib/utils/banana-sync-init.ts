// Avvio della sincronizzazione su file (vedi banana-sync.ts).
import { reconcile } from '$lib/utils/banana-sync';
import { loadMemory } from '$lib/utils/banana-memory';
import { bananaProjects } from '$lib/utils/banana-projects.svelte';
import { bananaDocs, type BananaDoc } from '$lib/utils/banana-docs.svelte';

const KEY_MEMORY = 'Banana.memory';

export async function initBananaSync(): Promise<void> {
	await bananaDocs.ready;
	await reconcile<string[]>(
		'memory',
		() => loadMemory(),
		(v) => v.length === 0,
		(data) => {
			if (!Array.isArray(data)) return;
			try {
				localStorage.setItem(KEY_MEMORY, JSON.stringify(data));
			} catch {
				/* ignore */
			}
		}
	);
	await reconcile(
		'projects',
		() => bananaProjects.exportAll(),
		(v) => v.length === 0,
		(data) => {
			if (Array.isArray(data)) bananaProjects.replaceAll(data);
		}
	);
	await reconcile<BananaDoc[]>(
		'docs',
		() => bananaDocs.exportAll(),
		(v) => v.length === 0,
		(data) => (Array.isArray(data) ? bananaDocs.replaceAll(data) : undefined)
	);
}
