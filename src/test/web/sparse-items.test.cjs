const assert = require('node:assert/strict');
const { test } = require('node:test');
const editorContext = require('./editor-test-context.cjs');
const fixtures = require('../resources/sparse-item-roundtrip.json');

function setup(source) {
    const editor = editorContext();
    let modal;
    editor.set('source', source);
    editor.set('setTimeout', () => {});
    editor.set('openEditModal', value => { modal = value; });
    for (const fn of ['renderItems', 'addActivityEntry', 'showToast']) editor.set(fn, () => {});
    editor.run('updateAll = () => updateExport(); parseShopYaml(source);');
    return {
        editor,
        save(changes = {}) {
            editor.run('openShopItemModal(items[0].id)');
            const values = Object.fromEntries(modal.fields.map(field => [field.id,
                field.type === 'checkbox' ? !!field.value : String(field.value ?? '')]));
            modal.onSave({ ...values, ...changes });
            editor.set('saved', editor.output.textContent);
            return JSON.parse(editor.run('JSON.stringify(EditorYaml.parse(saved))'));
        }
    };
}

test('Golden Apple price-only modal saves preserve absent options and shop inheritance', () => {
    const source = '# Minimal shop\nsell-adds-to-stock: true\nallow-sell-stock-overflow: true\nitems:\n  - material: GOLDEN_APPLE # keep\n    price: 100\n';
    const { editor, save } = setup(source);
    const result = save({ 'modal-price': '125' });
    assert.deepEqual(result.items[0], { material: 'GOLDEN_APPLE', price: 125 });
    assert.equal(result['sell-adds-to-stock'], true);
    assert.ok(editor.output.textContent.includes('# keep'));
    const first = editor.output.textContent;
    editor.run('parseShopYaml(saved)');
    save();
    assert.equal(editor.output.textContent, first);
});

test('explicit false, zero, empty and inactive feature values survive unrelated modal edits', () => {
    const source = `items:
  - material: GOLDEN_APPLE
    price: 100
    sell-price: 0
    permission: ''
    sell-adds-to-stock: false
    allow-sell-stock-overflow: false
    run-command-only: false
    run-as: player
    campaign-enabled: false
    campaign-name: Saved campaign
    campaign-buy-multiplier: 2
    lore: ['', '']
    stock-reset:
      enabled: false
      type: weekly
      day-of-week: FRIDAY
      timezone: UTC
      custom-reset-option: keep
    future-option: keep
`;
    const { editor, save } = setup(source);
    editor.set('expected', source);
    const expected = JSON.parse(editor.run('JSON.stringify(EditorYaml.parse(expected))'));
    expected.items[0].price = 150;
    assert.deepEqual(save({ 'modal-price': '150' }), expected);
});

test('stock inheritance can be overridden with false and restored without changing other fields', () => {
    const { editor, save } = setup('sell-adds-to-stock: true\nitems:\n  - material: STONE\n    price: 10\n');
    assert.equal(save({ 'modal-sellAddsToStock': 'false' }).items[0]['sell-adds-to-stock'], false);
    editor.run('parseShopYaml(saved)');
    assert.equal(Object.hasOwn(save({ 'modal-sellAddsToStock': '' }).items[0], 'sell-adds-to-stock'), false);
});

test('new reset rules write only the active options and disabling keeps a valid minimal override', () => {
    const { editor, save } = setup('items:\n  - material: STONE\n    price: 10\n');
    let item = save({ 'modal-stockResetEnabled': true });
    assert.deepEqual(item.items[0]['stock-reset'], { enabled: true, type: 'daily' });
    editor.run('parseShopYaml(saved)');
    item = save({ 'modal-stockResetEnabled': false });
    assert.deepEqual(item.items[0]['stock-reset'], { enabled: false, type: 'daily' });
    editor.run('parseShopYaml(saved)');
    item = save({ 'modal-stockResetEnabled': true, 'modal-stockResetType': 'second-interval', 'modal-stockResetInterval': '15' });
    assert.deepEqual(item.items[0]['stock-reset'], { enabled: true, type: 'second-interval', interval: 15 });
});

test('shorthand reset rules retain their frequency when an option is changed', () => {
    const { save } = setup('items:\n  - material: STONE\n    stock-reset: weekly\n');
    assert.deepEqual(save({ 'modal-stockResetTimezone': 'UTC' }).items[0]['stock-reset'],
        { enabled: true, type: 'weekly', 'day-of-week': 'MONDAY', timezone: 'UTC' });
});

test('disabling a configured schedule retains its options for re-enabling', () => {
    const { save } = setup("items:\n  - material: STONE\n    stock-reset: {enabled: true, type: daily, time: '03:30', timezone: UTC}\n");
    assert.deepEqual(save({ 'modal-stockResetEnabled': false }).items[0]['stock-reset'],
        { enabled: false, type: 'daily', time: '03:30', timezone: 'UTC' });
});

for (const fixture of fixtures) test(`runtime fixture: ${fixture.name}`, () => {
    const { editor, save } = setup(fixture.before);
    editor.set('expected', fixture.after);
    assert.deepEqual(save({ 'modal-price': '125' }), JSON.parse(editor.run('JSON.stringify(EditorYaml.parse(expected))')));
});

test('item-save history captures the same sparse configuration as the file writer', () => {
    const { editor, save } = setup("items:\n  - material: STONE\n    price: 5\n    sell-price: 0\n    run-command-only: false\n");
    let entry;
    editor.set('addActivityEntry', (...args) => { entry = args; });
    const saved = save({ 'modal-price': '10' });
    assert.equal(entry[2].buyPricePerItem, true, 'Original model remains intact');
    assert.equal(entry[3].id, 0);
    const details = JSON.parse(JSON.stringify(entry[4]));
    assert.deepEqual(details.comparison.after, saved.items[0]);
    assert.deepEqual(details.comparison.before, { material: 'STONE', price: 5, 'sell-price': 0, 'run-command-only': false });
});
