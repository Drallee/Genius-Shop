const assert = require('node:assert/strict');
const { test } = require('node:test');
const editorContext = require('./editor-test-context.cjs');

function setup() {
    const editor = editorContext();
    editor.set('language', { messages: { menus: { main: { title: '&aShop Menu', lore: ['', '&7Hello', '&e%player%'] }, gui: { price: '&6Buy: &a%price%' } } } });
    editor.run('translations = language');
    return editor;
}

test('editor resolves names, titles and multiline lore while leaving identifiers alone', () => {
    const editor = setup();
    assert.equal(editor.run("messageEditorValue('menus.main.title')"), '&aShop Menu');
    assert.equal(editor.run("messageEditorValue('menus.main.lore\\nLiteral lore', true)"), '\n&7Hello\n&e%player%\nLiteral lore');
    assert.equal(editor.run("messageEditorValue('geniusshop.admin')"), 'geniusshop.admin');
    assert.equal(editor.run("messageEditorValue('menus.missing.title')"), 'menus.missing.title');
});

test('displaying a reference preserves source until the field is changed', () => {
    const editor = setup();
    editor.set('input', { value: '', dataset: {} });
    editor.run("setMessageEditorInput(input, 'menus.main.lore', true)");
    assert.equal(editor.run('input.value'), '\n&7Hello\n&e%player%');
    assert.equal(editor.run('readMessageEditorInput(input)'), 'menus.main.lore');
    editor.run("input.value = '&7New lore'");
    assert.equal(editor.run('readMessageEditorInput(input)'), '&7New lore');
    assert.equal(editor.run("preserveMessageReference('menus.gui.price', '&6Buy: &a%price%')"), 'menus.gui.price');
    assert.equal(editor.run("preserveMessageReference('menus.gui.price', '&aCustom price')"), '&aCustom price');
});

test('language changes resolve the same stored reference without rewriting it', () => {
    const editor = setup();
    editor.run("translations.messages.menus.main.title = '&aButik';");
    assert.equal(editor.run("messageEditorValue('menus.main.title')"), '&aButik');
    assert.equal(editor.run("preserveMessageReference('menus.main.title', '&aButik')"), 'menus.main.title');
});

test('command message fields resolve values without resolving command names or permissions', () => {
    const editor = setup();
    assert(editor.run("commandInput(0, 'description', 'Description', 'menus.main.title', '')").includes('value="&amp;aShop Menu"'));
    assert(editor.run("commandInput(0, 'permission', 'Permission', 'menus.main.title', '')").includes('value="menus.main.title"'));
    editor.set('command', { description: 'menus.main.title', name: 'shop' });
    editor.run("applyCustomCommandFieldValue(command, 'description', '&aShop Menu')");
    assert.equal(editor.run('command.description'), 'menus.main.title');
    editor.run("applyCustomCommandFieldValue(command, 'description', 'New description')");
    assert.equal(editor.run('command.description'), 'New description');
});
