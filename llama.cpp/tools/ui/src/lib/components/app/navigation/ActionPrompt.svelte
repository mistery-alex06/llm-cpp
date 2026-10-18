<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { chatStore } from '$lib/stores/chat.svelte';
	import { conversationsStore } from '$lib/stores/conversations.svelte';
	import { alteaActions, type ActionRequest } from '$lib/utils/altea-actions.svelte';

	let pending = $state<{ id: string; req: ActionRequest } | null>(null);
	let busy = $state(false);
	const handled = new Set<string>();
	let wasLoading = false;

	$effect(() => {
		const loading = chatStore.isLoading;
		if (wasLoading && !loading) check();
		wasLoading = loading;
	});

	function check() {
		if (!alteaActions.enabled) return;
		const msgs = conversationsStore.activeMessages as { id: string; role: string; content?: string }[];
		const last = msgs[msgs.length - 1];
		if (!last || last.role !== 'assistant' || handled.has(last.id)) return;
		const req = alteaActions.parse(last.content ?? '');
		if (!req) return;
		handled.add(last.id);
		pending = { id: last.id, req };
	}

	async function allow() {
		if (!pending) return;
		const req = pending.req;
		busy = true;
		const r = await alteaActions.execute(req);
		busy = false;
		pending = null;
		if (!r.ok) {
			toast.error(r.testo);
			return;
		}
		if (req.azione === 'elenca_file' || req.azione === 'leggi_file') {
			// Il risultato torna ad Banana come messaggio, così può usarlo
			chatStore.sendMessage(`Risultato dell'azione ${req.azione}:\n\n${r.testo}`);
		} else {
			toast.success(r.testo);
		}
	}
</script>

{#if pending}
	<div
		class="fixed bottom-6 right-6 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-background p-4 text-sm shadow-xl"
		role="alertdialog"
	>
		<div class="mb-1 font-semibold">Banana chiede di eseguire un'azione</div>
		<p class="mb-2">{alteaActions.describe(pending.req)}</p>
		{#if pending.req.azione === 'scrivi_file'}
			<pre
				class="mb-2 max-h-40 overflow-auto rounded-lg bg-muted p-2 text-xs whitespace-pre-wrap">{(pending.req.contenuto ?? '').slice(0, 800)}{(pending.req.contenuto ?? '').length > 800 ? '\n…' : ''}</pre>
		{/if}
		<p class="mb-3 text-xs text-muted-foreground">
			Verrà eseguita solo se confermi. I file restano nella cartella di lavoro di Banana.
		</p>
		<div class="flex justify-end gap-2">
			<button type="button" class="rounded-lg border border-border px-3 py-1 hover:bg-foreground/10" onclick={() => (pending = null)}>
				Rifiuta
			</button>
			<button
				type="button"
				class="rounded-lg bg-primary px-3 py-1 text-primary-foreground hover:opacity-90 disabled:opacity-50"
				disabled={busy}
				onclick={allow}>Consenti</button
			>
		</div>
	</div>
{/if}
