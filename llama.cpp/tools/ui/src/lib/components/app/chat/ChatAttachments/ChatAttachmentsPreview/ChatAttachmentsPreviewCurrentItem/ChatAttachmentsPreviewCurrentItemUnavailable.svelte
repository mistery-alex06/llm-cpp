<script lang="ts">
	import type { Component } from 'svelte';

	interface Props {
		IconComponent: Component;
	}

	let { IconComponent }: Props = $props();
</script>

<div class="flex flex-1 items-center justify-center p-8">
	<div class="text-center">
		<IconComponent class="mx-auto mb-4 h-16 w-16 text-white/50" />

		<p class="text-white/70">Anteprima non disponibile per questo tipo di file</p>
	</div>
</div>
