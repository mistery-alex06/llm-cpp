<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		FolderKanban,
		Plus,
		Trash2,
		Pencil,
		ChevronRight,
		ChevronDown,
		X,
		PanelRightClose
	} from '@lucide/svelte';
	import { alteaProjects } from '$lib/utils/altea-projects.svelte';
	import { conversations } from '$lib/stores/conversations.svelte';
	import { RouterService } from '$lib/services/router.service';
	import { ROUTES } from '$lib/constants';

	let currentChatId = $derived(page.params.id);
	let newName = $state('');
	let creating = $state(false);
	let openIds = $state<string[]>([]);
	let editId = $state<string | null>(null);
	let pickerId = $state<string | null>(null);
	let renameDraft = $state('');
	let factDraft = $state('');
	let innerWidth = $state(0);

	// Se si apre una chat esistente, la "nuova chat nel progetto" in attesa decade.
	$effect(() => {
		if (currentChatId) alteaProjects.pendingProjectId = null;
	});

	function chatName(id: string): string | undefined {
		return conversations().find((c: { id: string; name: string }) => c.id === id)?.name;
	}

	alteaProjects.chatNameOf = chatName;

	function isOpen(id: string) {
		return openIds.includes(id);
	}

	function toggleOpen(id: string) {
		openIds = isOpen(id) ? openIds.filter((x) => x !== id) : [...openIds, id];
	}

	function createProject() {
		const p = alteaProjects.create(newName);
		newName = '';
		creating = false;
		if (p) openIds = [...openIds, p.id];
	}

	async function newChatIn(projectId: string) {
		alteaProjects.pendingProjectId = projectId;
		if (!isOpen(projectId)) openIds = [...openIds, projectId];
		await goto(ROUTES.NEW_CHAT);
	}

	function togglePicker(id: string) {
		pickerId = pickerId === id ? null : id;
		if (pickerId && !isOpen(id)) openIds = [...openIds, id];
	}

	function addExisting(projectId: string, chatId: string) {
		alteaProjects.assign(projectId, chatId);
	}

	const freeChats = $derived(
		conversations().filter((c: { id: string }) => !alteaProjects.projectOf(c.id))
	);

	function deleteProject(id: string, name: string) {
		if (!window.confirm(`Eliminare il progetto "${name}"? Le chat non vengono eliminate.`)) return;
		alteaProjects.remove(id);
	}

	function startEdit(id: string) {
		editId = editId === id ? null : id;
		const p = alteaProjects.projects.find((x) => x.id === id);
		renameDraft = p?.name ?? '';
		factDraft = '';
		if (editId && !isOpen(id)) openIds = [...openIds, id];
	}

	function addFact(id: string) {
		alteaProjects.addMemory(id, factDraft);
		factDraft = '';
	}
</script>

<svelte:window bind:innerWidth />

