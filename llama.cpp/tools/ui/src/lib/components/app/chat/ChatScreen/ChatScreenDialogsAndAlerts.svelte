<script lang="ts">
	import { Trash2 } from '@lucide/svelte';
	import { ErrorDialogType } from '$lib/enums';
	import {
		DialogChatError,
		DialogConfirmation,
		DialogEmptyFileAlert,
		DialogFileUploadError
	} from '$lib/components/app';

	let {
		showDeleteDialog,
		handleDeleteConfirm,
		showEmptyFileDialog,
		emptyFileNames,
		activeErrorDialog,
		handleErrorDialogOpenChange,
		fileUpload
	} = $props();
</script>

<DialogFileUploadError
	bind:open={fileUpload.showFileErrorDialog}
	fileErrorData={fileUpload.fileErrorData}
/>

<DialogConfirmation
	bind:open={showDeleteDialog}
	title="Elimina conversazione"
	description="Eliminare questa conversazione? L'azione non è reversibile e rimuove definitivamente tutti i messaggi."
	confirmText="Elimina"
	cancelText="Annulla"
	variant="destructive"
	icon={Trash2}
	onConfirm={handleDeleteConfirm}
	onCancel={() => (showDeleteDialog = false)}
/>

<DialogEmptyFileAlert
	bind:open={showEmptyFileDialog}
	emptyFiles={emptyFileNames}
	onOpenChange={(open) => {
		if (!open) {
			emptyFileNames = [];
		}
	}}
/>

<DialogChatError
	message={activeErrorDialog?.message ?? ''}
	contextInfo={activeErrorDialog?.contextInfo}
	onOpenChange={handleErrorDialogOpenChange}
	open={Boolean(activeErrorDialog)}
	type={activeErrorDialog?.type ?? ErrorDialogType.SERVER}
/>
