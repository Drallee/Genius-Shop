const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const editorContext = require('./editor-test-context.cjs');
const drafts = fs.readFileSync(path.resolve(__dirname, '../../main/resources/web/js/drafts.js'), 'utf8');

test('draft writes are serialized and carry the revision returned by the previous save', async () => {
    const context = editorContext();
    const headers = [];
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    context.run('sessionToken = "session"');
    context.set('fetch', async (_url, options) => {
        headers.push(options.headers);
        if (headers.length === 1) await pending;
        return new Response(JSON.stringify({ draft: { revision: String(headers.length), changedFiles: headers.length } }));
    });
    context.run(drafts);
    context.run('EditorDrafts.setState({revision: "0", changedFiles: 0})');
    const first = context.run('EditorDrafts.request("api/file/shops/a.yml", {method: "POST"})');
    const second = context.run('EditorDrafts.request("api/file/shops/b.yml", {method: "POST"})');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(headers.length, 1);
    release();
    await Promise.all([first, second]);
    assert.equal(headers[0]['X-Draft-Revision'], '0');
    assert.equal(headers[1]['X-Draft-Revision'], '1');
    assert.equal(headers[0]['X-Session-Token'], 'session');
});

test('a rejected save keeps the revision and does not break subsequent validation', async () => {
    const context = editorContext();
    const headers = [];
    context.run('sessionToken = "session"');
    context.set('fetch', async (url, options) => {
        headers.push(options.headers);
        return url.includes('review') ? new Response(JSON.stringify({ draft: { revision: '2', changedFiles: 1 } })) :
            new Response(JSON.stringify({ message: 'Draft changed in another tab' }), { status: 409 });
    });
    context.run(drafts);
    context.run('EditorDrafts.setState({revision: "0", changedFiles: 0})');
    await assert.rejects(context.run('EditorDrafts.request("api/file/shops/a.yml", {method: "POST"})'), /another tab/);
    await context.run('EditorDrafts.request("api/draft/review")');
    await assert.rejects(context.run('EditorDrafts.request("api/file/shops/a.yml", {method: "POST"})'), /another tab/);
    assert.equal(headers[1]['X-Draft-Revision'], '0');
    assert.equal(headers[2]['X-Draft-Revision'], '2');
});

test('draft saves also enforce per-file revisions while serializing workspace updates', async () => {
    const context = editorContext();
    const calls = [];
    context.set('URL', URL);
    context.set('location', { href: 'http://localhost/editor/' });
    context.run('sessionToken = "session"');
    context.set('fetch', async (url, options) => {
        calls.push({ url, headers: options.headers });
        return new Response(JSON.stringify({ success: true, revision: 'file-' + calls.length,
            draft: { revision: 'draft-' + calls.length, changedFiles: calls.length } }));
    });
    context.run(fs.readFileSync(path.resolve(__dirname, '../../main/resources/web/js/save-conflicts.js'), 'utf8'));
    context.run(drafts);
    context.run('EditorRevisions.seed({revisions: {"shops/a.yml": "a-original", "shops/b.yml": "b-original"}, shops: {"a.yml": "a", "b.yml": "b"}})');
    context.run('EditorDrafts.setState({revision: "draft-0", changedFiles: 0})');
    await Promise.all(['a', 'b', 'a'].map(file => context.run(`EditorDrafts.request("api/file/shops/${file}.yml", {method: "POST", body: JSON.stringify({content: "edited"})})`)));
    await context.run('EditorDrafts.request("api/draft/review")');
    assert.deepEqual(calls.slice(0, 3).map(call => call.headers['X-File-Revision']), ['a-original', 'b-original', 'file-1']);
    assert.deepEqual(calls.map(call => call.headers['X-Draft-Revision']), ['draft-0', 'draft-1', 'draft-2', 'draft-3']);
    assert.equal(calls[3].headers['X-File-Revision'], undefined);
});

test('autosave only saves a draft even when the legacy mode is publish', async () => {
    let callback;
    let saves = 0, publishes = 0;
    const state = {};
    const context = vm.createContext({ console,
        localStorage: { getItem: key => key === 'autoSaveMode' ? 'publish' : 'true' },
        getEditorState: key => state[key], setEditorState: (key, value) => { state[key] = value; },
        setTimeout: fn => { callback = fn; return 1; }, clearTimeout: () => {},
        saveCurrentTabChanges: async () => { saves++; }, publishAllChanges: async () => { publishes++; }
    });
    context.window = context;
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '../../main/resources/web/js/autosave-manager.js'), 'utf8'), context);
    vm.runInContext('scheduleEditorAutoSave()', context);
    await callback();
    assert.equal(saves, 1);
    assert.equal(publishes, 0);
    assert.equal(state.autoSaveTimeout, null);
    context.EditorDrafts = { isReviewing: () => true };
    await callback();
    assert.equal(saves, 1);
});
