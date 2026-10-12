const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const editorContext = require('./editor-test-context.cjs');
const resources = path.join(__dirname, '../../main/resources');

test('every bundled shop round-trips unchanged, including comments and campaigns', () => {
    const editor = editorContext();
    for (const file of fs.readdirSync(path.join(resources, 'shops')).filter(file => file.endsWith('.yml'))) {
        const source = fs.readFileSync(path.join(resources, 'shops', file), 'utf8');
        editor.set('source', source);
        editor.set('filename', file);
        editor.run('currentShopFile = filename; parseShopYaml(source); updateExport();');
        assert.equal(editor.output.textContent, source, file);
    }
});

test('comments stay out of values and special text, unknown fields and schedules survive edits', () => {
    const editor = editorContext();
    const source = `# Shop comment
gui-name: "Player's #1 Shop" # Title comment
rows: 4
available-times: [FRIDAY-SUNDAY, '10:00AM-10:00PM'] # Schedule
custom-setting: {keep: true}
campaigns:
  - key: weekend
    name: "Player's Boost"
    custom-campaign-setting: 17
items:
  - material: IRON_BLOCK # Material comment
    name: 'Player''s Iron: #1' # Name comment
    price: 8600 # Base price
    custom-item-setting: {nested: 'keep me'}
    lore: ['First', '', 'It''s "quoted" # text']
    commands: ['say It''s #1: \\path']
    enchantments: {UNBREAKING: 3}
    stock-reset:
      enabled: true
      type: daily
      time: '10:00'
      timezone: Europe/Copenhagen
`;
    editor.set('source', source);
    editor.run('parseShopYaml(source);');
    assert.equal(editor.run('currentShopSettings.guiName'), "Player's #1 Shop");
    assert.equal(editor.run('items[0].name'), "Player's Iron: #1");
    assert.equal(editor.run('items[0].lore[1]'), '');
    editor.run(`items[0].price = 9000; items[0].name = "It's a new #1: \\\\path"; updateExport();`);
    const output = editor.output.textContent;
    editor.set('output', output);
    assert.equal(editor.run('EditorYaml.parse(output).items[0].price'), 9000);
    assert.equal(editor.run('EditorYaml.parse(output).items[0]["custom-item-setting"].nested'), 'keep me');
    assert.equal(editor.run('EditorYaml.parse(output).items[0].enchantments.UNBREAKING'), 3);
    assert.equal(editor.run('EditorYaml.parse(output).campaigns[0]["custom-campaign-setting"]'), 17);
    for (const comment of ['Shop comment', 'Title comment', 'Schedule', 'Material comment', 'Name comment', 'Base price']) assert.ok(output.includes(`# ${comment}`));
    editor.run('parseShopYaml(output);');
    assert.equal(editor.run('items[0].price'), 9000);
    assert.equal(editor.run('items[0].stockResetRule.timezone'), 'Europe/Copenhagen');
});

test('deleting, adding and reordering items keeps the surviving item comments and unknown settings', () => {
    const editor = editorContext();
    editor.set('source', 'items:\n  - material: STONE\n    name: One\n    custom: first # First\n  - material: DIRT\n    name: Two\n    custom: second # Second\n');
    editor.run('parseShopYaml(source); items.reverse(); items.pop(); updateExport();');
    assert.ok(editor.output.textContent.includes('second # Second'));
    assert.ok(!editor.output.textContent.includes('first # First'));
    editor.run('items.push(window.GeniusSchemas.normalizeShopItem({id: itemIdCounter++, material: "DIAMOND", name: "New"})); updateExport();');
    editor.set('output', editor.output.textContent);
    assert.equal(editor.run('EditorYaml.parse(output).items.length'), 2);
});

test('menus, GUI settings, commands and campaigns round-trip without changes', () => {
    const editor = editorContext();
    for (const [file, read, write] of [
        ['menus/main-menu.yml', 'parseMainMenuYaml', 'EditorYaml.writeMain()'],
        ['menus/purchase-menu.yml', 'parsePurchaseMenuYaml', "EditorYaml.writeTransaction('purchase')"],
        ['menus/sell-menu.yml', 'parseSellMenuYaml', "EditorYaml.writeTransaction('sell')"],
        ['menus/gui-settings.yml', 'parseGuiSettingsYaml', 'generateGuiSettingsYaml()'],
        ['commands.yml', 'parseCommandsYaml', 'generateCommandsYaml()'],
        ['campaigns.yml', 'parseCampaignsFileYaml', 'generateCampaignsFileYaml()']
    ]) {
        const source = file === 'campaigns.yml' ? '# Campaigns\ncampaigns: []\n' : fs.readFileSync(path.join(resources, file), 'utf8');
        editor.set('source', source);
        editor.run(`${read}(source)`);
        assert.equal(editor.run(write), source, file);
    }
});

