const test = require('node:test');
const assert = require('node:assert/strict');
const editorContext = require('./editor-test-context.cjs');

test('history titles strip gradients, legacy colors, and hex without losing names or shop context', () => {
    const editor = editorContext();
    editor.set('entry', { action: 'updated', target: 'shop-item',
        beforeData: { material: 'STONE' }, afterData: { name: '<gradient:#F8F9FA:#C7CDD6>Stone</gradient>' },
        details: { shopFile: 'blocks.yml' } });
    assert.equal(editor.run('getActivitySummary(entry)'), 'Updated Shop Item Stone');
    assert.equal(editor.run('EditorChangeView.context(entry)'), 'Shop: blocks');
    assert.equal(editor.run('EditorChangeView.plainText("&#FF0000Red &aGreen §x§0§0§f§f§0§0Lime")'), 'Red Green Lime');
});

test('review and file history project only modified items and keep their complete settings', () => {
    const editor = editorContext();
    editor.set('entry', { action: 'updated', target: 'file',
        beforeData: { fileName: 'shops/blocks.yml', content: 'rows: 4\nitems:\n- material: STONE\n  name: Stone\n  price: 5\n  custom: keep\n- material: DIRT\n  price: 2\n' },
        afterData: { fileName: 'shops/blocks.yml', content: 'rows: 4\nitems:\n- material: STONE\n  name: Stone\n  price: 7\n  custom: keep\n- material: DIRT\n  price: 2\n' } });
    editor.run('display = activityComparisonData(entry.beforeData, entry.afterData, "file")');
    const before = editor.run('formatActivityYaml(display.before)');
    const after = editor.run('formatActivityYaml(display.after)');
    assert.match(before, /price: 5/);
    assert.match(after, /price: 7/);
    for (const source of [before, after]) {
        assert.match(source, /material: STONE/);
        assert.match(source, /custom: keep/);
        assert.ok(!source.includes('DIRT'));
        assert.ok(!source.includes('rows: 4'));
    }
    assert.equal(editor.run('getActivitySummary(entry)'), 'Updated Shop Item Stone');
    assert.equal(editor.run('EditorChangeView.context(entry)'), 'Shop: blocks');
});

test('item additions, deletions, reordering, and shop settings remain visible', () => {
    const editor = editorContext();
    editor.set('before', { fileName: 'shops/blocks.yml', content: 'rows: 3\nitems: [{material: STONE}, {material: DIRT}]\n' });
    for (const source of ['rows: 4\nitems: [{material: STONE}, {material: DIRT}]\n',
        'rows: 3\nitems: [{material: DIRT}]\n', 'rows: 3\nitems: [{material: STONE}, {material: DIRT}, {material: COAL}]\n',
        'rows: 3\nitems: [{material: DIRT}, {material: STONE}]\n']) {
        editor.set('after', { fileName: 'shops/blocks.yml', content: source });
        editor.run('display = activityComparisonData(before, after, "file")');
        assert.notEqual(editor.run('formatActivityYaml(display.before)'), editor.run('formatActivityYaml(display.after)'));
    }
});

test('invalid historical YAML stays readable rather than breaking review', () => {
    const editor = editorContext();
    editor.set('before', { fileName: 'shops/blocks.yml', content: 'items: [\n' });
    editor.set('after', { fileName: 'shops/blocks.yml', content: 'items: []\n' });
    assert.equal(editor.run('formatActivityYaml(activityComparisonData(before, after, "file").before)'), 'items: [\n');
});

test('three-way conflicts retain item identity but omit all unchanged fields and items', () => {
    const editor = editorContext();
    const sources = [5, 10, 15].map(price => `rows: 4\nitems:\n- material: STONE\n  name: Stone\n  price: ${price}\n  sell-price: 2\n  amount: 16\n  stock-reset: {enabled: false, type: daily}\n- material: DIRT\n  price: 1\n`);
    editor.set('sources', sources);
    const projected = editor.run('EditorChangeView.conflictSources(sources)');
    projected.forEach((source, index) => {
        assert.match(source, /material: STONE/);
        assert.match(source, /name: Stone/);
        assert.match(source, new RegExp(`price: ${[5, 10, 15][index]}`));
        assert.doesNotMatch(source, /sell-price|stock-reset|amount|rows|DIRT/);
    });
    editor.set('projected', projected);
    const highlights = editor.run('EditorChangeView.changedLines(projected)');
    projected.forEach((source, column) => {
        const selected = [...highlights[column]].map(index => source.split(/\r?\n/)[index].trim());
        assert.deepEqual(selected, [`price: ${[5, 10, 15][column]}`]);
    });
    assert.match(sources[0], /stock-reset/);
});

test('three-way conflicts show a field changed by either side and do not lose deletions', () => {
    const editor = editorContext();
    editor.set('sources', ['items: {stone: {material: STONE, price: 5}}\n',
        'items: {stone: {material: STONE, price: 10}}\n', 'items: {stone: {material: STONE, price: 5, lore: [New]}}\n']);
    const selected = editor.run('EditorChangeView.conflictSources(sources)');
    assert.match(selected[0], /price: 5/);
    assert.match(selected[1], /price: 10/);
    assert.match(selected[2], /price: 5/);
    assert.match(selected[2], /New/);
    editor.set('sources', ['items: [{material: STONE, price: 5}]\n', null, 'items: [{material: STONE, price: 10}]\n']);
    const deleted = editor.run('EditorChangeView.conflictSources(sources)');
    assert.equal(deleted[1], null);
    assert.match(deleted[0], /STONE/);
    assert.match(deleted[2], /price: 10/);
});

test('conflicts safely fall back for invalid YAML and handle economy JSON', () => {
    const editor = editorContext();
    editor.set('sources', ['items: [\n', 'items: []\n', null]);
    assert.equal(editor.run('EditorChangeView.conflictSources(sources)[0]'), 'items: [\n');
    editor.set('sources', [5, 10, 15].map(price => JSON.stringify({ enabled: true, maxUnitPrice: price })));
    const selected = editor.run('EditorChangeView.conflictSources(sources, true)');
    selected.forEach((source, index) => assert.deepEqual(JSON.parse(source), { maxUnitPrice: [5, 10, 15][index] }));
});
