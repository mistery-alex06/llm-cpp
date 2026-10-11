<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { FileX } from '@lucide/svelte';

	interface Props {
		open: boolean;
		emptyFiles: string[];
		onOpenChange?: (open: boolean) => void;
	}

	let { open = $bindable(), emptyFiles, onOpenChange }: Props = $props();

	function handleOpenChange(newOpen: boolean) {
		open = newOpen;
		onOpenChange?.(newOpen);
	}
</script>

<AlertDialog.Root {open} onOpenChange={handleOpenChange}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title class="flex items-center gap-2">
				<FileX class="h-5 w-5 text-destructive" />

				Rilevati file vuoti
			</AlertDialog.Title>

			<AlertDialog.Description>
				I seguenti file sono vuoti e sono stati rimossi dagli allegati:
			</AlertDialog.Description>
		</AlertDialog.Header>

		<div class="space-y-3 text-sm">
			<div class="rounded-lg bg-muted p-3">
				<div class="mb-2 font-medium">Empty Files:</div>

				<ul class="list-inside list-disc space-y-1 text-muted-foreground">
					{#each emptyFiles as fileName (fileName)}
						<li class="font-mono text-sm">{fileName}</li>
					{/each}
				</ul>
			</div>

			<div>
				<div class="mb-2 font-medium">Cos'è successo:</div>

				<ul class="list-inside list-disc space-y-1 text-muted-foreground">
					<li>I file vuoti non possono essere elaborati né inviati al modello</li>

					<li>Questi file sono stati rimossi automaticamente dagli allegati</li>

					<li>Prova a caricare file con contenuto</li>
				</ul>
			</div>
		</div>

		<AlertDialog.Footer>
			<AlertDialog.Action onclick={() => handleOpenChange(false)}>Ho capito</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
