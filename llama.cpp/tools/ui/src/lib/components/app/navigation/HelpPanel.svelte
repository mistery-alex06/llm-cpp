<script lang="ts">
	import { HELP } from '$lib/utils/altea-help';

	let { onclose }: { onclose: () => void } = $props();
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onclick={onclose}>
	<div
		class="flex max-h-[85vh] w-full max-w-2xl flex-col gap-3 rounded-xl border border-border bg-background p-4 shadow-xl"
		onclick={(e) => e.stopPropagation()}
	>
		<div class="flex items-center justify-between">
			<h2 class="text-base font-semibold">Guida di Banana</h2>
			<button type="button" class="rounded px-2 py-1 text-sm hover:bg-foreground/10" onclick={onclose}>Chiudi</button>
		</div>
		<div class="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1 text-sm">
			{#each HELP as section (section.title)}
				<section>
					<h3 class="mb-1.5 font-semibold">{section.title}</h3>
					<dl class="space-y-1">
						{#each section.items as item (item.name)}
							<div class="grid grid-cols-[10.5rem_1fr] gap-3">
								<dt class="font-mono text-xs text-foreground">{item.name}</dt>
								<dd class="text-muted-foreground">{item.desc}</dd>
							</div>
						{/each}
					</dl>
				</section>
			{/each}
		</div>
	</div>
</div>
