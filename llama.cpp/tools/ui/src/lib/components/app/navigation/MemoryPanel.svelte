<script lang="ts">
	import { loadMemory, saveMemory } from '$lib/utils/banana-memory';

	let { onclose }: { onclose: () => void } = $props();

	let items = $state<string[]>(loadMemory());
	let draft = $state('');
	let editing = $state<number | null>(null);
	let editText = $state('');
	let confirmClear = $state(false);

	function persist() {
		saveMemory(items);
		items = loadMemory();
	}

	function add() {
		const t = draft.trim();
		if (!t) return;
		items = [...items, t];
		draft = '';
		persist();
	}

	function remove(i: number) {
		items = items.filter((_, j) => j !== i);
		persist();
	}

	function startEdit(i: number) {
		editing = i;
		editText = items[i];
	}

	function saveEdit() {
		if (editing === null) return;
		const t = editText.trim();
		items = t ? items.map((x, j) => (j === editing ? t : x)) : items.filter((_, j) => j !== editing);
		editing = null;
		persist();
	}

	function clearAll() {
		items = [];
		confirmClear = false;
		persist();
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onclick={onclose}>
	<div
		class="flex max-h-[80vh] w-full max-w-lg flex-col gap-3 rounded-xl border border-border bg-background p-4 shadow-xl"
		onclick={(e) => e.stopPropagation()}
	>
		<div class="flex items-center justify-between">
			<h2 class="text-base font-semibold">Memoria di Banana ({items.length})</h2>
			<button type="button" class="rounded px-2 py-1 text-sm hover:bg-foreground/10" onclick={onclose}>Chiudi</button>
		</div>
		<p class="text-xs text-muted-foreground">
			Fatti che Banana ricorda in tutte le chat. Modificali o eliminali quando vuoi.
		</p>

		<div class="min-h-0 flex-1 space-y-1 overflow-y-auto">
			{#each items as item, i (i)}
				<div class="flex items-start gap-2 rounded-lg border border-border px-2 py-1.5 text-sm">
					{#if editing === i}
						<input
							class="min-w-0 flex-1 rounded border border-border bg-transparent px-2 py-1"
							bind:value={editText}
							onkeydown={(e) => e.key === 'Enter' && saveEdit()}
						/>
						<button type="button" class="px-1 hover:underline" onclick={saveEdit}>Salva</button>
						<button type="button" class="px-1 text-muted-foreground hover:underline" onclick={() => (editing = null)}>Annulla</button>
					{:else}
						<span class="min-w-0 flex-1 break-words">{item}</span>
						<button type="button" class="px-1 text-muted-foreground hover:underline" onclick={() => startEdit(i)}>Modifica</button>
						<button type="button" class="px-1 text-destructive hover:underline" onclick={() => remove(i)}>Elimina</button>
					{/if}
				</div>
			{:else}
				<p class="py-4 text-center text-sm text-muted-foreground">Nessun fatto in memoria.</p>
			{/each}
		</div>

		<div class="flex gap-2">
			<input
				class="min-w-0 flex-1 rounded border border-border bg-transparent px-2 py-1 text-sm"
				placeholder="Aggiungi un fatto (es. Studio Ingegneria dell'Automazione)"
				bind:value={draft}
				onkeydown={(e) => e.key === 'Enter' && add()}
			/>
			<button type="button" class="rounded border border-border px-3 py-1 text-sm hover:bg-foreground/10" onclick={add}>Aggiungi</button>
		</div>

		{#if items.length}
			<div class="text-right text-xs">
				{#if confirmClear}
					<span class="mr-2">Cancellare tutta la memoria?</span>
					<button type="button" class="text-destructive hover:underline" onclick={clearAll}>Sì, cancella</button>
					<button type="button" class="ml-2 text-muted-foreground hover:underline" onclick={() => (confirmClear = false)}>No</button>
				{:else}
					<button type="button" class="text-muted-foreground hover:underline" onclick={() => (confirmClear = true)}>Cancella tutto</button>
				{/if}
			</div>
		{/if}
	</div>
</div>
