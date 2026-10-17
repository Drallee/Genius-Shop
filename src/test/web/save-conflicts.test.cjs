const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const editorContext = require('./editor-test-context.cjs');
const source = fs.readFileSync(path.resolve(__dirname, '../../main/resources/web/js/save-conflicts.js'), 'utf8');

function setup(fetch) {
    const context = editorContext();
    context.set('URL', URL);
    context.set('location', { href: 'http://localhost/prefix/editor/' });
    context.set('fetch', (url, options) => String(url).includes('api/language') ?
        Promise.resolve(new Response('{}', { status: 404 })) : fetch(url, options));
    context.run('sessionToken = "session"');
    context.run(source);
    context.run('EditorRevisions.seed({revisions: {"shops/a.yml": "original"}, shops: {"a.yml": "old"}})');
    return context;
}

test('every save carries its originally loaded revision and supports proxy prefixes', async () => {
    const calls = [];
    const context = setup(async (url, options) => {
        calls.push({ url, options });
        return new Response(JSON.stringify({ success: true, revision: 'accepted-' + calls.length }));
    });
    await context.run('EditorRevisions.request("api/file/shops/a.yml", {method: "POST", body: JSON.stringify({content: "one"})})');
    await context.run('EditorRevisions.request("api/file/shops/a.yml", {method: "POST", body: JSON.stringify({content: "two"})})');
    assert.equal(calls.length, 2, 'No last-second reload is allowed to silently replace the loaded revision');
    assert.equal(calls[0].options.headers['X-File-Revision'], 'original');
    assert.equal(calls[1].options.headers['X-File-Revision'], 'accepted-1');
    assert.equal(calls[0].options.headers['X-Session-Token'], 'session');
});

test('parallel requests capture the same loaded revision rather than auto-rebasing stale payloads', async () => {
    const revisions = [];
    let release;
    const held = new Promise(resolve => { release = resolve; });
    const context = setup(async (_url, options) => {
        revisions.push(options.headers['X-File-Revision']);
        await held;
        return new Response(JSON.stringify({ success: true, revision: 'saved' }));
    });
    const first = context.run('EditorRevisions.request("api/file/shops/a.yml", {method: "POST", body: "{\\"content\\":\\"one\\"}"})');
    const second = context.run('EditorRevisions.request("api/file/shops/a.yml", {method: "POST", body: "{\\"content\\":\\"two\\"}"})');
    release();
    await Promise.all([first, second]);
    assert.deepEqual(revisions, ['original', 'original']);
});

test('failed responses do not advance the revision, and new files explicitly expect absence', async () => {
    const revisions = [];
    const context = setup(async (_url, options) => {
        revisions.push(options.headers['X-File-Revision']);
        return new Response(JSON.stringify({ message: 'Failed' }), { status: 500 });
    });
    for (const file of ['a', 'a', 'new']) {
        await assert.rejects(context.run(`EditorRevisions.request("api/file/shops/${file}.yml", {method: "POST", body: JSON.stringify({content: "new"})})`), /Failed/);
    }
    assert.deepEqual(revisions, ['original', 'original', 'missing']);
});

test('late successful responses cannot replace the revision accepted by a newer request', async () => {
    let release;
    const held = new Promise(resolve => { release = resolve; });
    const revisions = [];
    const context = setup(async (_url, options) => {
        revisions.push(options.headers['X-File-Revision']);
        const number = revisions.length;
        if (number === 1) await held;
        return new Response(JSON.stringify({ success: true, revision: 'saved-' + number }));
    });
    const first = context.run('EditorRevisions.request("api/file/shops/a.yml", {method: "POST", body: JSON.stringify({content: "one"})})');
    await context.run('EditorRevisions.request("api/file/shops/a.yml", {method: "POST", body: JSON.stringify({content: "two"})})');
    release();
    await first;
    await context.run('EditorRevisions.request("api/file/shops/a.yml", {method: "DELETE"})');
    assert.deepEqual(revisions, ['original', 'original', 'saved-2']);
});

test('responses from before an explicit reload cannot overwrite the new loaded baseline', async () => {
    let release;
    const held = new Promise(resolve => { release = resolve; });
    const revisions = [];
    const context = setup(async (_url, options) => {
        revisions.push(options.headers['X-File-Revision']);
        if (revisions.length === 1) await held;
        return new Response(JSON.stringify({ success: true, revision: 'old-response' }));
    });
    const first = context.run('EditorRevisions.request("api/file/shops/a.yml", {method: "POST", body: JSON.stringify({content: "old"})})');
    context.run('EditorRevisions.seed({revisions: {"shops/a.yml": "reloaded"}, shops: {"a.yml": "latest"}})');
    release();
    await first;
    await context.run('EditorRevisions.request("api/file/shops/a.yml", {method: "DELETE"})');
    assert.deepEqual(revisions, ['original', 'reloaded']);
});

test('a server response without a revision never marks a local save as safely versioned', async () => {
    const revisions = [];
    const context = setup(async (_url, options) => {
        revisions.push(options.headers['X-File-Revision']);
        return new Response('{"success":true}');
    });
    for (let i = 0; i < 2; i++) await assert.rejects(context.run('EditorRevisions.request("api/file/shops/a.yml", {method: "DELETE"})'), /did not return a file revision/);
    assert.deepEqual(revisions, ['original', 'original']);
});

test('pending conflicts prevent both scheduled and already-queued autosaves', async () => {
    let callback, pending = false, saves = 0;
    const state = {};
    const context = vm.createContext({ console,
        EditorRevisions: { hasPending: () => pending }, localStorage: { getItem: () => 'true' },
        getEditorState: key => state[key], setEditorState: (key, value) => { state[key] = value; },
        setTimeout: fn => { callback = fn; return 1; }, clearTimeout: () => {},
        saveCurrentTabChanges: async () => { saves++; }
    });
    context.window = context;
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../main/resources/web/js/autosave-manager.js'), 'utf8'), context);
    vm.runInContext('scheduleEditorAutoSave()', context);
    pending = true;
    await callback();
    assert.equal(saves, 0);
    assert.equal(state.autoSaveTimeout, null);
    callback = null;
    vm.runInContext('scheduleEditorAutoSave()', context);
    assert.equal(callback, null);
});
