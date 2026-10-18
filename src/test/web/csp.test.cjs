const assert = require('node:assert/strict');
const { test } = require('node:test');
const editorContext = require('./editor-test-context.cjs');

test('test context rejects both eval and the Function constructor', () => {
    const editor = editorContext();
    assert.throws(() => editor.run('eval("1 + 1")'), /Code generation from strings disallowed/);
    assert.throws(() => editor.run('new Function("return 2")()'), /Code generation from strings disallowed/);
});

test('YAML parsing and editing work with string code generation disabled', () => {
    const editor = editorContext();
    editor.set('source', '# Keep this comment\nitems:\n  - material: STONE\n    price: 10\n');
    editor.run('parseShopYaml(source); items[0].price = 15; updateExport()');
    assert.match(editor.output.textContent, /# Keep this comment/);
    assert.match(editor.output.textContent, /price: 15/);
    assert.equal(editor.run('EditorYaml.parse("value: &value {enabled: false}\\ncopy: *value").copy.enabled'), false);
});

test('state store getters, updates and subscriptions do not require dynamic compilation', () => {
    const editor = editorContext();
    assert.equal(editor.run(`(() => {
        const store = EditorStateStore.createStore({ count: 0 });
        let calls = 0;
        const unsubscribe = store.subscribe(() => calls++);
        store.set('count', 1);
        store.patch({ count: 2 });
        unsubscribe();
        store.set('count', 3);
        return store.get('count') === 3 && calls === 2;
    })()`), true);
});
