const assert = require('node:assert/strict');
const { test } = require('node:test');
const editorContext = require('./editor-test-context.cjs');

function compare(before, after) {
    const editor = editorContext();
    editor.set('before', { fileName: 'shops/blocks.yml', content: before });
    editor.set('after', { fileName: 'shops/blocks.yml', content: after });
    const original = editor.run('JSON.stringify([before, after])');
    const result = JSON.parse(editor.run('JSON.stringify(activityComparisonData(before, after))'));
    assert.equal(editor.run('JSON.stringify([before, after])'), original, 'Display must not modify rollback snapshots');
    return result;
}

test('file history before/after contains only edited items, parsed as readable values', () => {
    const before = 'items:\n  - {material: STONE, amount: 16}\n  - {material: COBBLESTONE, amount: 32}\n  - {material: DIRT, amount: 32}\n';
    const result = compare(before, before.replace('amount: 16', 'amount: 32'));
    assert.deepEqual(result.before.content, { items: [{ material: 'STONE', amount: 16 }] });
    assert.deepEqual(result.after.content, { items: [{ material: 'STONE', amount: 32 }] });
});

test('insertions and deletions do not pull unchanged shifted items into history', () => {
    const before = 'items: [{material: STONE}, {material: DIRT}]';
    const after = 'items: [{material: GOLD}, {material: STONE}, {material: DIRT}]';
    assert.deepEqual(compare(before, after).after.content, { items: [{ material: 'GOLD' }] });
    assert.deepEqual(compare(after, before).before.content, { items: [{ material: 'GOLD' }] });
});

test('duplicate rows are matched by occurrence and reorder changes remain visible', () => {
    assert.deepEqual(compare('items: [{material: STONE}, {material: STONE}]', 'items: [{material: STONE}, {material: DIRT}]').before.content,
        { items: [{ material: 'STONE' }] });
    const result = compare('items: [{material: STONE}, {material: DIRT}]', 'items: [{material: DIRT}, {material: STONE}]');
    assert.equal(result.before.content.items.length, 2);
    assert.equal(result.after.content.items[0].material, 'DIRT');
});

test('changed settings and mapped menu items exclude unrelated values', () => {
    const result = compare('rows: 3\npermission: keep\nitems: {stone: {material: STONE, amount: 1}, dirt: {material: DIRT}}',
        'rows: 4\npermission: keep\nitems: {stone: {material: STONE, amount: 2}, dirt: {material: DIRT}}');
    assert.deepEqual(result.after.content, { rows: 4, items: { stone: { material: 'STONE', amount: 2 } } });
});

test('comment, formatting and mapping-key-order changes do not include unchanged items', () => {
    assert.deepEqual(compare('# before\nitems: [{material: STONE, amount: 1}]', '# after\nitems: [{amount: 1, material: STONE}]').after.content, {});
});

test('invalid historical YAML safely falls back to its complete original payload', () => {
    const result = compare('items: [', 'items: [{material: STONE}]');
    assert.equal(result.before.content, 'items: [');
    assert.equal(typeof result.after.content, 'string');
});

test('history panels emit YAML without the file/content JSON wrapper', () => {
    const editor = editorContext();
    editor.set('data', { fileName: 'shops/blocks.yml', content: { items: [{ material: 'STONE', 'sell-price': 0, 'run-command-only': false }] } });
    const yaml = editor.run('formatActivityYaml(data)');
    assert.match(yaml, /items:\n\s+- material: STONE/);
    assert.match(yaml, /sell-price: 0/);
    assert.match(yaml, /run-command-only: false/);
    assert.doesNotMatch(yaml, /fileName|"content"|\{|\}/);
    editor.set('yaml', yaml);
    assert.deepEqual(JSON.parse(editor.run('JSON.stringify(EditorYaml.parse(yaml))')), { items: [{ material: 'STONE', 'sell-price': 0, 'run-command-only': false }] });
});

test('legacy item history omits internal defaults and uses YAML property names', () => {
    const editor = editorContext();
    editor.run(`before = GeniusSchemas.normalizeShopItem({id: 0, material: 'STONE', price: 5, sellPrice: 2, amount: 16});
        after = {...before, amount: 32};`);
    const result = JSON.parse(editor.run("JSON.stringify(activityComparisonData(before, after, 'shop-item'))"));
    assert.equal(result.before.amount, 16);
    assert.equal(result.after.amount, 32);
    assert.equal(result.after['sell-price'], 2);
    for (const key of ['id', 'item-key', 'campaign-enabled', 'stock-reset', 'buy-price-formula']) assert.equal(Object.hasOwn(result.after, key), false, key);
});

test('item display snapshots match saved YAML and retain explicit defaults and aliases', () => {
    const editor = editorContext();
    editor.set('source', "shared: &shared ['', '']\nitems:\n  - material: STONE\n    price: 5\n    lore: *shared\n    sell-price: 0\n    run-command-only: false\n    future-option: keep\n");
    editor.run('parseShopYaml(source); items[0].price = 10; updateExport();');
    const snapshot = JSON.parse(editor.run('JSON.stringify(EditorYaml.itemSnapshot(items[0]))'));
    editor.set('saved', editor.output.textContent);
    assert.deepEqual(snapshot, JSON.parse(editor.run('JSON.stringify(EditorYaml.parse(saved).items[0])')));
    assert.equal(snapshot['sell-price'], 0);
    assert.equal(snapshot['run-command-only'], false);
    assert.equal(snapshot['future-option'], 'keep');
    assert.deepEqual(snapshot.lore, ['', '']);
    assert.equal(Object.hasOwn(snapshot, 'campaign-enabled'), false);
});
