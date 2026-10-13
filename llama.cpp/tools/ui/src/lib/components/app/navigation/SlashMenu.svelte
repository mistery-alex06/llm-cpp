<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { ROUTES } from '$lib/constants';
	import { COMMANDS } from '$lib/utils/altea-commands';
	import { alteaPersonas, PERSONAS } from '$lib/utils/altea-personas.svelte';
	import { alteaWeb } from '$lib/utils/altea-web.svelte';
	import { alteaAuto } from '$lib/utils/altea-auto.svelte';
	import { alteaActions } from '$lib/utils/altea-actions.svelte';
	import { alteaNotify } from '$lib/utils/altea-notify.svelte';

	let { onMemory, onExport }: { onMemory: () => void; onExport: () => void } = $props();

	interface Item {
		key: string;
		desc: string;
		/** Testo da inserire nella casella (comandi di testo). */
		insert?: string;
		/** Azione da eseguire (la casella viene svuotata). */
		run?: () => void;
	}

	const ITEMS: Item[] = [
		...COMMANDS.map((c) => ({ key: c.label.toLowerCase(), desc: c.text.trim().replace(/:$/, '…'), insert: c.text })),
		{ key: 'nuova', desc: 'Inizia una nuova chat', run: () => goto(ROUTES.NEW_CHAT) },
		{ key: 'memoria', desc: 'Apri il pannello Memoria', run: () => onMemory() },
		{ key: 'esporta', desc: 'Scarica la chat in Markdown', run: () => onExport() },
		{ key: 'web', desc: 'Attiva/disattiva la ricerca web', run: () => alteaWeb.toggle() },
		{ key: 'auto', desc: 'Attiva/disattiva la scelta automatica del modello', run: () => alteaAuto.toggle() },
		{ key: 'azioni', desc: 'Attiva/disattiva le azioni sul computer', run: () => alteaActions.toggle() },
		{ key: 'avviso', desc: 'Attiva/disattiva l\'avviso a fine risposta', run: () => alteaNotify.toggle() },
		...PERSONAS.map((p) => ({
			key: 'ruolo-' + p.id,
			desc: 'Ruolo: ' + p.name,
			run: () => alteaPersonas.set(p.id)
		}))
	];

	let ta: HTMLTextAreaElement | null = $state(null);
	let query = $state<string | null>(null); // null = menu chiuso
	let sel = $state(0);
	let pos = $state({ left: 0, bottom: 0, width: 360 });

	const matches = $derived(
		query === null ? [] : ITEMS.filter((i) => i.key.startsWith(query!) || i.key.includes(query!))
	);

	function setValue(el: HTMLTextAreaElement, v: string) {
		const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
		setter?.call(el, v);
		el.dispatchEvent(new Event('input', { bubbles: true }));
		el.focus();
		el.setSelectionRange(v.length, v.length);
	}

	function update(el: HTMLTextAreaElement) {
		const v = el.value;
		// Menu solo se il testo è un singolo "/parola" senza spazi né a capo
		if (/^\/[^\s/]*$/.test(v)) {
			ta = el;
			const r = el.getBoundingClientRect();
			pos = { left: r.left, bottom: window.innerHeight - r.top + 8, width: Math.min(Math.max(r.width, 280), 460) };
			const q = v.slice(1).toLowerCase();
			if (q !== query) sel = 0;
			query = q;
		} else {
			query = null;
		}
	}

	function choose(item: Item) {
		if (!ta) return;
		if (item.insert !== undefined) setValue(ta, item.insert);
		else {
			setValue(ta, '');
			item.run?.();
		}
		query = null;
	}

	onMount(() => {
		const onInput = (e: Event) => {
			if (e.target instanceof HTMLTextAreaElement) update(e.target);
		};
		const onKey = (e: KeyboardEvent) => {
			if (query === null || !(e.target instanceof HTMLTextAreaElement)) return;
			if (e.key === 'Escape') {
				query = null;
			} else if (matches.length === 0) {
				return;
			} else if (e.key === 'ArrowDown') {
				sel = (sel + 1) % matches.length;
			} else if (e.key === 'ArrowUp') {
				sel = (sel - 1 + matches.length) % matches.length;
			} else if (e.key === 'Enter' || e.key === 'Tab') {
				choose(matches[Math.min(sel, matches.length - 1)]);
			} else {
				return;
			}
			e.preventDefault();
			e.stopPropagation();
		};
		const onBlur = () => setTimeout(() => (query = null), 150);
		document.addEventListener('input', onInput);
		document.addEventListener('keydown', onKey, true);
		document.addEventListener('focusout', onBlur);
		return () => {
			document.removeEventListener('input', onInput);
			document.removeEventListener('keydown', onKey, true);
			document.removeEventListener('focusout', onBlur);
		};
	});
</script>

{#if query !== null && matches.length > 0}
	<div
		class="fixed z-50 max-h-72 overflow-y-auto rounded-xl border border-border bg-background p-1 text-sm shadow-xl"
		style="left:{pos.left}px; bottom:{pos.bottom}px; width:{pos.width}px"
		role="listbox"
	>
		{#each matches as item, i (item.key)}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div
				role="option"
				aria-selected={i === sel}
				tabindex="-1"
				class="flex cursor-pointer items-baseline gap-2 rounded-lg px-2 py-1.5 {i === sel ? 'bg-foreground/10' : ''}"
				onmousedown={(e) => {
					e.preventDefault();
					choose(item);
				}}
				onmouseenter={() => (sel = i)}
			>
				<span class="font-medium">/{item.key}</span>
				<span class="truncate text-xs text-muted-foreground">{item.desc}</span>
			</div>
		{/each}
	</div>
{/if}
