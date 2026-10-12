const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const editorContext = require('./editor-test-context.cjs');

function setup() {
    const editor = editorContext();
    const grid = { children: [], appendChild(child) { this.children.push(child); } };
    const tooltip = { innerHTML: '', style: {}, classList: { add() {}, remove() {} } };
    editor.set('document', {
        addEventListener() {},
        querySelectorAll: () => [],
        getElementById: id => ({ 'preview-grid': grid, 'minecraft-tooltip': tooltip })[id] || null,
        createElement: () => ({
            dataset: {}, classList: { add() {} }, listeners: {},
            addEventListener(event, listener) { this.listeners[event] = listener; }
        })
    });
    editor.run(fs.readFileSync(path.join(__dirname, '../../main/resources/web/js/ui.js'), 'utf8'));
    editor.run(`mainMenuSettings.rows = 1;
        translations = { messages: { preview: { lore: ['&aCustom lore', '', 'Version: %version%'] } } };
        serverInfo.version = '1.7.0';
        loadedGuiShops = [{ slot: 0, material: 'DIAMOND_SWORD', name: '&eMenu item',
            action: 'command-close', commands: ['say hello'], runAs: 'console',
            permission: 'geniusshop.admin', lore: ['preview.lore'],
            hideAttributes: true, hideAdditional: true }];`);
    return { editor, grid, tooltip };
}

for (const parity of [false, true]) {
    test(`main menu tooltip shows lore and configured settings with parity ${parity}`, () => {
        const { editor, grid, tooltip } = setup();
        editor.run(`previewParityMode = ${parity}; updateGuiPreview()`);
        assert.equal(grid.children.length, 9);
        grid.children[0].listeners.mouseenter({ clientX: 50, clientY: 50 });
        for (const text of ['Custom lore', '&nbsp;', 'Version: 1.7.0', 'Action: command-close',
            'Command: say hello', 'Run commands as: console', 'Required Permission: geniusshop.admin',
            'Hide Attributes: Yes', 'Hide Additional Info: Yes']) {
            assert.ok(tooltip.innerHTML.includes(text), text);
        }
        editor.run(`loadedGuiShops[0].hideAttributes = false;
            loadedGuiShops[0].hideAdditional = false;
            loadedGuiShops[0].permission = '';
            loadedGuiShops[0].lore = [];
            updateGuiPreview()`);
        grid.children[9].listeners.mouseenter({ clientX: 50, clientY: 50 });
        assert.ok(tooltip.innerHTML.includes('Hide Attributes: No'));
        assert.ok(tooltip.innerHTML.includes('Hide Additional Info: No'));
        assert.ok(tooltip.innerHTML.includes('Required Permission: None'));
        assert.ok(!tooltip.innerHTML.includes('Custom lore'));
    });
}

test('main menu actions use explicit values and legacy defaults', () => {
    const { editor } = setup();
    for (const [shop, action] of [
        [{ action: ' CLOSE ', shopKey: 'blocks' }, 'close'],
        [{ action: 'no-action', commands: ['help'] }, 'no-action'],
        [{ shopKey: 'blocks', commands: ['help'] }, 'shop-key'],
        [{ commands: ['help'] }, 'command'],
        [{}, 'no-action']
    ]) {
        editor.set('shop', shop);
        assert.equal(editor.run('resolveMainMenuAction(shop)'), action);
    }
    editor.set('shop', { shopKey: 'blocks' });
    assert.ok(editor.run('buildMainMenuPreviewInfo(shop)').includes('Shop: blocks'));
});

test('main menu tooltip escapes configuration identifiers and commands', () => {
    const { editor } = setup();
    editor.set('shop', {
        action: 'command', commands: ['say <img src=x onerror=alert(1)>'],
        permission: '<script>admin</script>&a'
    });
    const html = editor.run('buildMainMenuPreviewInfo(shop)');
    assert.ok(!html.includes('<img'));
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;img'));
    assert.ok(html.includes('&lt;script&gt;admin&lt;/script&gt;&amp;a'));
});
