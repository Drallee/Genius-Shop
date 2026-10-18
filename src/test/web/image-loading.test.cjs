const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const editorContext = require('./editor-test-context.cjs');

function setup() {
    const editor = editorContext();
    const links = [];
    editor.set('document', {
        addEventListener() {},
        head: { appendChild: link => links.push(link) },
        getElementById: id => links.find(link => link.id === id) || null,
        createElement: () => ({ getAttribute(name) { return this[name] ?? null; } })
    });
    editor.run(fs.readFileSync(path.join(__dirname, '../../main/resources/web/js/ui.js'), 'utf8'));
    return { editor, links };
}

test('the preview preload is reused when selecting another material', () => {
    const { editor, links } = setup();
    editor.run("prioritizePreviewTexture('https://example.com/potion.png')");
    editor.run("prioritizePreviewTexture('https://example.com/potion.png')");
    assert.equal(links.length, 1);
    assert.equal(links[0].rel, 'preload');
    assert.equal(links[0].as, 'image');
    assert.equal(links[0].fetchPriority, 'high');
    editor.run("prioritizePreviewTexture('https://example.com/stone.png')");
    assert.equal(links.length, 1);
    assert.equal(links[0].href, 'https://example.com/stone.png');
});

test('only list images sharing the primary texture are eager and high priority', () => {
    const { editor } = setup();
    editor.run("prioritizePreviewTexture('https://example.com/potion.png')");
    assert.equal(editor.run("listImageLoadingAttributes('https://example.com/potion.png')"),
        'loading="eager" fetchpriority="high"');
    assert.equal(editor.run("listImageLoadingAttributes('https://example.com/stone.png')"),
        'loading="lazy" fetchpriority="low"');
});
