<script lang="ts">
	import { onMount } from 'svelte';
	import { alteaPersonas, PERSONAS } from '$lib/utils/altea-personas.svelte';
	import { modelsStore } from '$lib/stores/models.svelte';
	import { conversationsStore } from '$lib/stores/conversations.svelte';
	import { exportChatMarkdown } from '$lib/utils/altea-export';
	import { alteaNotify } from '$lib/utils/altea-notify.svelte';
	import { COMMANDS } from '$lib/utils/altea-commands';
	import SlashMenu from './SlashMenu.svelte';
	import { chatStore } from '$lib/stores/chat.svelte';
	import ThemePicker from './ThemePicker.svelte';
	import ActionPrompt from './ActionPrompt.svelte';
	import { alteaActions } from '$lib/utils/altea-actions.svelte';
	import HelpPanel from './HelpPanel.svelte';
	import MemoryPanel from './MemoryPanel.svelte';
	import { toast } from 'svelte-sonner';


	interface Stats {
		llamaMB: number;
		swapUsedMB: number;
		freeMB: number;
		memTotalMB: number;
	}

	let stats = $state<Stats | null>(null);
	let searchUp = $state(false);
	let storeUp = $state(false);

	const loadedNames = $derived(
		modelsStore.loadedModelIds.map((id: string) => id.replace(/-Q\d.*$/i, ''))
	);

	const lastSpeed = $derived.by(() => {
		const msgs = conversationsStore.activeMessages as {
			role: string;
			timings?: { predicted_per_second?: number };
		}[];
		for (let i = msgs.length - 1; i >= 0; i--) {
			const v = msgs[i].timings?.predicted_per_second;
			if (msgs[i].role === 'assistant' && v) return v;
		}
		return 0;
	});

	// Stima del tempo rimanente: lunghezza media delle ultime risposte e velocità misurata
	const eta = $derived.by((): string => {
		if (!chatStore.isLoading) return '';
		const msgs = conversationsStore.activeMessages as {
			role: string;
			content?: string;
			timings?: { predicted_per_second?: number; predicted_n?: number };
		}[];
		const done = msgs.filter((m) => m.role === 'assistant' && m.timings?.predicted_n && m.timings?.predicted_per_second).slice(-5);
		if (!done.length) return '';
		const avgN = done.reduce((a, m) => a + (m.timings!.predicted_n ?? 0), 0) / done.length;
		const speed = done.reduce((a, m) => a + (m.timings!.predicted_per_second ?? 0), 0) / done.length;
		const last = msgs[msgs.length - 1];
		const cur = last && last.role === 'assistant' && !last.timings ? (last.content?.length ?? 0) / 3.5 : 0;
		const remaining = (avgN - cur) / speed;
		if (remaining <= 1) return 'quasi finito';
		if (remaining < 90) return `~${Math.round(remaining)} s rimasti`;
		return `~${Math.round(remaining / 60)} min rimasti`;
	});

	const hasChat = $derived(
		(conversationsStore.activeMessages as { role: string }[]).some(
			(m) => m.role === 'user' || m.role === 'assistant'
		)
	);

	let showMemory = $state(false);
	let showHelp = $state(false);

	function exportChat() {
		const ok = exportChatMarkdown(
			conversationsStore.activeConversation?.name ?? 'chat',
			conversationsStore.activeMessages
		);
		if (!ok) toast.info('Nessun messaggio da esportare');
	}

	function insert(text: string) {
		const ta = document.querySelector('textarea') as HTMLTextAreaElement | null;
		if (!ta) return;
		const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
		setter?.call(ta, text + (ta.value || ''));
		ta.dispatchEvent(new Event('input', { bubbles: true }));
		ta.focus();
		ta.setSelectionRange(ta.value.length, ta.value.length);
	}

	async function ping(url: string): Promise<boolean> {
		try {
			const r = await fetch(url, { signal: AbortSignal.timeout(1500) });
			return r.ok;
		} catch {
			return false;
		}
	}

	async function refresh() {
		if (document.visibilityState !== 'visible') return;
		searchUp = await ping('http://127.0.0.1:8091/health');
		try {
			const r = await fetch('http://127.0.0.1:8092/stats', { signal: AbortSignal.timeout(2500) });
			if (r.ok) {
				stats = await r.json();
				storeUp = true;
				return;
			}
		} catch {
			/* ignore */
		}
		stats = null;
		storeUp = false;
	}

	onMount(() => {
		void refresh();
		const t = setInterval(refresh, 6000);
		return () => clearInterval(t);
	});

	const gb = (mb: number) => (mb / 1024).toFixed(1);
