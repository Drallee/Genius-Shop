const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const editorContext = require('./editor-test-context.cjs');

test('draft preview derives actual before/after file contents even without activity summaries', () => {
    const editor = editorContext();
    editor.run(fs.readFileSync(path.join(__dirname, '../../main/resources/web/js/save-conflicts.js'), 'utf8'));
    editor.set('source', 'gui-name: Test\nitems: [{material: STONE, price: 5, amount: 16}]\n');
    editor.run('parseShopYaml(source); EditorRevisions.seed({revisions: {"shops/blocks.yml": "one"}, shops: {"blocks.yml": source}}); unsavedChanges = []');
    assert.equal(editor.run('EditorRevisions.pendingChanges().length'), 0);
    editor.run('items[0].price = 15');
    const changes = editor.run('EditorRevisions.pendingChanges()');
    assert.equal(changes.length, 1);
    assert.equal(changes[0].file, 'shops/blocks.yml');
    assert.equal(editor.run('EditorYaml.parse(EditorRevisions.pendingChanges()[0].before).items[0].price'), 5);
    assert.equal(editor.run('EditorYaml.parse(EditorRevisions.pendingChanges()[0].after).items[0].price'), 15);
    assert.equal(editor.run('unsavedChanges.length'), 0);
});

test('draft preview ignores comment-only differences and does not include unauthorized files', () => {
    const editor = editorContext();
    editor.run(fs.readFileSync(path.join(__dirname, '../../main/resources/web/js/save-conflicts.js'), 'utf8'));
    editor.set('source', 'items: [{material: STONE, price: 5}]\n');
    editor.run('parseShopYaml("# Extra comment\\n" + source); EditorRevisions.seed({revisions: {"shops/blocks.yml": "one"}, shops: {"blocks.yml": source}})');
    assert.equal(editor.run('EditorRevisions.pendingChanges().length'), 0);
    editor.run('items[0].price = 15; window.EditorPermissions = {canWriteFile: () => false}');
    assert.equal(editor.run('EditorRevisions.pendingChanges().length'), 0);
});
