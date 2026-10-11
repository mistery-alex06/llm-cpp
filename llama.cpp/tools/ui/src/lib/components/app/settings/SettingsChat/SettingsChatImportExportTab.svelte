<script lang="ts">
	import { Download, Upload, Trash2 } from '@lucide/svelte';
	import {
		DialogConversationSelection,
		DialogConfirmation,
		DialogExportSettings
	} from '$lib/components/app';
	import { createMessageCountMap } from '$lib/utils';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { conversationsStore, conversations } from '$lib/stores/conversations.svelte';
	import { toast } from 'svelte-sonner';
	import { exportAlteaBackup, importAlteaBackup } from '$lib/utils/altea-backup';
	import { fade } from 'svelte/transition';
	import { ConversationSelectionMode, HtmlInputType, FileExtensionText } from '$lib/enums';
	import SettingsChatImportExportSection from './SettingsChatImportExportSection.svelte';
	import SettingsGroup from '$lib/components/app/settings/SettingsGroup.svelte';

	let exportedConversations = $state<DatabaseConversation[]>([]);
	let importedConversations = $state<DatabaseConversation[]>([]);
	let showExportSummary = $state(false);
	let showImportSummary = $state(false);

	let showExportDialog = $state(false);
	let showImportDialog = $state(false);
	let availableConversations = $state<DatabaseConversation[]>([]);
	let messageCountMap = $state<Map<string, number>>(new Map());
	let fullImportData = $state<Array<{ conv: DatabaseConversation; messages: DatabaseMessage[] }>>(
		[]
	);

	// Delete functionality state
	let showDeleteDialog = $state(false);

	// Settings import/export state
	let showSettingsExportSummary = $state(false);
	let showSettingsImportSummary = $state(false);
	let showSettingsExportDialog = $state(false);
	let includeSensitiveData = $state(false);

	function handleAlteaBackupExport() {
		try {
			const r = exportAlteaBackup();
			toast.success(`Backup salvato: ${r.memory} voci di memoria, ${r.docs} documenti`);
		} catch {
			toast.error('Esportazione del backup non riuscita');
		}
	}

	function handleAlteaBackupImport() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json,application/json';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;
			try {
				const r = await importAlteaBackup(file);
				toast.success(`Importati ${r.memory} voci di memoria e ${r.docs} documenti`);
			} catch (e) {
				toast.error(e instanceof Error ? e.message : 'Importazione non riuscita');
			}
		};
		input.click();
	}

	function handleSettingsExport() {
		showSettingsExportDialog = true;
		includeSensitiveData = false;
	}

	function handleSettingsExportConfirm() {
		showSettingsExportDialog = false;

		try {
			const data = settingsStore.exportSettings(includeSensitiveData);
			const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `llama_settings_${new Date().toISOString().split('T')[0]}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			showSettingsExportSummary = true;
			showSettingsImportSummary = false;
			toast.success('Impostazioni esportate');
		} catch (err) {
			console.error('Failed to export settings:', err);
			toast.error('Esportazione impostazioni non riuscita');
		}
	}

	function handleSettingsExportCancel() {
		showSettingsExportDialog = false;
	}

	function handleSettingsImport() {
		try {
			const input = document.createElement('input');
			input.type = HtmlInputType.FILE;
			input.accept = FileExtensionText.JSON;

			input.onchange = async (e) => {
				const file = (e.target as HTMLInputElement)?.files?.[0];
				if (!file) return;

				try {
					const text = await file.text();
					const data = JSON.parse(text);

					if (!data || typeof data !== 'object' || !data.config) {
						toast.error('File impostazioni non valido');
						return;
					}

					settingsStore.importSettings(data);

					showSettingsImportSummary = true;
					showSettingsExportSummary = false;
					toast.success('Impostazioni importate');
				} catch (err) {
					console.error('Failed to import settings:', err);
					toast.error('Importazione impostazioni non riuscita');
				}
			};

			input.click();
		} catch (err) {
			console.error('Failed to open file picker:', err);
			toast.error('Impossibile aprire la selezione file');
		}
	}

	async function handleExportClick() {
		try {
			const allConversations = conversations();
			if (allConversations.length === 0) {
				toast.info('Nessuna conversazione da esportare');
				return;
			}

			const conversationsWithMessages = await Promise.all(
				allConversations.map(async (conv: DatabaseConversation) => {
					const messages = await conversationsStore.getConversationMessages(conv.id);
					return { conv, messages };
				})
			);

			messageCountMap = createMessageCountMap(conversationsWithMessages);
			availableConversations = allConversations;
			showExportDialog = true;
		} catch (err) {
			console.error('Failed to load conversations:', err);
			alert('Impossibile caricare le conversazioni');
		}
	}

	async function handleExportConfirm(selectedConversations: DatabaseConversation[]) {
		try {
			const allData: ExportedConversation[] = await Promise.all(
				selectedConversations.map(async (conv) => {
					const messages = await conversationsStore.getConversationMessages(conv.id);
					return { conv: $state.snapshot(conv), messages: $state.snapshot(messages) };
				})
			);

			if (allData.length === 1) {
				conversationsStore.downloadConversationFile(allData[0]);
			} else {
				conversationsStore.downloadConversationsArchive(allData);
			}

			exportedConversations = selectedConversations;
			showExportSummary = true;
			showImportSummary = false;
			showExportDialog = false;
		} catch (err) {
			console.error('Export failed:', err);
			alert('Failed to export conversations');
		}
	}

	async function handleImportClick() {
		try {
			const input = document.createElement('input');

			// No `accept` filter: iOS resolves each entry to a UTI and has none for
			// `.jsonl`, which greys out exported conversations in the file picker.
			// `parseImportFile` detects the format from the file contents instead.
			input.type = HtmlInputType.FILE;

			input.onchange = async (e) => {
				const file = (e.target as HTMLInputElement)?.files?.[0];
				if (!file) return;

				try {
					const importedData = await conversationsStore.parseImportFile(file);

					if (importedData.length === 0) {
						throw new Error('No conversations found in file');
					}

					fullImportData = importedData;
					availableConversations = importedData.map((item) => item.conv);
					messageCountMap = createMessageCountMap(importedData);
					showImportDialog = true;
				} catch (err: unknown) {
					const message = err instanceof Error ? err.message : 'Unknown error';

					console.error('Failed to parse file:', err);
					alert(`Failed to parse file: ${message}`);
				}
			};

			input.click();
		} catch (err) {
			console.error('Import failed:', err);
			alert('Failed to import conversations');
		}
	}

	async function handleImportConfirm(selectedConversations: DatabaseConversation[]) {
		try {
			const selectedIds = new Set(selectedConversations.map((c) => c.id));
			const selectedData = $state
				.snapshot(fullImportData)
				.filter((item) => selectedIds.has(item.conv.id));

			const { imported, skipped } = await conversationsStore.importConversationsData(selectedData);

			// A conversation already in the database is left untouched, so the summary
			// lists what was written and the toast accounts for the rest.
			if (skipped.length > 0) {
				toast.info(
					`Skipped ${skipped.length} conversation${skipped.length === 1 ? '' : 's'} already in your library`
				);
			}

			importedConversations = imported;
			showImportSummary = true;
			showExportSummary = false;
			showImportDialog = false;
		} catch (err) {
			console.error('Import failed:', err);
			alert('Failed to import conversations. Please check the file format.');
		}
	}

	async function handleDeleteAllClick() {
		try {
			const allConversations = conversations();

			if (allConversations.length === 0) {
				toast.info('Nessuna conversazione da eliminare');
				return;
			}

			showDeleteDialog = true;
		} catch (err) {
			console.error('Failed to load conversations for deletion:', err);
			toast.error('Impossibile caricare le conversazioni');
		}
	}

	async function handleDeleteAllConfirm() {
		try {
			await conversationsStore.deleteAll();

			showDeleteDialog = false;
		} catch (err) {
			console.error('Failed to delete conversations:', err);
		}
	}

	function handleDeleteAllCancel() {
		showDeleteDialog = false;
	}
</script>

<div class="space-y-12" in:fade={{ duration: 150 }}>
	<SettingsGroup title="Conversazioni">
		<SettingsChatImportExportSection
			title="Esporta"
			description="Scarica le conversazioni come ZIP di file JSONL, con messaggi, allegati e cronologia."
			IconComponent={Download}
			buttonText="Esporta conversazioni"
			onclick={handleExportClick}
			summary={{ show: showExportSummary, verb: 'Esportate', items: exportedConversations }}
		/>

		<SettingsChatImportExportSection
			title="Importa"
			description="Importa conversazioni da un file ZIP o JSONL esportato in precedenza. Verranno unite a quelle esistenti."
			IconComponent={Upload}
			buttonText="Importa conversazioni"
			onclick={handleImportClick}
			summary={{ show: showImportSummary, verb: 'Importate', items: importedConversations }}
		/>

		<SettingsChatImportExportSection
			title="Elimina tutto"
			description="Elimina definitivamente tutte le conversazioni e i messaggi. Non reversibile: esporta prima se vuoi un backup."
			IconComponent={Trash2}
			buttonText="Elimina tutte le conversazioni"
			onclick={handleDeleteAllClick}
			titleClass="text-destructive"
			buttonVariant="destructive"
			buttonClass="text-destructive-foreground justify-start justify-self-start bg-destructive hover:bg-destructive/80 md:w-auto"
		/>
	</SettingsGroup>

	<SettingsGroup title="Memoria e documenti di Altea">
		<SettingsChatImportExportSection
			title="Esporta"
			description="Salva memoria e documenti caricati (Doc) in un unico file JSON di backup."
			IconComponent={Download}
			buttonText="Esporta backup"
			onclick={handleAlteaBackupExport}
		/>

		<SettingsChatImportExportSection
			title="Importa"
			description="Ripristina un backup di Altea. Memoria e documenti vengono uniti a quelli esistenti, senza duplicati."
			IconComponent={Upload}
			buttonText="Importa backup"
			onclick={handleAlteaBackupImport}
		/>
	</SettingsGroup>

	<SettingsGroup title="Impostazioni">
		<SettingsChatImportExportSection
			title="Esporta"
			description="Esporta impostazioni e preferenze della chat come file JSON."
			IconComponent={Download}
			buttonText="Esporta impostazioni"
			onclick={handleSettingsExport}
			summary={{ show: showSettingsExportSummary, verb: 'Esportate', items: [] }}
		/>

		<SettingsChatImportExportSection
			title="Importa"
			description="Importa le impostazioni da un file JSON esportato in precedenza. Verranno unite a quelle esistenti."
			IconComponent={Upload}
			buttonText="Importa impostazioni"
			onclick={handleSettingsImport}
			summary={{ show: showSettingsImportSummary, verb: 'Importate', items: [] }}
		/>
	</SettingsGroup>
</div>

<DialogExportSettings
	bind:open={showSettingsExportDialog}
	bind:includeSensitiveData
	onConfirm={handleSettingsExportConfirm}
	onCancel={handleSettingsExportCancel}
/>

<DialogConversationSelection
	conversations={availableConversations}
	{messageCountMap}
	mode={ConversationSelectionMode.EXPORT}
	bind:open={showExportDialog}
	onCancel={() => (showExportDialog = false)}
	onConfirm={handleExportConfirm}
/>

<DialogConversationSelection
	conversations={availableConversations}
	{messageCountMap}
	mode={ConversationSelectionMode.IMPORT}
	bind:open={showImportDialog}
	onCancel={() => (showImportDialog = false)}
	onConfirm={handleImportConfirm}
/>

<DialogConfirmation
	bind:open={showDeleteDialog}
	title="Elimina tutte le conversazioni"
	description="Eliminare tutte le conversazioni? L'azione non è reversibile e rimuove definitivamente conversazioni e messaggi."
	confirmText="Elimina tutto"
	cancelText="Annulla"
	variant="destructive"
	icon={Trash2}
	onConfirm={handleDeleteAllConfirm}
	onCancel={handleDeleteAllCancel}
/>
