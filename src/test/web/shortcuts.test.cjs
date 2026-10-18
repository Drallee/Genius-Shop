const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture() {
    const calls = [];
    const listeners = {};
    let modal = false;
    let editable = true;
    const buttons = ['mainmenu', 'shop', 'commands'].map(tab => ({ dataset: { tab }, hidden: tab === 'commands' }));
    const context = vm.createContext({
        sessionToken: 'test', currentTab: 'shop', isSaving: false,
        getEditorState: () => false,
        document: {
            body: { classList: { contains: () => true } },
            getElementById: () => null,
            querySelector: () => modal ? {} : null,
            querySelectorAll: selector => selector.includes('sidebar-tabs') ? buttons : [],
            addEventListener: (event, callback) => { listeners[event] = callback; }
        },
        EditorPermissions: { canSaveTab: () => editable, can: () => true, hasDrafts: () => true, tabAllowed: tab => tab !== 'commands' },
        EditorRevisions: { requireResolved: () => {} },
        EditorDrafts: { review: async () => calls.push('review') },
        saveCurrentTabChanges: async () => calls.push('save'),
        openActivityLogModal: () => calls.push('history'),
        reloadCurrentConfig: async () => calls.push('reload'),
        closeActivityDetailModal: () => {}, closeActivityLogModal: () => {}, closeSaveConfirmationModal: () => {},
        showToast: () => calls.push('unavailable'), showAlert: message => { throw new Error(message); }
    });
    context.window = context;
    context.selectEditorTab = tab => { context.currentTab = tab; calls.push(tab); };
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../../main/resources/web/js/shortcuts.js'), 'utf8'), context);
    context.EditorShortcuts.init();
    return { context, calls, modal: value => { modal = value; }, editable: value => { editable = value; },
        async key(key, modifiers = {}) {
            let prevented = false;
            listeners.keydown({ key, ctrlKey: true, target: { tagName: 'INPUT' }, ...modifiers, preventDefault() { prevented = true; } });
            await Promise.resolve();
            return prevented;
        } };
}

test('save is immediate from inputs, publish only opens review, and history/reload use editor actions', async () => {
    const editor = fixture();
    for (const [key, modifiers] of [['s', {}], ['s', { shiftKey: true }], ['h', {}], ['r', {}]]) {
        assert.equal(await editor.key(key, modifiers), true);
    }
    assert.deepEqual(editor.calls, ['save', 'review', 'history', 'reload']);
});

test('shortcuts respect edit permissions, open dialogs, repeated keys, and composition', async () => {
    const editor = fixture();
    editor.editable(false);
    await editor.key('s');
    assert.deepEqual(editor.calls, ['unavailable']);
    editor.editable(true);
    editor.modal(true);
    await editor.key('s');
    await editor.key('r');
    editor.modal(false);
    await editor.key('s', { repeat: true });
    await editor.key('s', { isComposing: true });
    assert.deepEqual(editor.calls, ['unavailable']);
});

test('tab shortcuts wrap and skip inaccessible tabs', async () => {
    const editor = fixture();
    await editor.key('ArrowRight', { altKey: true });
    assert.equal(editor.context.currentTab, 'mainmenu');
    await editor.key('ArrowLeft', { altKey: true });
    assert.equal(editor.context.currentTab, 'shop');
    assert.deepEqual(editor.calls, ['mainmenu', 'shop']);
});
