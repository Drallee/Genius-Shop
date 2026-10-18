// ===== AUTO-SAVE MANAGER =====

function scheduleEditorAutoSave() {
    if (window.EditorPermissions && !EditorPermissions.canSaveTab(getEditorState('currentTab'))) return;
    if (window.EditorTutorial && window.EditorTutorial.isActive()) return;
    if (window.EditorDrafts && window.EditorDrafts.isReviewing()) return;
    if (window.document?.getElementById?.('save-confirmation-modal')?.style?.display === 'flex') return;
    if (window.EditorRevisions && window.EditorRevisions.hasPending()) return;
    if (getEditorState('isLoadingFiles')) return;
    if (localStorage.getItem('autoSaveEnabled') === 'false') return;

    const existing = getEditorState('autoSaveTimeout');
    if (existing) clearTimeout(existing);

    const timeout = setTimeout(async () => {
        setEditorState('autoSaveTimeout', null);
        if (window.EditorPermissions && !EditorPermissions.canSaveTab(getEditorState('currentTab'))) return;
        if (window.EditorTutorial && window.EditorTutorial.isActive()) return;
        if (window.EditorDrafts && window.EditorDrafts.isReviewing()) return;
        if (window.document?.getElementById?.('save-confirmation-modal')?.style?.display === 'flex') return;
        if (window.EditorRevisions && window.EditorRevisions.hasPending()) return;
        try {
            await saveCurrentTabChanges(true);
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }, 2000);

    setEditorState('autoSaveTimeout', timeout);
}

window.scheduleEditorAutoSave = scheduleEditorAutoSave;
