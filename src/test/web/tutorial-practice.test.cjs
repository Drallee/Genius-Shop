const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const editorContext = require('./editor-test-context.cjs');
const read = file => fs.readFileSync(path.join(__dirname, '../../main/resources/web/js', file), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

function editor(fetch) {
    const e = editorContext();
    e.set('URL', URL);
    e.set('fetch', fetch || (async () => new Response('{"success":true}', { headers: { 'Content-Type': 'application/json' } })));
    for (const name of ['renderItems', 'renderMainMenuShops', 'renderCampaignsTab', 'renderCommandsTab', 'renderCustomItemsTab', 'renderGuiSettings']) e.set(name, () => {});
    e.run(read('custom-items.js'));
    e.run("parseShopYaml('gui-name: Original\\nitems:\\n  - material: GOLD_INGOT\\n    name: Unsaved draft\\n    price: 18\\n'); allShops = {'blocks.yml': 'original source'}; setUnsavedChanges([{target: 'shop-item'}]);");
    e.run(read('tutorial-practice.js'));
    return e;
}

test('practice uses sample items and restores original drafts, history, references, and YAML', () => {
    const e = editor();
    e.run('window.originalItems = items; window.originalGui = guiSettings; window.originalChanges = unsavedChanges; window.originalYaml = EditorYaml.writeShop();');
    assert.equal(e.run('EditorTutorialPractice.begin()'), true);
    assert.equal(e.run('items.length'), 2);
    e.run("items[0].material = 'DIAMOND'; guiSettings.backButton.name = 'Practice back'; items.push({...items[0], id: 5}); activityLog.push({id: 'practice'}); setUnsavedChanges([]);");
    e.run('EditorTutorialPractice.end()');
    assert.equal(e.run('items === window.originalItems'), true);
    assert.equal(e.run('guiSettings === window.originalGui'), true);
    assert.equal(e.run('unsavedChanges === window.originalChanges'), true);
    assert.equal(e.run('EditorYaml.writeShop() === window.originalYaml'), true);
    assert.equal(e.run('items[0].name'), 'Unsaved draft');
    assert.equal(e.run('activityLog.some(entry => entry.id === "practice")'), false);
});

test('practice does not overwrite a real shop with the sample filename', () => {
    const e = editor();
    e.run("allShops['tutorial-practice.yml'] = 'real configuration';");
    e.run('EditorTutorialPractice.begin()');
    assert.notEqual(e.run('currentShopFile'), 'tutorial-practice.yml');
    e.run('EditorTutorialPractice.end()');
    assert.equal(e.run("allShops['tutorial-practice.yml']"), 'real configuration');
});

test('all API writes and reloads are blocked during practice but work normally afterward', async () => {
    const calls = [];
    const e = editor(async (url, options) => { calls.push({ url, options }); return new Response('{}'); });
    e.run('EditorTutorialPractice.begin()');
    for (const request of ["fetch('api/file/shops/test.yml', {method: 'POST'})", "fetch('api/database', {method: 'DELETE'})", "fetch('api/reload')", "fetch('/editor/api/file/test.yml', {method: 'POST'})"]) {
        await assert.rejects(e.run(request), /Practice only/);
    }
    assert.equal(calls.filter(call => call.options.method === 'POST' || call.options.method === 'DELETE').length, 0);
    await e.run("fetch('api/stock-analytics')");
    e.run('EditorTutorialPractice.end()');
    await e.run("fetch('api/file/shops/test.yml', {method: 'POST'})");
    assert.equal(calls.filter(call => call.options.method === 'POST').length, 1);
});

test('an open user dialog and an in-flight save prevent practice from starting', () => {
    const e = editor();
    e.run("currentModalData = {title: 'Unsaved user dialog'};");
    assert.equal(e.run('EditorTutorialPractice.begin()'), false);
    assert.equal(e.run('currentModalData.title'), 'Unsaved user dialog');
    e.run('currentModalData = null; isSaving = true;');
    assert.equal(e.run('EditorTutorialPractice.begin()'), false);
    assert.equal(e.run('items[0].name'), 'Unsaved draft');
});

test('practice waits for a pending API response body before replacing editor models', async () => {
    let body;
    const e = editor(async (url, options) => options.method === 'POST' ?
        new Response(new ReadableStream({ start(controller) { body = controller; } })) : new Response('{}', { status: 404 }));
    await e.run("fetch('api/file/test.yml', {method: 'POST'})");
    assert.equal(e.run('EditorTutorialPractice.begin()'), false);
    body.enqueue(new TextEncoder().encode('{}')); body.close();
    for (let attempt = 0; attempt < 30 && !e.run('EditorTutorialPractice.isActive()'); attempt++) {
        await tick();
        e.run('EditorTutorialPractice.begin()');
    }
    assert.equal(e.run('EditorTutorialPractice.isActive()'), true);
    e.run('EditorTutorialPractice.end()');
});

test('autosave is paused during the tutorial without changing the user preference', async () => {
    const e = editor();
    let callback;
    e.set('setTimeout', fn => { callback = fn; return 99; });
    e.set('clearTimeout', () => {});
    e.set('EditorTutorial', { isActive: () => true });
    e.run(read('autosave-manager.js'));
    e.run("setEditorState('isLoadingFiles', false); scheduleEditorAutoSave();");
    assert.equal(callback, undefined);
    e.set('EditorTutorial', { isActive: () => false });
    e.run('scheduleEditorAutoSave()');
    assert.equal(typeof callback, 'function');
    e.set('EditorTutorial', { isActive: () => true });
    await callback();
    assert.equal(e.run("getEditorState('autoSaveTimeout')"), null);
});
