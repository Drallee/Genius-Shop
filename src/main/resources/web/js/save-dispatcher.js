// ===== SAVE DISPATCHER =====

async function saveCurrentTabChanges(isSilent = false) {
    const start = Date.now();
    const tab = getEditorState('currentTab');
    try {
        if (tab === 'shop') {
            await saveCurrentShop(isSilent);
        } else if (tab === 'mainmenu') {
            await saveMainMenuYaml(isSilent);
        } else if (tab === 'purchase') {
            await savePurchaseMenuYaml(isSilent);
        } else if (tab === 'sell') {
            await saveSellMenuYaml(isSilent);
        } else if (tab === 'campaigns') {
            await saveCampaignsYaml(isSilent);
            await saveCurrentShop(true);
            await saveCampaignHubDirtyShops(true);
        } else if (tab === 'guisettings') {
            await saveGuiSettingsYaml(isSilent);
            await saveEconomySafetySettings(true);
        } else if (tab === 'dataeditor') {
            await loadDatabaseEditorData(false);
            showToast('Data refreshed', 'success');
        }
        if (window.EditorTelemetry) window.EditorTelemetry.track('tab_save', { tab, isSilent, durationMs: Date.now() - start }, true);
    } catch (error) {
        if (window.EditorTelemetry) window.EditorTelemetry.track('tab_save', { tab, isSilent, durationMs: Date.now() - start, reason: error.message }, false);
        throw error;
    }
}

async function publishAllChanges() {
    const start = Date.now();
    showToast(t('web-editor.modals.publishing', 'Publishing...'), 'info');
    try {
        await saveCurrentShop(true);
        await saveCampaignHubDirtyShops(true);
        await saveMainMenuYaml(true);
        await savePurchaseMenuYaml(true);
        await saveSellMenuYaml(true);
        await saveCampaignsYaml(true);
        await saveGuiSettingsYaml(true);
        await saveEconomySafetySettings(true);
        await loadDatabaseEditorData(true);
        setUnsavedChanges([]);
        if (window.EditorTelemetry) window.EditorTelemetry.track('publish_all', { durationMs: Date.now() - start }, true);
    } catch (error) {
        if (window.EditorTelemetry) window.EditorTelemetry.track('publish_all', { durationMs: Date.now() - start, reason: error.message }, false);
        throw error;
    }
}
