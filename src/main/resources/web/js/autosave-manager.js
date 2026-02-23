// ===== AUTO-SAVE MANAGER =====

function scheduleEditorAutoSave() {
    if (getEditorState('isLoadingFiles')) return;
    if (localStorage.getItem('autoSaveEnabled') === 'false') return;

    const existing = getEditorState('autoSaveTimeout');
    if (existing) clearTimeout(existing);

    const timeout = setTimeout(async () => {
        try {
            const mode = (localStorage.getItem('autoSaveMode') || 'draft').toLowerCase();
            if (mode === 'publish') {
                await publishAllChanges();
                showToast(t('web-editor.modals.publish-success'), 'success', t('web-editor.modals.published', 'Published'));
            } else {
                await saveCurrentTabChanges(true);
            }
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }, 2000);

    setEditorState('autoSaveTimeout', timeout);
}

window.scheduleEditorAutoSave = scheduleEditorAutoSave;
