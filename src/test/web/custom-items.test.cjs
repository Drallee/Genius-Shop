const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function editor() {
    const nodes = { 'custom-items-container': {}, 'custom-items-count': {} };
    const context = vm.createContext({
        document: { getElementById: id => nodes[id] },
        loadedShopFiles: { 'blocks.yml': '' },
        guiSettings: {}, mainMenuSettings: {}, transactionSettings: {},
        TEXTURE_API: 'https://example.invalid/minecraft_',
        addActivityEntry() {}, scheduleAutoSave() {}, showToast() {},
        escapeHtml: text => String(text).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;'),
        showConfirm: async () => true
    });
    context.window = context;
    const root = path.join(__dirname, '../../main/resources/web');
    for (const file of ['vendor/yaml.min.js', 'js/yaml-editor.js', 'js/custom-items.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
    }
    return { run: code => vm.runInContext(code, context), nodes };
}

test('bundled items render all triggers, multipliers and campaign choices', () => {
    const { run, nodes } = editor();
    const yaml = fs.readFileSync(path.join(__dirname, '../../main/resources/custom-items.yml'), 'utf8');
    run(`parseCustomItemsYaml(${JSON.stringify(yaml)}); renderCustomItemsTab()`);
    assert.equal(nodes['custom-items-count'].textContent, '4 items');
    assert.ok(nodes['custom-items-container'].innerHTML.includes('Use campaigns'));
    assert.ok(nodes['custom-items-container'].innerHTML.includes('value="1.5"'));
    assert.ok(nodes['custom-items-container'].innerHTML.includes('right click container'));
});

test('editing preserves comments, unknown fields and false campaign choice', () => {
    const { run } = editor();
    run(String.raw`parseCustomItemsYaml('# Keep this\nitems:\n  wand:\n    material: STICK\n    extension: keep\n    actions:\n      right-click-container:\n        type: SELL_CONTAINER\n        multiplier: 1\n')`);
    run(`changeCustomItem('wand', ['actions', 'right-click-container', 'multiplier'], 1.5);
        changeCustomItem('wand', ['actions', 'right-click-container', 'use-campaigns'], false)`);
    assert.equal(run('customItemsConfig.items.wand.extension'), 'keep');
    assert.equal(run('customItemsConfig.items.wand.actions["right-click-container"]["use-campaigns"]'), false);
    assert.ok(run('customItemsFileRaw').includes('# Keep this'));
});

test('commands editing replaces singular legacy command and preserves multiple lines', () => {
    const { run } = editor();
    run(String.raw`parseCustomItemsYaml('items:\n  token:\n    material: STICK\n    actions:\n      right-click-air:\n        type: COMMAND\n        command: old\n');
        changeCustomItemCommands('token', 'right-click-air', 'shop\nhelp')`);
    assert.equal(run('customItemsConfig.items.token.actions["right-click-air"].command'), undefined);
    assert.equal(run('customItemsConfig.items.token.actions["right-click-air"].commands.join("|")'), 'shop|help');
});

test('rename, duplicate, action switching and deletion maintain usable YAML', async () => {
    const { run } = editor();
    run(`addCustomItem(); renameCustomItem('new-item', 'wand'); duplicateCustomItem('wand');
        setCustomItemAction('wand', 'right-click-air', 'COMMAND');
        setCustomItemAction('wand', 'right-click-air', 'OPEN_SHOP')`);
    assert.equal(run('customItemsConfig.items.wand.actions["right-click-air"].commands'), undefined);
    assert.equal(run('customItemsConfig.items.wand.actions["right-click-air"].shop'), 'blocks');
    assert.ok(run('customItemsConfig.items["wand-copy"]'));
    await run(`deleteCustomItem('wand-copy')`);
    assert.equal(run('Object.keys(customItemsConfig.items).join()'), 'wand');
});
