const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = file => fs.readFileSync(path.join(__dirname, '../../main/resources/web/js', file), 'utf8');

function context() {
    const context = vm.createContext({ console, currentShopFile: 'a.yml', document: {}, window: {} });
    context.window = context;
    vm.runInContext(source('permissions.js'), context);
    return context;
}

test('missing permissions fail closed and every tab follows its independent capability', () => {
    const ctx = context();
    const permissions = ctx.EditorPermissions;
    assert.equal(permissions.tabAllowed('shop'), false);
    assert.equal(permissions.can('publish'), false);
    for (const [node, tab] of [['drafts', 'shop'], ['analytics', 'stockanalytics'], ['analytics', 'salesanalytics'], ['commands', 'commands'], ['database', 'dataeditor']]) {
        permissions.set({ [node]: true });
        assert.equal(permissions.tabAllowed(tab), true);
        assert.equal(permissions.can('publish'), false);
        assert.equal(permissions.can('admin'), false);
    }
    permissions.set({ publish: true });
    assert.equal(permissions.hasDrafts(), true);
    assert.equal(permissions.tabAllowed('shop'), false);
    permissions.set();
    assert.equal(permissions.hasDrafts(), false);
});

test('command-bearing files are read-only without blocking other shops', () => {
    const permissions = context().EditorPermissions;
    permissions.set({ drafts: true }, ['shops/a.yml']);
    assert.equal(permissions.canSaveTab('shop'), false);
    assert.equal(permissions.canSaveTab('mainmenu'), true);
    assert.equal(permissions.canWriteFile('shops/b.yml'), true);
    assert.equal(permissions.canWriteFile('commands.yml'), false);
    assert.equal(permissions.canWriteFile('config.yml'), false);
    permissions.set({ admin: true });
    assert.equal(permissions.canSaveTab('shop'), true);
    assert.equal(permissions.canWriteFile('config.yml'), true);
});

test('save all only writes files granted by the server and does not fetch live database rows', async () => {
    const calls = [];
    const ctx = context();
    Object.assign(ctx, { Date, allShops: { 'a.yml': 'items: []', 'locked.yml': 'commands: []', 'b.yml': 'items: []' },
        EditorRevisions: { requireResolved: () => {} },
        getEditorState: () => 'mainmenu', setUnsavedChanges: () => {},
        saveShopFileDirect: name => calls.push(name) });
    for (const method of ['saveCurrentShop', 'saveCampaignHubDirtyShops', 'saveMainMenuYaml', 'savePurchaseMenuYaml',
        'saveSellMenuYaml', 'saveCampaignsYaml', 'saveCustomItemsYaml', 'saveCommandsYaml', 'saveGuiSettingsYaml',
        'saveEconomySafetySettings', 'loadDatabaseEditorData']) ctx[method] = () => calls.push(method);
    ctx.EditorPermissions.set({ drafts: true }, ['shops/locked.yml', 'custom-items.yml']);
    vm.runInContext(source('save-dispatcher.js'), ctx);
    await vm.runInContext('saveAllDrafts()', ctx);
    assert.ok(calls.includes('saveCurrentShop'));
    assert.ok(calls.includes('b.yml'));
    for (const skipped of ['locked.yml', 'saveCommandsYaml', 'saveCustomItemsYaml', 'saveEconomySafetySettings', 'loadDatabaseEditorData']) {
        assert.ok(!calls.includes(skipped), skipped);
    }
    calls.length = 0;
    ctx.EditorPermissions.set({ commands: true });
    await vm.runInContext('saveAllDrafts()', ctx);
    assert.deepEqual(calls, ['saveCommandsYaml']);
});

test('autosave cannot schedule or execute for an unauthorized tab', async () => {
    const ctx = context();
    let pending;
    let saves = 0;
    Object.assign(ctx, { getEditorState: key => key === 'currentTab' ? 'shop' : null,
        localStorage: { getItem: () => 'true' }, setEditorState: () => {}, clearTimeout: () => {},
        setTimeout: callback => { pending = callback; return 1; }, saveCurrentTabChanges: () => { saves++; } });
    vm.runInContext(source('autosave-manager.js'), ctx);
    vm.runInContext('scheduleEditorAutoSave()', ctx);
    assert.equal(pending, undefined);
    ctx.EditorPermissions.set({ drafts: true });
    vm.runInContext('scheduleEditorAutoSave()', ctx);
    assert.equal(typeof pending, 'function');
    ctx.EditorPermissions.set({ analytics: true });
    await pending();
    assert.equal(saves, 0);
});
