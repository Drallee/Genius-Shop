const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

module.exports = function editorContext() {
    const output = { textContent: '' };
    const context = vm.createContext({
        console, setTimeout, clearTimeout,
        fetch: async () => ({ ok: false }),
        localStorage: { getItem: () => null, setItem: () => {} },
        location: { protocol: 'http:', host: 'localhost' },
        document: {
            getElementById: id => id === 'export-output' ? output : null,
            querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}
        }
    });
    context.window = context;
    const root = path.join(__dirname, '../../main/resources/web');
    for (const file of ['js/state-store.js', 'js/core.js', 'js/schema.js', 'vendor/yaml.min.js',
        'js/yaml-editor.js', 'js/database.js', 'js/commands.js', 'js/modals.js']) {
        vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
    }
    return {
        run: source => vm.runInContext(source, context),
        set: (key, value) => { context[key] = value; },
        output
    };
};