</script>

<div
	class="sticky top-2 z-10 mx-2 mt-2 hidden h-9 shrink-0 items-center gap-2 rounded-2xl border border-border bg-muted/60 px-3 text-xs shadow-sm backdrop-blur-xl md:flex"
>
	<select
		class="rounded-md border border-border bg-background px-1.5 py-1 text-xs"
		title="Ruolo di Altea"
		aria-label="Ruolo di Altea"
		value={alteaPersonas.id}
		onchange={(e) => alteaPersonas.set(e.currentTarget.value)}
	>
		{#each PERSONAS as p (p.id)}
			<option value={p.id}>{p.name}</option>
		{/each}
	</select>

	<div class="flex items-center gap-1">
		{#each COMMANDS as c (c.label)}
			<button
				type="button"
				class="rounded-full px-2 py-1 hover:bg-foreground/10"
				title="Inserisce «{c.label}» nel messaggio"
				onclick={() => insert(c.text)}>{c.label}</button
			>
		{/each}
	</div>

	<button
		type="button"
		class="rounded-full px-2 py-1 hover:bg-foreground/10 disabled:opacity-40 disabled:hover:bg-transparent"
		title="Scarica questa chat in Markdown (solo domande e risposte)"
		disabled={!hasChat}
		onclick={exportChat}>Esporta .md</button
	>


	<button
		type="button"
		class="rounded-full px-2 py-1 hover:bg-foreground/10"
		title="Vedi, modifica ed elimina ciò che Altea ricorda"
		onclick={() => (showMemory = true)}>Memoria</button
	>
	<button
		type="button"
		class="rounded-full px-2 py-1 hover:bg-foreground/10 {alteaActions.enabled ? '' : 'opacity-50'}"
		title="Permette ad Altea di proporre azioni sul computer (file nella sua cartella di lavoro, aprire indirizzi), sempre con la tua conferma"
		onclick={() => alteaActions.toggle()}>Azioni: {alteaActions.enabled ? 'on' : 'off'}</button
	>
	<button
		type="button"
		class="rounded-full px-2 py-1 hover:bg-foreground/10 {alteaNotify.enabled ? '' : 'opacity-50'}"
		title="Suono e notifica a fine risposta (solo se la finestra non è in primo piano)"
		onclick={() => alteaNotify.toggle()}>Avviso: {alteaNotify.enabled ? 'on' : 'off'}</button
	>
	<div class="ml-auto flex items-center gap-3 text-muted-foreground">
		<ThemePicker />
		<span title="Modello caricato in memoria">
			{loadedNames.length ? loadedNames.join(', ') : 'nessun modello caricato'}
		</span>
		{#if eta}
			<span title="Stima basata sulle ultime risposte">{eta}</span>
		{/if}
		{#if lastSpeed}
			<span title="Velocità dell'ultima risposta">{lastSpeed.toFixed(1)} tok/s</span>
		{/if}
		{#if stats}
			<span title="RAM usata dal modello · swap in uso · memoria libera">
				RAM {gb(stats.llamaMB)} GB · swap {gb(stats.swapUsedMB)} GB · libera {gb(stats.freeMB)} GB
			</span>
		{/if}
		<span class="flex items-center gap-1" title="Servizio di ricerca web">
			<span class="h-2 w-2 rounded-full {searchUp ? 'bg-green-500' : 'bg-red-500/70'}"></span>Web
		</span>
		<span class="flex items-center gap-1" title="Archivio su file (~/Altea/data)">
			<span class="h-2 w-2 rounded-full {storeUp ? 'bg-green-500' : 'bg-red-500/70'}"></span>Archivio
		</span>
	</div>
</div>

{#if showMemory}
	<MemoryPanel onclose={() => (showMemory = false)} />
{/if}

<SlashMenu onMemory={() => (showMemory = true)} onExport={exportChat} onHelp={() => (showHelp = true)} />

{#if showHelp}
	<HelpPanel onclose={() => (showHelp = false)} />
{/if}

<ActionPrompt />
