// ===== AUTO-SAVE MANAGER =====

function scheduleEditorAutoSave() {
    if (window.EditorTutorial && window.EditorTutorial.isActive()) return;
    if (window.EditorDrafts && window.EditorDrafts.isReviewing()) return;
    if (getEditorState('isLoadingFiles')) return;
    if (localStorage.getItem('autoSaveEnabled') === 'false') return;

    const existing = getEditorState('autoSaveTimeout');
    if (existing) clearTimeout(existing);

    const timeout = setTimeout(async () => {
        setEditorState('autoSaveTimeout', null);
        if (window.EditorTutorial && window.EditorTutorial.isActive()) return;
        if (window.EditorDrafts && window.EditorDrafts.isReviewing()) return;
        try {
            await saveCurrentTabChanges(true);
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }, 2000);

    setEditorState('autoSaveTimeout', timeout);
}

window.scheduleEditorAutoSave = scheduleEditorAutoSave;
