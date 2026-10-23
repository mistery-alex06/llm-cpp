<script lang="ts">
	import { buildConversationTree } from '$lib/stores/conversations.svelte';
	import SidebarNavigationConversationItem from './SidebarNavigationConversationItem.svelte';
	import { chatSearch, DATE_RANGES } from '$lib/utils/banana-chat-search.svelte';

	interface Props {
		class?: string;
		searchQuery: string;
		filteredConversations: DatabaseConversation[];
		currentChatId: string | undefined;
		isSelectionMode?: boolean;
		selectedIds?: Set<string>;
		onSelect: (id: string) => void;
		onEdit: (id: string) => void;
		onDelete: (id: string) => void;
		onStop: (id: string) => void;
		onToggleSelect?: (id: string) => void;
		onEnterSelectionMode?: (id: string) => void;
		onSelectionClick?: (id: string, options: { shiftKey: boolean }) => void;
		onRowMouseDown?: (id: string, event: MouseEvent) => void;
	}

	let {
		class: className = '',
		searchQuery,
		filteredConversations,
		currentChatId,
		isSelectionMode = false,
		selectedIds = new Set<string>(),
		onSelect,
		onEdit,
		onDelete,
		onStop,
		onToggleSelect,
		onEnterSelectionMode,
		onSelectionClick,
		onRowMouseDown
	}: Props = $props();

	let tree = $derived(buildConversationTree(filteredConversations));

	const hasQuery = $derived(searchQuery.trim().length > 0);
	const showHeader = $derived(hasQuery && filteredConversations.length > 0);

	const emptyMessage = $derived(
		hasQuery || chatSearch.range !== 'all'
			? 'Nessun risultato'
			: 'Scrivi per cercare nei titoli e nei messaggi, oppure scegli un periodo'
	);

	/** Estratto del messaggio che contiene le parole cercate (solo se non è già nel titolo). */
	function snippetFor(id: string, name: string): string | null {
		void chatSearch.version;
		if (!hasQuery) return null;
		if (name.toLowerCase().includes(searchQuery.trim().toLowerCase())) return null;
		return chatSearch.find(searchQuery, id);
	}
</script>

<div class="flex min-h-0 flex-1 flex-col gap-2 whitespace-nowrap {className}">
	<div class="flex shrink-0 flex-wrap gap-1 px-2" role="group" aria-label="Periodo">
		{#each DATE_RANGES as r (r.id)}
			<button
				type="button"
				class="rounded-full border px-2.5 py-0.5 text-xs transition-colors {chatSearch.range === r.id
					? 'border-transparent bg-accent text-accent-foreground'
					: 'text-muted-foreground hover:bg-accent/50'}"
				aria-pressed={chatSearch.range === r.id}
				onclick={() => (chatSearch.range = r.id)}
			>
				{r.label}
			</button>
		{/each}
	</div>

	{#if showHeader}
		<div
			class="text-muted-foreground flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium"
		>
			Risultati di ricerca
		</div>
	{/if}

	<div class="min-h-0 flex-1 overflow-y-auto">
		<ul class="flex w-full min-w-0 flex-col gap-1">
			{#each tree as { conversation, depth } (conversation.id)}
				<li class="group/item relative mb-1 p-0">
					<SidebarNavigationConversationItem
						conversation={{
							id: conversation.id,
							name: conversation.name,
							lastModified: conversation.lastModified,
							currNode: conversation.currNode,
							forkedFromConversationId: conversation.forkedFromConversationId,
							pinned: conversation.pinned
						}}
						{depth}
						isActive={currentChatId === conversation.id}
						{isSelectionMode}
						isSelected={selectedIds.has(conversation.id)}
						{onSelect}
						{onEdit}
						{onDelete}
						{onStop}
						{onToggleSelect}
						{onEnterSelectionMode}
						{onSelectionClick}
						{onRowMouseDown}
					/>
					{#each [snippetFor(conversation.id, conversation.name)] as snippet (snippet)}
						{#if snippet}
							<p
								class="text-muted-foreground truncate pb-1 pr-3 text-xs"
								style="padding-left: {0.75 + depth * 0.75}rem"
								title={snippet}
							>
								{snippet}
							</p>
						{/if}
					{/each}
				</li>
			{/each}

			{#if tree.length === 0}
				<li class="px-2 py-4 text-center">
					<p class="mb-4 p-4 text-sm text-muted-foreground">
						{emptyMessage}
					</p>
				</li>
			{/if}
		</ul>
	</div>
</div>
