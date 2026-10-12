<script lang="ts">
	import { onMount } from 'svelte';
	import { alteaTheme, THEMES, FONT_SIZES } from '$lib/utils/altea-theme.svelte';

	let open = $state(false);
	let root: HTMLDivElement | undefined = $state();

	onMount(() => {
		alteaTheme.init();
		const onDown = (e: MouseEvent) => {
			if (open && root && !root.contains(e.target as Node)) open = false;
		};
		document.addEventListener('mousedown', onDown);
		return () => document.removeEventListener('mousedown', onDown);
	});
</script>

<div class="relative" bind:this={root}>
	<button
		type="button"
		class="rounded-full px-2 py-1 text-foreground hover:bg-foreground/10"
		title="Tema e dimensione del testo"
		onclick={() => (open = !open)}>Tema</button
	>
	{#if open}
		<div
			class="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-border bg-background p-3 text-sm shadow-xl"
		>
			<div class="mb-1 text-xs text-muted-foreground">Tema</div>
			<div class="grid grid-cols-2 gap-1.5">
				{#each THEMES as t (t.id)}
					<button
						type="button"
						class="flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left hover:bg-foreground/10 {alteaTheme.themeId === t.id
							? 'border-foreground/60'
							: 'border-border'}"
						onclick={() => alteaTheme.setTheme(t.id)}
					>
						<span
							class="inline-block h-4 w-4 shrink-0 rounded-full border border-border"
							style="background: linear-gradient(135deg, {t.swatch[0]} 50%, {t.swatch[1]} 50%)"
						></span>
						{t.name}
					</button>
				{/each}
			</div>
			<div class="mb-1 mt-3 text-xs text-muted-foreground">Dimensione del testo</div>
			<div class="flex gap-1.5">
				{#each FONT_SIZES as s (s.id)}
					<button
						type="button"
						class="flex-1 rounded-lg border px-2 py-1 hover:bg-foreground/10 {alteaTheme.sizeId === s.id
							? 'border-foreground/60'
							: 'border-border'}"
						onclick={() => alteaTheme.setSize(s.id)}>{s.name}</button
					>
				{/each}
			</div>
		</div>
	{/if}
</div>
