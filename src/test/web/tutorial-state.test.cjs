const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const context = vm.createContext({});
context.window = context;
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../main/resources/web/js/tutorial-state.js'), 'utf8'), context);
const create = context.EditorTutorialState.createProgress;
const shop = { id: 'shop', revision: 1 };
const commands = { id: 'commands', revision: 1 };
const catalog = [shop, commands];

function storage() {
    const values = new Map();
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('new users receive all available sections', () => {
    const progress = create(storage(), 'Alice');
    assert.equal(progress.firstRun(), true);
    assert.deepEqual(progress.pending(catalog), catalog);
});

test('completed and dismissed sections remain handled after a new session', () => {
    const store = storage();
    const progress = create(store, 'Alice');
    progress.handleFirstRun();
    progress.mark(shop, 'completed');
    progress.mark(commands, 'dismissed');
    const next = create(store, 'Alice');
    assert.equal(next.firstRun(), false);
    assert.equal(next.pending(catalog).length, 0);
    assert.equal(next.snapshot().sections.commands.status, 'dismissed');
});

test('updates onboard only new or revised sections, never the entire catalog', () => {
    const progress = create(storage(), 'Alice');
    progress.handleFirstRun();
    catalog.forEach(section => progress.mark(section, 'completed'));
    const updatedShop = { ...shop, revision: 2 };
    const data = { id: 'data', revision: 1 };
    assert.deepEqual(progress.pending([updatedShop, commands, data]), [updatedShop, data]);
    progress.mark(updatedShop, 'dismissed');
    progress.mark(data, 'dismissed');
    assert.equal(progress.pending([updatedShop, commands, data]).length, 0);
});

test('automatic new-feature preference persists without blocking manual progress updates', () => {
    const store = storage();
    const progress = create(store, 'Alice');
    progress.handleFirstRun();
    progress.setAutomatic(false);
    const next = create(store, 'Alice');
    assert.equal(next.pending(catalog).length, 0);
    next.mark(shop, 'completed');
    assert.equal(next.snapshot().sections.shop.status, 'completed');
    next.setAutomatic(true);
    assert.deepEqual(next.pending(catalog), [commands]);
});

test('progress is isolated per user, with case-insensitive names', () => {
    const store = storage();
    const progress = create(store, 'Alice');
    progress.handleFirstRun();
    progress.mark(shop, 'dismissed');
    assert.equal(create(store, ' alice ').pending([shop]).length, 0);
    assert.equal(create(store, 'Bob').pending([shop]).length, 1);
});

test('replaying and exiting does not downgrade a completed section', () => {
    const progress = create(storage(), 'Alice');
    progress.mark(shop, 'completed');
    progress.mark(shop, 'dismissed');
    assert.equal(progress.snapshot().sections.shop.status, 'completed');
    progress.mark({ ...shop, revision: 2 }, 'dismissed');
    assert.equal(progress.snapshot().sections.shop.revision, 2);
});

test('unavailable sections remain unseen until they become accessible', () => {
    const progress = create(storage(), 'Alice');
    progress.handleFirstRun();
    progress.mark(shop, 'completed');
    assert.equal(progress.pending([shop]).length, 0);
    assert.deepEqual(progress.pending(catalog), [commands]);
});

test('malformed stored data is ignored and state snapshots cannot mutate progress', () => {
    const store = { getItem: () => '{broken', setItem() {} };
    const progress = create(store, 'Alice');
    progress.mark(shop, 'completed');
    progress.snapshot().sections.shop.status = 'dismissed';
    assert.equal(progress.snapshot().sections.shop.status, 'completed');
    const invalid = create({ getItem: () => JSON.stringify({ sections: { shop: { revision: '1', status: 'other' } } }), setItem() {} }, 'Alice');
    assert.equal(Object.keys(invalid.snapshot().sections).length, 0);
});

test('unavailable browser storage does not prevent in-session progress', () => {
    const progress = create({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }, 'Alice');
    assert.equal(progress.handleFirstRun(), false);
    assert.equal(progress.mark(shop, 'completed'), false);
    assert.equal(progress.pending([shop]).length, 0);
});
