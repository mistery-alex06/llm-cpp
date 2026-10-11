// Avvio della sincronizzazione su file (vedi altea-sync.ts).
import { reconcile } from '$lib/utils/altea-sync';
import { loadMemory } from '$lib/utils/altea-memory';
import { alteaProjects } from '$lib/utils/altea-projects.svelte';
import { alteaDocs, type AlteaDoc } from '$lib/utils/altea-docs.svelte';

const KEY_MEMORY = 'Altea.memory';

export async function initAlteaSync(): Promise<void> {
	await alteaDocs.ready;
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
		() => alteaProjects.exportAll(),
		(v) => v.length === 0,
		(data) => {
			if (Array.isArray(data)) alteaProjects.replaceAll(data);
		}
	);
	await reconcile<AlteaDoc[]>(
		'docs',
		() => alteaDocs.exportAll(),
		(v) => v.length === 0,
		(data) => (Array.isArray(data) ? alteaDocs.replaceAll(data) : undefined)
	);
}
