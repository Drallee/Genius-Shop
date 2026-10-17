// ===== SAVE DISPATCHER =====

async function saveCurrentTabChanges(isSilent = false) {
    const start = Date.now();
    const tab = getEditorState('currentTab');
    if (window.EditorPermissions && !EditorPermissions.canSaveTab(tab)) return;
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
            if (!window.EditorPermissions || EditorPermissions.canWriteFile(`shops/${currentShopFile}`)) await saveCurrentShop(true);
            await saveCampaignHubDirtyShops(true);
        } else if (tab === 'commands') {
            await saveCommandsYaml(isSilent);
        } else if (tab === 'customitems') {
            await saveCustomItemsYaml(isSilent);
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

async function saveAllDrafts() {
    const start = Date.now();
    const allowed = file => !window.EditorPermissions || EditorPermissions.canWriteFile(file);
    try {
        if (allowed('commands.yml') && getEditorState('currentTab') === 'commands') {
            await saveCommandsYaml(true);
        }
        if (allowed(`shops/${currentShopFile}`)) await saveCurrentShop(true);
        for (const [name, content] of Object.entries(allShops)) {
            if (name !== currentShopFile && allowed(`shops/${name}`)) await saveShopFileDirect(name, content, true);
        }
        if (allowed('campaigns.yml')) await saveCampaignHubDirtyShops(true);
        if (allowed('menus/main-menu.yml')) await saveMainMenuYaml(true);
        if (allowed('menus/purchase-menu.yml')) await savePurchaseMenuYaml(true);
        if (allowed('menus/sell-menu.yml')) await saveSellMenuYaml(true);
        if (allowed('campaigns.yml')) await saveCampaignsYaml(true);
        if (allowed('custom-items.yml')) await saveCustomItemsYaml(true);
        if (allowed('commands.yml') && getEditorState('currentTab') !== 'commands') {
            await saveCommandsYaml(true);
        }
        if (allowed('menus/gui-settings.yml')) await saveGuiSettingsYaml(true);
        if (allowed('config.yml')) await saveEconomySafetySettings(true);
        setUnsavedChanges([]);
        if (window.EditorTelemetry) window.EditorTelemetry.track('draft_save_all', { durationMs: Date.now() - start }, true);
    } catch (error) {
        if (window.EditorTelemetry) window.EditorTelemetry.track('draft_save_all', { durationMs: Date.now() - start, reason: error.message }, false);
        throw error;
    }
}

async function publishAllChanges() {
    return EditorDrafts.review();
}