test('menu text and amount-button edits escape apostrophes and preserve unedited fields', () => {
    const editor = editorContext();
    editor.set('source', fs.readFileSync(path.join(resources, 'menus/purchase-menu.yml'), 'utf8') + '\ncustom-field: preserve\n');
    editor.run(`parsePurchaseMenuYaml(source); transactionSettings.purchase.titlePrefix = "Player's Shop";
        transactionSettings.purchase.add.buttons['1'].name = "It's +1 # iron"; transactionSettings.purchase.displaySlot = 0;`);
    editor.set('output', editor.run("EditorYaml.writeTransaction('purchase')"));
    assert.equal(editor.run('EditorYaml.parse(output)["title-prefix"]'), "Player's Shop");
    assert.equal(editor.run('EditorYaml.parse(output).buttons.add["1"].name'), "It's +1 # iron");
    assert.equal(editor.run('EditorYaml.parse(output)["display-slot"]'), 0);
    assert.equal(editor.run('EditorYaml.parse(output)["custom-field"]'), 'preserve');
});

test('invalid syntax or duplicate keys cannot replace editor state or be saved', () => {
    const editor = editorContext();
    editor.run("parseShopYaml('items: []\\n')");
    assert.throws(() => editor.run("parseShopYaml(\"items:\\n  - name: 'Player's Item'\\n\")"), /Invalid YAML/);
    assert.throws(() => editor.run('updateExport()'), /Invalid YAML/);
    assert.throws(() => editor.run("EditorYaml.parse('rows: 3\\nrows: 4\\n')"), /Invalid YAML/);
    assert.throws(() => editor.run("parseShopYaml('items: {wrong: shape}\\n')"), /sequence/);
    assert.throws(() => editor.run('updateExport()'), /sequence/);
    editor.run("parseShopYaml('items: []\\n'); updateExport();");
    assert.equal(editor.output.textContent, 'items: []\n');
});

test('history ignores comment-only changes and displays nested value changes', () => {
    const editor = editorContext();
    assert.equal(editor.run("generateChangeSummary({content: '# old\\nrows: 3\\n'}, {content: '# new\\nrows: 3\\n'})"), '');
    const html = editor.run("generateChangeSummary({content: '# old\\nrows: 3\\n'}, {content: '# new\\nrows: 4\\n'})");
    assert.ok(html.includes('rows:'));
    assert.ok(!html.includes('# old'));
    assert.ok(!html.includes('\\n'));
});

test('editing a campaign keeps its unknown fields and comments', () => {
    const editor = editorContext();
    editor.set('source', 'campaigns:\n  - key: weekend\n    name: Old # Name\n    custom: 17\n');
    editor.run('parseCampaignsFileYaml(source); globalCampaigns[0].name = "Player\'s Weekend";');
    editor.set('output', editor.run('generateCampaignsFileYaml()'));
    assert.equal(editor.run('EditorYaml.parse(output).campaigns[0].name'), "Player's Weekend");
    assert.equal(editor.run('EditorYaml.parse(output).campaigns[0].custom'), 17);
    assert.ok(editor.run('output.includes("# Name")'));
});

test('new shop items omit optional defaults and unchecked flags', () => {
    const editor = editorContext();
    editor.run(`parseShopYaml('items: []\\n');
        items.push(window.GeniusSchemas.normalizeShopItem({id: itemIdCounter++, material: 'DIAMOND',
            name: 'Diamond', price: 100, sellPrice: 50, slot: 0})); updateExport();`);
    editor.set('output', editor.output.textContent);
    const item = JSON.parse(editor.run('JSON.stringify(EditorYaml.parse(output).items[0])'));
    assert.deepEqual(item, { material: 'DIAMOND', name: 'Diamond', price: 100, 'sell-price': 50, amount: 1, slot: 0 });
});