{#if innerWidth > 768}
	<aside
		class={[
			'sticky top-2 right-0 mt-2 mr-2 z-10 pt-2 shrink-0',
			'h-[calc(100dvh-1.125rem)] rounded-2xl',
			'flex flex-col',
			'transition-[width,padding] duration-200 ease-out',
			alteaProjects.sidebarOpen
				? 'w-72 border-border bg-muted/60 shadow-md backdrop-blur-xl'
				: 'w-12'
		]}
	>
		<div class="flex items-center justify-between px-2">
			{#if alteaProjects.sidebarOpen}
				<span class="pl-2 text-sm font-medium">Progetti</span>
			{/if}
			<button
				type="button"
				class="flex h-9 w-9 items-center justify-center rounded-full hover:bg-foreground/10"
				title={alteaProjects.sidebarOpen ? 'Chiudi progetti' : 'Apri progetti'}
				aria-label={alteaProjects.sidebarOpen ? 'Chiudi progetti' : 'Apri progetti'}
				onclick={() => alteaProjects.toggleSidebar()}
			>
				{#if alteaProjects.sidebarOpen}
					<PanelRightClose class="h-4 w-4" />
				{:else}
					<FolderKanban class="h-4 w-4" />
				{/if}
			</button>
		</div>

		{#if alteaProjects.sidebarOpen}
			<div class="mt-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-2">
				{#if creating}
					<form
						class="flex gap-1"
						onsubmit={(e) => {
							e.preventDefault();
							createProject();
						}}
					>
						<!-- svelte-ignore a11y_autofocus -->
						<input
							class="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
							placeholder="Nome del progetto"
							bind:value={newName}
							autofocus
							onkeydown={(e) => {
								if (e.key === 'Escape') {
									creating = false;
									newName = '';
								}
							}}
						/>
						<button type="submit" class="rounded-md bg-primary px-2 text-xs text-primary-foreground">
							Crea
						</button>
					</form>
				{:else}
					<button
						type="button"
						class="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-foreground/10"
						onclick={() => (creating = true)}
					>
						<Plus class="h-4 w-4" /> Nuovo progetto
					</button>
				{/if}

				{#if alteaProjects.projects.length === 0 && !creating}
					<p class="px-2 py-3 text-xs text-muted-foreground">
						Nessun progetto. Crea un progetto per raggruppare più chat sullo stesso argomento, con
						istruzioni e memoria condivise.
					</p>
				{/if}

				{#each alteaProjects.projects as p (p.id)}
					{@const chats = p.chatIds.filter((c) => chatName(c) !== undefined)}
					<div class="rounded-lg">
						<div class="group flex items-center gap-1 rounded-lg px-1 py-1 hover:bg-foreground/5">
							<button
								type="button"
								class="flex min-w-0 flex-1 items-center gap-1 text-left text-sm"
								onclick={() => toggleOpen(p.id)}
							>
								{#if isOpen(p.id)}
									<ChevronDown class="h-3.5 w-3.5 shrink-0" />
								{:else}
									<ChevronRight class="h-3.5 w-3.5 shrink-0" />
								{/if}
								<span
									class="truncate {alteaProjects.pendingProjectId === p.id
										? 'text-primary'
										: ''}">{p.name}</span
								>
								<span class="shrink-0 text-xs text-muted-foreground">{chats.length}</span>
							</button>
							<button
								type="button"
								class="rounded p-1 opacity-60 hover:bg-foreground/10 hover:opacity-100"
								title="Aggiungi una chat al progetto"
								aria-label="Aggiungi una chat al progetto"
								onclick={() => togglePicker(p.id)}><Plus class="h-3.5 w-3.5" /></button
							>
							<button
								type="button"
								class="rounded p-1 opacity-60 hover:bg-foreground/10 hover:opacity-100"
								title="Istruzioni, memoria e nome"
								aria-label="Modifica progetto"
								onclick={() => startEdit(p.id)}><Pencil class="h-3.5 w-3.5" /></button
							>
							<button
								type="button"
								class="rounded p-1 opacity-60 hover:bg-foreground/10 hover:text-destructive hover:opacity-100"
								title="Elimina progetto"
								aria-label="Elimina progetto"
								onclick={() => deleteProject(p.id, p.name)}><Trash2 class="h-3.5 w-3.5" /></button
							>
						</div>

						{#if isOpen(p.id)}
							<div class="ml-3 mt-1 flex flex-col gap-0.5 border-l border-border pl-2">
								{#if editId === p.id}
									<div class="mb-2 flex flex-col gap-2 rounded-lg bg-background/60 p-2">
										<label class="text-xs text-muted-foreground" for="pn-{p.id}">Nome</label>
										<input
											id="pn-{p.id}"
											class="rounded-md border border-border bg-background px-2 py-1 text-sm"
											bind:value={renameDraft}
											onblur={() => alteaProjects.rename(p.id, renameDraft)}
										/>
										<label class="text-xs text-muted-foreground" for="pi-{p.id}"
											>Istruzioni del progetto</label
										>
										<textarea
											id="pi-{p.id}"
											rows="3"
											class="rounded-md border border-border bg-background px-2 py-1 text-sm"
											placeholder="Es. Aiutami con l'esame di Controlli Automatici, rispondi con esempi."
											value={p.instructions}
											oninput={(e) => alteaProjects.setInstructions(p.id, e.currentTarget.value)}
										></textarea>
										<span class="text-xs text-muted-foreground">Memoria del progetto</span>
										{#each p.memory as m, i (i + m)}
											<div class="flex items-start gap-1 text-xs">
												<span class="flex-1">• {m}</span>
												<button
													type="button"
													class="opacity-60 hover:opacity-100"
													aria-label="Rimuovi"
													onclick={() => alteaProjects.removeMemory(p.id, i)}
													><X class="h-3 w-3" /></button
												>
											</div>
										{/each}
										<form
											class="flex gap-1"
											onsubmit={(e) => {
												e.preventDefault();
												addFact(p.id);
											}}
										>
											<input
												class="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
												placeholder="Aggiungi un fatto..."
												bind:value={factDraft}
											/>
											<button
												type="submit"
												class="rounded-md bg-primary px-2 text-xs text-primary-foreground"
												>Aggiungi</button
											>
										</form>
									</div>
								{/if}

								{#if pickerId === p.id}
									<div class="mb-2 flex flex-col gap-0.5 rounded-lg bg-background/60 p-1">
										<button
											type="button"
											class="rounded-md px-1 py-1 text-left text-xs font-medium text-primary hover:bg-foreground/5"
											onclick={() => {
												pickerId = null;
												newChatIn(p.id);
											}}>+ Nuova chat nel progetto</button
										>
										<span class="px-1 pt-1 text-xs text-muted-foreground">Aggiungi una chat esistente:</span>
										<div class="flex max-h-48 flex-col gap-0.5 overflow-y-auto">
											{#each freeChats as c (c.id)}
												<button
													type="button"
													class="truncate rounded-md px-1 py-1 text-left text-xs hover:bg-foreground/10"
													onclick={() => addExisting(p.id, c.id)}>{c.name}</button
												>
											{:else}
												<span class="px-1 py-1 text-xs text-muted-foreground">Nessuna chat libera.</span>
											{/each}
										</div>
									</div>
								{/if}

								{#each chats as cid (cid)}
									<div
										class="group flex items-center gap-1 rounded-md px-1 py-1 text-sm hover:bg-foreground/5 {currentChatId ===
										cid
											? 'bg-foreground/10'
											: ''}"
									>
										<button
											type="button"
											class="min-w-0 flex-1 truncate text-left"
											onclick={() => goto(RouterService.chat(cid))}>{chatName(cid)}</button
										>
										<button
											type="button"
											class="rounded p-0.5 opacity-0 hover:bg-foreground/10 group-hover:opacity-70"
											title="Togli dal progetto"
											aria-label="Togli dal progetto"
											onclick={() => alteaProjects.unassign(cid)}><X class="h-3 w-3" /></button
										>
									</div>
								{/each}

								{#if chats.length === 0}
									<p class="px-1 py-1 text-xs text-muted-foreground">Nessuna chat.</p>
								{/if}

								{#if currentChatId && !alteaProjects.projectOf(currentChatId)}
									<button
										type="button"
										class="mt-1 rounded-md px-1 py-1 text-left text-xs text-primary hover:bg-foreground/5"
										onclick={() => currentChatId && alteaProjects.assign(p.id, currentChatId)}
									>
										+ Aggiungi la chat corrente
									</button>
								{:else if currentChatId && alteaProjects.projectOf(currentChatId)?.id !== p.id}
									<button
										type="button"
										class="mt-1 rounded-md px-1 py-1 text-left text-xs text-primary hover:bg-foreground/5"
										onclick={() => currentChatId && alteaProjects.assign(p.id, currentChatId)}
									>
										+ Sposta qui la chat corrente
									</button>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</aside>
{/if}
