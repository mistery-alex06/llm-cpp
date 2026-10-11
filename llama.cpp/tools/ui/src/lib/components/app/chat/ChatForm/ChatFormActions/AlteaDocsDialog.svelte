<script lang="ts">
	import { Trash2, FilePlus, FileText } from '@lucide/svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	import { alteaDocs } from '$lib/utils/altea-docs.svelte';

	interface Props {
		open: boolean;
	}

	let { open = $bindable() }: Props = $props();

	let fileInput: HTMLInputElement | undefined = $state();

	async function handleFiles(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		for (const f of files) await alteaDocs.addFile(f);
		input.value = '';
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-lg">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<FileText class="h-5 w-5" />
				Documenti di Altea
			</Dialog.Title>
			<Dialog.Description>
				Carica PDF o file di testo: Altea cerca negli estratti più pertinenti a ogni domanda e cita
				file e pagina. I documenti restano nel tuo browser e non vengono inviati a nessuno.
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex items-center justify-between gap-3 py-1">
			<span class="text-sm">Usa i documenti nelle risposte</span>
			<Switch checked={alteaDocs.enabled} onCheckedChange={() => alteaDocs.toggle()} />
		</div>

		<div class="max-h-64 overflow-y-auto rounded-md border">
			{#if alteaDocs.docs.length === 0}
				<p class="p-4 text-center text-sm text-muted-foreground">Nessun documento caricato.</p>
			{:else}
				<ul class="divide-y">
					{#each alteaDocs.docs as doc (doc.id)}
						<li class="flex items-center gap-2 px-3 py-2 text-sm">
							<FileText class="h-4 w-4 shrink-0 text-muted-foreground" />
							<span class="min-w-0 flex-1 truncate" title={doc.name}>{doc.name}</span>
							<span class="shrink-0 text-xs text-muted-foreground">{doc.chunks.length} estratti</span>
							<Button
								variant="ghost"
								size="icon"
								class="h-7 w-7 shrink-0"
								title="Rimuovi"
								onclick={() => alteaDocs.remove(doc.id)}
							>
								<Trash2 class="h-4 w-4" />
							</Button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		{#if alteaDocs.error}
			<p class="text-sm text-destructive">{alteaDocs.error}</p>
		{/if}

		<input
			bind:this={fileInput}
			type="file"
			multiple
			accept=".pdf,.txt,.md,.csv,.json,.html,.tex,.log,.py,.js,.ts,.c,.cpp,.h,.java"
			class="hidden"
			onchange={handleFiles}
		/>

		<Dialog.Footer>
			<Button onclick={() => fileInput?.click()} disabled={alteaDocs.busy} class="gap-2">
				<FilePlus class="h-4 w-4" />
				{alteaDocs.busy ? 'Lettura in corso...' : 'Aggiungi documento'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
