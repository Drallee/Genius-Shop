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
    test(`main menu tooltip shows only the display name and lore with parity ${parity}`, () => {
        const { editor, grid, tooltip } = setup();
        editor.run(`previewParityMode = ${parity}; updateGuiPreview()`);
        assert.equal(grid.children.length, 9);
        grid.children[0].listeners.mouseenter({ clientX: 50, clientY: 50 });
        for (const text of ['Menu item', 'Custom lore', '&nbsp;', 'Version: 1.7.0']) {
            assert.ok(tooltip.innerHTML.includes(text), text);
        }
        for (const text of ['Slot:', 'Material:', 'Action:', 'Command:', 'Run commands as:',
            'Required Permission:', 'Hide Attributes:', 'Hide Additional Info:', 'geniusshop.admin', 'say hello']) {
            assert.ok(!tooltip.innerHTML.includes(text), text);
        }
        editor.run(`loadedGuiShops[0].hideAttributes = false;
            loadedGuiShops[0].hideAdditional = false;
            loadedGuiShops[0].permission = '';
            loadedGuiShops[0].lore = [];
            updateGuiPreview()`);
        grid.children[9].listeners.mouseenter({ clientX: 50, clientY: 50 });
        assert.equal(tooltip.innerHTML, editor.run('`<div class="tooltip-title">${parseMinecraftColors(loadedGuiShops[0].name)}</div>`'));
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
});

test('main menu tooltip escapes the displayed name and lore', () => {
    const { editor, grid, tooltip } = setup();
    editor.run(`loadedGuiShops[0].name = '<script>menu</script>';
        loadedGuiShops[0].lore = ['<img src=x onerror=alert(1)>'];
        updateGuiPreview()`);
    grid.children[0].listeners.mouseenter({ clientX: 50, clientY: 50 });
    const html = tooltip.innerHTML;
    assert.ok(!html.includes('<img'));
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;img'));
    assert.ok(html.includes('&lt;script&gt;menu&lt;/script&gt;'));
});
