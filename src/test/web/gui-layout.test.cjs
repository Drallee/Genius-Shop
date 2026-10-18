const assert = require('node:assert/strict');
const { test } = require('node:test');
const editorContext = require('./editor-test-context.cjs');

test('shared automatic layout edits fit smaller shops and repair inherited slot conflicts', () => {
    const editor = editorContext();
    editor.run('renderGuiSettings = () => {}; updatePreview = () => {}; scheduleAutoSave = () => {}; addActivityEntry = () => {}');
    editor.run(`allShops = { 'small.yml': 'rows: 3\\nitems: []', 'large.yml': 'rows: 5\\nitems: []' }; currentShopFile = 'large.yml'; currentShopSettings.rows = 5;
        guiSettings.searchButton.slot = 45; guiSettings.favoritesButton.slot = 46; guiSettings.recentButton.slot = 47;
        guiSettings.layout.contentSlots = [0, 0, 28, 29, 30, 31, 32]; guiSettings.layout.emptySlots = [47]; GuiLayout.repair();`);
    assert.equal(editor.run('guiSettings.layout.rows'), 0);
    assert.equal(editor.run('guiSettings.searchButton.slot'), -1);
    assert.deepEqual(Array.from(editor.run('guiSettings.layout.contentSlots')), [0]);
    assert.deepEqual(Array.from(editor.run('guiSettings.layout.emptySlots')), []);
    editor.run("GuiLayout.setPaint('buttons'); GuiLayout.chooseButton('recentButton'); GuiLayout.paint(35)");
    assert.equal(editor.run('guiSettings.recentButton.slot'), 35);
    editor.run("GuiLayout.setRows(6); guiSettings.layout.emptySlots = [47]; currentShopSettings.layout = {rows: 6, buttons: {searchButton: {slot: 47}}}; GuiLayout.selectScope('large.yml'); GuiLayout.repair()");
    assert.equal(editor.run('currentShopSettings.layout.buttons.searchButton.slot'), 47);
    assert.deepEqual(Array.from(editor.run('currentShopSettings.layout.emptySlots')), []);
    assert.deepEqual(Array.from(editor.run('guiSettings.layout.emptySlots')), [47], 'Repairing a shop must not change shared defaults');
    editor.run('GuiLayout.setRows(3)');
    const layout = editor.run('GuiLayout.current()');
    assert.ok(Array.from(layout.controls).every(button => button.slot < 27));
    assert.ok(Array.from(layout.contentSlots).every(slot => slot < 27));
    assert.equal(editor.run('currentShopSettings.layout.buttons.searchButton.enabled'), true);
});

test('discovery layouts save independently, round-trip, and reset to shared defaults', () => {
    const editor = editorContext();
    editor.run('renderGuiSettings = () => {}; updatePreview = () => {}; scheduleAutoSave = () => {}; addActivityEntry = () => {}');
    editor.run('currentShopSettings.layout = {rows: 2}; guiSettings.layout.rows = 6');
    for (const [mode, rows] of [['search', 3], ['favorites', 4], ['recent', 5]]) {
        editor.run(`GuiLayout.selectScope('discovery:${mode}')`);
        assert.equal(editor.run('GuiLayout.isShopScope()'), false);
        assert.equal(editor.run('GuiLayout.selectedSettings().layout.rows'), 6);
        editor.run(`GuiLayout.setRows(${rows})`);
        assert.equal(editor.run('GuiLayout.targetFile()'), 'menus/gui-settings.yml');
    }
    editor.run("GuiLayout.selectScope('discovery:search'); GuiLayout.setPaint('empty'); GuiLayout.paint(0)");
    editor.run('parseGuiSettingsYaml(generateGuiSettingsYaml())');
    const result = editor.run('EditorYaml.parse(generateGuiSettingsYaml())');
    assert.equal(result.gui.discovery.search.rows, 3);
    assert.deepEqual(Array.from(result.gui.discovery.search['empty-slots']), [0]);
    assert.equal(result.gui.discovery.favorites.rows, 4);
    assert.equal(result.gui.discovery.recent.rows, 5);
    assert.equal(result.gui.layout.rows, 6);
    assert.equal(editor.run('currentShopSettings.layout.rows'), 2);
    editor.run('GuiLayout.reset()');
    assert.equal(editor.run('GuiLayout.selectedSettings().layout.rows'), 6);
    assert.equal(editor.run('EditorYaml.parse(generateGuiSettingsYaml()).gui.discovery.search'), undefined);
});

