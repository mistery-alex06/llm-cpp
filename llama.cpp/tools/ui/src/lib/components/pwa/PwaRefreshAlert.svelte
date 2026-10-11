<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';

	let { needRefresh: needRefreshProp, updateServiceWorker, forceReload } = $props();
	let needRefresh = $derived(needRefreshProp ?? false);
</script>

{#if needRefresh}
	<Card.Root class="overflow-hidden gap-1 py-5">
		<Card.Header class="px-5">
			<Card.Title class="text-sm font-medium">Aggiornamento disponibile</Card.Title>
		</Card.Header>

		<Card.Content class="gap-6 grid px-5">
			<p class="text-xs text-muted-foreground">È disponibile una nuova versione. Ricarica per aggiornare.</p>

			<Button
				class="justify-self-end-safe"
				size="sm"
				onclick={() => {
					updateServiceWorker();

					if (forceReload) {
						window.location.reload();
					}

					needRefresh = false;
				}}
			>
				Reload
			</Button>
		</Card.Content>
	</Card.Root>
{/if}