test('turning off optional flags removes keys and keeps comments and unknown fields', () => {
    const editor = editorContext();
    editor.set('source', `# Shop comment
items:
  - material: STONE # Material comment
    name: Stone
    custom: keep
    hide-attributes: true
    hide-additional: true
    require-name: true
    dynamic-pricing: true
`);
    editor.run(`parseShopYaml(source); items[0].hideAttributes = false; items[0].hideAdditional = false;
        items[0].requireName = false; items[0].dynamicPricing = false; updateExport();`);
    editor.set('output', editor.output.textContent);
    const item = JSON.parse(editor.run('JSON.stringify(EditorYaml.parse(output).items[0])'));
    for (const key of ['hide-attributes', 'hide-additional', 'require-name', 'dynamic-pricing']) {
        assert.equal(Object.hasOwn(item, key), false, key);
    }
    assert.equal(item.custom, 'keep');
    assert.ok(editor.output.textContent.includes('# Shop comment'));
    assert.ok(editor.output.textContent.includes('# Material comment'));
    editor.run('parseShopYaml(output); updateExport();');
    assert.equal(editor.output.textContent, editor.run('output'));
});

test('explicit false values that change defaults or override inherited settings survive', () => {
    const editor = editorContext();
    editor.run(`parseShopYaml('sell-adds-to-stock: true\\nstock-reset: {enabled: true, type: daily}\\nitems: []\\n');
        items.push(window.GeniusSchemas.normalizeShopItem({id: itemIdCounter++, material: 'STONE', name: 'Stone',
            buyPricePerItem: false, sellPricePerItem: false, runCommandOnly: false,
            sellAddsToStock: false, allowSellStockOverflow: false,
            stockResetRule: {...createDefaultStockResetRule(), enabled: true}})); updateExport();`);
    editor.set('output', editor.output.textContent);
    editor.run(`parseShopYaml(output); items[0].stockResetRule.enabled = false; updateExport();`);
    editor.set('output', editor.output.textContent);
    const item = JSON.parse(editor.run('JSON.stringify(EditorYaml.parse(output).items[0])'));
    for (const key of ['buy-price-per-item', 'sell-price-per-item', 'run-command-only',
        'sell-adds-to-stock', 'allow-sell-stock-overflow']) assert.equal(item[key], false, key);
    assert.equal(item['stock-reset'].enabled, false);
});

test('restoring default unit pricing removes a conflicting legacy price-per-item alias', () => {
    const editor = editorContext();
    editor.run(`parseShopYaml('items:\\n  - material: STONE\\n    price-per-item: false\\n');
        items[0].buyPricePerItem = true; updateExport();`);
    editor.set('output', editor.output.textContent);
    assert.equal(editor.run('EditorYaml.parse(output).items[0]["price-per-item"]'), undefined);
    editor.run('parseShopYaml(output);');
    assert.equal(editor.run('items[0].buyPricePerItem'), true);
});

test('main menu buttons omit unchecked flags when created or disabled', () => {
    const editor = editorContext();
    editor.run(`parseMainMenuYaml('items: {}\\n'); loadedGuiShops.push({key: 'new', slot: 0,
        material: 'CHEST', name: 'Shop', action: 'shop-key', shopKey: 'misc', commands: [],
        runAs: 'player', permission: '', lore: [], hideAttributes: false, hideAdditional: false});`);
    editor.set('output', editor.run('EditorYaml.writeMain()'));
    const button = JSON.parse(editor.run('JSON.stringify(EditorYaml.parse(output).items.new)'));
    assert.deepEqual(button, {slot: 0, material: 'CHEST', name: 'Shop', action: 'shop-key', 'shop-key': 'misc'});
    editor.run(`parseMainMenuYaml('items:\\n  existing:\\n    material: CHEST\\n    hide-attributes: true\\n');
        loadedGuiShops[0].hideAttributes = false;`);
    editor.set('output', editor.run('EditorYaml.writeMain()'));
    assert.equal(editor.run('EditorYaml.parse(output).items.existing["hide-attributes"]'), undefined);
});

test('checked flags are written and unrelated saves keep existing explicit defaults', () => {
    const editor = editorContext();
    editor.run(`parseShopYaml('items:\\n  - material: STONE\\n    price: 10\\n    hide-additional: false # Explicit default\\n');
        items[0].price = 20; items[0].hideAttributes = true; updateExport();`);
    editor.set('output', editor.output.textContent);
    assert.equal(editor.run('EditorYaml.parse(output).items[0]["hide-attributes"]'), true);
    assert.equal(editor.run('EditorYaml.parse(output).items[0]["hide-additional"]'), false);
    assert.ok(editor.output.textContent.includes('# Explicit default'));
    editor.run('parseShopYaml(output); updateExport();');
    assert.equal(editor.output.textContent, editor.run('output'));
});
