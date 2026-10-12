const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function editor() {
    const cards = [];
    const context = vm.createContext({
        customCommands: [], commandCatalog: {}, commandsFileRaw: '',
        guiSettings: {}, mainMenuSettings: {}, transactionSettings: {},
        document: {
            getElementById: () => ({ querySelectorAll: () => cards }),
            querySelector: selector => cards.find(card => selector.includes(`"${card.dataset.commandCard}"`))?.usage
        }
    });
    context.window = context;
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../../main/resources/web/js/commands.js'), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../../main/resources/web/vendor/yaml.min.js'), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../../main/resources/web/js/yaml-editor.js'), 'utf8'), context);
    context.EditorYaml = vm.runInContext('EditorYaml', context);
    function addCard(index, name, usage = `/${name}`) {
        const nameField = { dataset: { commandField: 'name' }, value: name };
        const usageField = { dataset: { commandField: 'usage' }, value: usage };
        cards.push({
            dataset: { commandCard: String(index) }, usage: usageField,
            querySelector: () => nameField,
            querySelectorAll: selector => selector === '[data-command-field]' ? [nameField, usageField] : []
        });
        return nameField;
    }
    return { context, cards, addCard };
}

test('validation and YAML saving use visible names instead of stale shop model values', () => {
    const { context, addCard } = editor();
    const names = ['shop-example', 'item-example', 'buy-item-example', 'sell-item-example', 'sellall-example', 'sellall-shop-example'];
    names.forEach((name, index) => {
        context.customCommands.push(context.createDefaultCustomCommand('shop'));
        context.customCommands[index].action.shop = 'blocks';
        addCard(index, name);
    });
    assert.equal(context.validateCustomCommandsForSave().length, 0);
    const yaml = context.generateCommandsYaml();
    names.forEach(name => assert.ok(yaml.includes(`  ${name}:\n`)));
    assert.ok(!yaml.includes('  shop:\n'));
    context.parseCommandsYaml(yaml);
    assert.deepEqual(Array.from(context.customCommands, command => command.name), names);
});

test('typing a name updates default usage but preserves a custom usage message', () => {
    const { context, cards, addCard } = editor();
    context.customCommands.push(context.createDefaultCustomCommand('old'));
    context.customCommands[0].usage = '/old';
    const input = addCard(0, 'old');
    input.value = 'renamed';
    context.updateCustomCommandValue(0, 'name', input.value);
    assert.equal(cards[0].usage.value, '/renamed');
    assert.equal(context.EditorYaml.parse(context.generateCommandsYaml()).commands.renamed.usage, '/renamed');
    context.customCommands[0].usage = '/renamed <amount>';
    cards[0].usage.value = '/renamed <amount>';
    input.value = 'another';
    context.updateCustomCommandValue(0, 'name', input.value);
    assert.equal(cards[0].usage.value, '/renamed <amount>');
});

test('actual duplicate names still block saving', () => {
    const { context, addCard } = editor();
    for (let index = 0; index < 2; index++) {
        const command = context.createDefaultCustomCommand(`command${index}`);
        command.action.shop = 'blocks';
        context.customCommands.push(command);
        addCard(index, 'same');
    }
    assert.ok(context.validateCustomCommandsForSave().some(error => error.includes("Duplicate command or alias 'same'")));
});

test('import validation does not overwrite imported commands with old cards', () => {
    const { context, addCard } = editor();
    context.customCommands.push(context.createDefaultCustomCommand('old'));
    addCard(0, 'old');
    context.parseCommandsYaml('commands:\n  imported:\n    enabled: false\n    action:\n      type: OPEN_SHOP\n      shop: blocks\n');
    assert.equal(context.validateCustomCommandsDetailed({ syncFromDom: false }).errors.length, 0);
    assert.equal(context.customCommands[0].name, 'imported');
});

test('untouched text inputs do not flatten multiline YAML strings', () => {
    const { context, addCard, cards } = editor();
    context.parseCommandsYaml('commands:\n  example:\n    description: |\n      First line\n      Second line\n    action:\n      type: OPEN_SHOP\n      shop: blocks\n');
    addCard(0, 'example');
    const originalQuery = cards[0].querySelectorAll;
    const description = { dataset: { commandField: 'description' },
        defaultValue: 'First line\nSecond line\n', value: 'First lineSecond line' };
    cards[0].querySelectorAll = selector => selector === '[data-command-field]'
        ? [...originalQuery(selector), description] : originalQuery(selector);
    assert.equal(context.EditorYaml.parse(context.generateCommandsYaml()).commands.example.description, 'First line\nSecond line\n');
});
