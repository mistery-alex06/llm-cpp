<script lang="ts">
	import { Trash2, FilePlus, FileText, GraduationCap } from '@lucide/svelte';
	import { chatStore } from '$lib/stores/chat.svelte';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Switch } from '$lib/components/ui/switch';
	import { bananaDocs } from '$lib/utils/banana-docs.svelte';
	import { summarizeText } from '$lib/utils/banana-summary';

	interface Props {
		open: boolean;
	}

	let { open = $bindable() }: Props = $props();

	let fileInput: HTMLInputElement | undefined = $state();
	let studyId = $state<string | null>(null);
	let fromPage = $state(1);

	const MODES = {
		riassunto: {
			label: 'Riassunto',
			prompt: (n: string, a: number, b: number, t: string) =>
				`Riassumi in punti elenco chiari e concisi questo estratto degli appunti "${n}" (pagine ${a}-${b}). Evidenzia i concetti e le formule principali.\n\n${t}`
		},
		flashcard: {
			label: 'Flashcard',
			prompt: (n: string, a: number, b: number, t: string) =>
				`Crea 8 flashcard per studiare questo estratto degli appunti "${n}" (pagine ${a}-${b}). Per ognuna scrivi "D:" con la domanda e "R:" con la risposta breve, una sotto l'altra.\n\n${t}`
		},
		quiz: {
			label: 'Quiz',
			prompt: (n: string, a: number, b: number, t: string) =>
				`Crea 5 domande a risposta multipla (A, B, C, D) su questo estratto degli appunti "${n}" (pagine ${a}-${b}). Dopo ogni domanda indica la risposta corretta e una breve spiegazione.\n\n${t}`
		}
	} as const;

	function toggleStudy(id: string) {
		studyId = studyId === id ? null : id;
		fromPage = 1;
	}

	function preview(docId: string) {
		const doc = bananaDocs.docs.find((d) => d.id === docId);
		return doc ? bananaDocs.studyText(doc, fromPage) : null;
	}

	async function study(docId: string, mode: keyof typeof MODES) {
		const doc = bananaDocs.docs.find((d) => d.id === docId);
		if (!doc) return;
		const r = bananaDocs.studyText(doc, fromPage);
		if (!r.text) return;
		bananaDocs.skipNext = true;
		open = false;
		await chatStore.sendMessage(MODES[mode].prompt(doc.name, r.from, r.to, r.text));
	}

	async function fullSummary(docId: string) {
		const doc = bananaDocs.docs.find((d) => d.id === docId);
		if (!doc) return;
		open = false;
		const r = await summarizeText(doc.name, bananaDocs.fullText(doc));
		if (!r.prompt) return;
		bananaDocs.skipNext = true;
		await chatStore.sendMessage(r.prompt);
	}

	async function handleFiles(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		for (const f of files) await bananaDocs.addFile(f);
		input.value = '';
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-lg">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<FileText class="h-5 w-5" />
				Documenti di Banana
			</Dialog.Title>
			<Dialog.Description>
				Carica PDF o file di testo: Banana cerca negli estratti più pertinenti a ogni domanda e cita
				file e pagina. I documenti restano nel tuo browser e non vengono inviati a nessuno.
			</Dialog.Description>
		</Dialog.Header>

		<div class="flex items-center justify-between gap-3 py-1">
			<span class="text-sm">Usa i documenti nelle risposte</span>
			<Switch checked={bananaDocs.enabled} onCheckedChange={() => bananaDocs.toggle()} />
		</div>

		<div class="max-h-64 overflow-y-auto rounded-md border">
			{#if bananaDocs.globalDocs.length === 0}
				<p class="p-4 text-center text-sm text-muted-foreground">Nessun documento caricato.</p>
			{:else}
				<ul class="divide-y">
					{#each bananaDocs.globalDocs as doc (doc.id)}
						<li class="flex items-center gap-2 px-3 py-2 text-sm">
							<FileText class="h-4 w-4 shrink-0 text-muted-foreground" />
							<span class="min-w-0 flex-1 truncate" title={doc.name}>{doc.name}</span>
							<span class="shrink-0 text-xs text-muted-foreground">{doc.chunks.length} estratti</span>
							<Button
								variant="ghost"
								size="icon"
								class="h-7 w-7 shrink-0"
								title="Studia: riassunto, flashcard, quiz"
								onclick={() => toggleStudy(doc.id)}
							>
								<GraduationCap class="h-4 w-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								class="h-7 w-7 shrink-0"
								title="Rimuovi"
								onclick={() => bananaDocs.remove(doc.id)}
							>
								<Trash2 class="h-4 w-4" />
							</Button>
						</li>
						{#if studyId === doc.id}
							{@const pv = preview(doc.id)}
							<li class="flex flex-col gap-2 bg-muted/40 px-3 py-2 text-sm">
								<div class="flex items-center gap-2">
									<label for="sp-{doc.id}" class="text-xs text-muted-foreground">Da pagina</label>
									<input
										id="sp-{doc.id}"
										type="number"
										min="1"
										max={bananaDocs.maxPage(doc)}
										bind:value={fromPage}
										class="w-16 rounded-md border bg-background px-2 py-1 text-xs"
									/>
									<span class="text-xs text-muted-foreground">
										di {bananaDocs.maxPage(doc)}{pv && pv.text ? ` · userà le pagine ${pv.from}-${pv.to}` : ''}
									</span>
								</div>
								<div class="flex flex-wrap gap-2">
									<Button size="sm" onclick={() => fullSummary(doc.id)}>Riassunto completo</Button>
									{#each Object.entries(MODES) as [key, m] (key)}
										<Button
											size="sm"
											variant="secondary"
											onclick={() => study(doc.id, key as keyof typeof MODES)}>{m.label}</Button
										>
									{/each}
								</div>
								<p class="text-xs text-muted-foreground">
									"Riassunto completo" legge il documento a blocchi (più lento, fino a ~17.000 caratteri). Gli altri
									pulsanti usano una parte alla volta (circa 3000 caratteri): per continuare, imposta la pagina successiva.
								</p>
							</li>
						{/if}
					{/each}
				</ul>
			{/if}
		</div>

		{#if bananaDocs.error}
			<p class="text-sm text-destructive">{bananaDocs.error}</p>
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
			<Button onclick={() => fileInput?.click()} disabled={bananaDocs.busy} class="gap-2">
				<FilePlus class="h-4 w-4" />
				{bananaDocs.busy ? 'Lettura in corso...' : 'Aggiungi documento'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