test('shared layout preserves defaults and matches sparse chest coordinates', () => {
    const editor = editorContext();
    let layout = JSON.parse(editor.run('JSON.stringify(GuiLayout.resolve(guiSettings, 3))'));
    assert.equal(layout.size, 36);
    assert.equal(layout.capacity, 27);
    assert.equal(layout.controls.find(button => button.key === 'backButton').slot, 31);
    editor.run('guiSettings.layout.rows = 3; guiSettings.layout.contentSlots = [10,11,12,13,14,15,16]; guiSettings.searchButton.slot = 26');
    layout = JSON.parse(editor.run('JSON.stringify(GuiLayout.resolve(guiSettings, 5))'));
    assert.equal(layout.size, 27);
    assert.deepEqual(layout.contentSlots, [10,11,12,13,14,15,16]);
    assert.equal(layout.controls.find(button => button.key === 'searchButton').slot, 26);
    assert.equal(editor.run('GuiLayout.resolve(guiSettings, 5, false).controls.some(button => button.key === "searchButton")'), false);
});

test('GUI layout YAML preserves numeric slots, appearance, and unrelated settings', () => {
    const editor = editorContext();
    editor.set('source', 'gui:\n  layout: {rows: 3, content-slots: [10, 11, 12]}\n  search-button: {material: COMPASS, slot: 18, hide-additional: false}\n  unknown: retained\n');
    editor.run('parseGuiSettingsYaml(source)');
    assert.equal(editor.run('typeof guiSettings.layout.contentSlots[0]'), 'number');
    editor.run('guiSettings.searchButton.material = "PAPER"');
    const result = editor.run('EditorYaml.parse(generateGuiSettingsYaml())');
    assert.deepEqual(Array.from(result.gui.layout['content-slots']), [10,11,12]);
    assert.equal(result.gui['search-button'].material, 'PAPER');
    assert.equal(result.gui['search-button']['hide-additional'], false);
    assert.equal(result.gui.unknown, 'retained');
});

test('per-shop layout overrides round-trip and do not change shared defaults', () => {
    const editor = editorContext();
    editor.set('source', 'rows: 5\nlayout:\n  rows: 3\n  content-slots: [10, 11]\n  buttons:\n    search-button: {slot: 0, material: PAPER}\n  filler: {enabled: true, material: BLUE_STAINED_GLASS_PANE}\nitems: [{material: STONE, price: 1}]\nunknown: retained\n');
    editor.run('parseShopYaml(source)');
    assert.equal(editor.run('GuiLayout.current().size'), 27);
    assert.equal(editor.run('GuiLayout.current().capacity'), 2);
    assert.equal(editor.run('GuiLayout.current().controls.find(button => button.key === "searchButton").slot'), 0);
    assert.equal(editor.run('guiSettings.searchButton.material'), 'COMPASS');
    editor.run('currentShopSettings.layout.rows = 4');
    const result = editor.run('EditorYaml.parse(EditorYaml.writeShop())');
    assert.equal(result.layout.rows, 4);
    assert.equal(result.rows, 5);
    assert.deepEqual(Array.from(result.layout['content-slots']), [10,11]);
    assert.equal(result.layout.buttons['search-button'].material, 'PAPER');
    assert.equal(result.unknown, 'retained');
});
