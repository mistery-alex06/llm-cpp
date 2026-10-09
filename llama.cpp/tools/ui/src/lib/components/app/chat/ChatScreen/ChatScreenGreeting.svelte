<script lang="ts">
	import { serverStore } from '$lib/stores/server.svelte';

	interface Props {
		isEmpty: boolean;
	}

	let { isEmpty = false }: Props = $props();
</script>

<div
	class={[
		'pointer-events-none mb-4 hidden px-4 text-center text-balance',
		isEmpty && 'mb-[calc(50dvh-8rem)] md:mb-8 pointer-events-auto block!'
	]}
>
	<h1 class="mb-2 text-2xl font-semibold tracking-tight md:text-3xl">Sono Altea, come posso aiutarti?</h1>

	<p class="text-muted-foreground md:text-lg">
		{serverStore.props?.modalities?.audio
			? 'Registra un audio, scrivi un messaggio'
			: 'Scrivi un messaggio'} o carica dei file per iniziare
	</p>
</div>
