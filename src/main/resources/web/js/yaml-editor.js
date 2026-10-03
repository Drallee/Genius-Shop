// Comment-preserving YAML documents are kept separately from editable values.
const EditorYaml = (() => {
    const library = ShopYamlLibrary;
    const documents = new Map();
    const invalidDocuments = new Map();
    const clone = value => JSON.parse(JSON.stringify(value));
    const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const kebab = key => key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
    const object = value => value && typeof value === 'object' && !Array.isArray(value);
    const list = value => Array.isArray(value) ? value.map(String) : value == null ? [] : [String(value)];
    const defaults = {
        gui: clone(guiSettings), main: clone(mainMenuSettings), transaction: clone(transactionSettings)
    };

    function parse(source) {
        const doc = library.parseDocument(String(source || ''), {
            version: '1.1', stringKeys: true,
            customTags: tags => tags.filter(tag => tag.tag !== 'tag:yaml.org,2002:timestamp')
        });
        if (doc.errors.length) throw new Error(`Invalid YAML: ${doc.errors[0].message}`);
        const value = doc.toJS({ maxAliasCount: 100 });
        if (value != null && !object(value)) throw new Error('YAML configuration must be a mapping.');
        return { doc, value: value || {} };
    }

    function remember(key, source, baseline) {
        parse(source);
        documents.set(key, { source, baseline: clone(baseline) });
    }

    function readChecked(key, source) {
        try {
            const parsed = parse(source);
            const collectionKey = key.startsWith('shop:') || key === 'main' ? 'items'
                : key === 'commands' ? 'commands' : key === 'campaigns' ? 'campaigns' : 'buttons';
            const collection = parsed.value[collectionKey];
            const sequence = key.startsWith('shop:') || key === 'campaigns';
            if (collection != null && (sequence ? !Array.isArray(collection) : !object(collection))) {
                throw new Error(`${collectionKey} must be a YAML ${sequence ? 'sequence' : 'mapping'}.`);
            }
            if (collection != null) {
                const rows = sequence ? collection : Object.values(collection);
                if (rows.some(row => !object(row))) throw new Error(`${collectionKey} entries must be YAML mappings.`);
            }
            invalidDocuments.delete(key);
            return parsed;
        } catch (error) {
            invalidDocuments.set(key, error.message);
            throw error;
        }
    }

    function decode(defaultValues, data) {
        const result = clone(defaultValues);
        Object.keys(result).forEach(key => {
            const value = data?.[key === 'stockResetRule' ? 'stock-reset' : kebab(key)];
            if (value === undefined) return;
            if (key === 'stockResetRule') result[key] = sanitizeStockResetRule(decode({ ...createDefaultStockResetRule(), enabled: true }, value));
            else if (Array.isArray(result[key])) result[key] = list(value);
            else if (object(result[key])) result[key] = decode(result[key], value);
            else result[key] = value;
        });
        return result;
    }

    function encode(model) {
        const result = {};
        Object.entries(model).forEach(([key, value]) => {
            if (key === 'id' || key === 'key' || key.startsWith('_yaml')) return;
            const yamlKey = key === 'stockResetRule' ? 'stock-reset' : kebab(key);
            result[yamlKey] = key === 'enchantments' ? clone(value) : object(value) ? encode(value) : value;
        });
        return result;
    }

    // Patch only model changes, leaving unknown fields and node comments untouched.
    function patch(doc, path, before, after) {
        if (equal(before, after)) return;
        if (path.length === 3 && path[0] === 'items' && path.at(-1) === 'commands') {
            doc.deleteIn([...path.slice(0, -1), 'command']);
        }
        const node = doc.getIn(path, true);
        if (object(after) && (before === undefined || object(before)) && library.isMap(node)) {
            for (const key of new Set([...Object.keys(before || {}), ...Object.keys(after)])) {
                patch(doc, [...path, key], before?.[key], after[key]);
            }
        } else if (Array.isArray(before) && Array.isArray(after) && library.isSeq(node)) {
            const original = node.items.slice();
            node.items = after.map((value, index) => {
                const oldIndex = object(value) && value.key != null
                    ? before.findIndex(row => row?.key === value.key) : index;
                const old = original[oldIndex];
                if (old && equal(before[oldIndex], value)) return old;
                if (old && object(value) && library.isMap(old)) {
                    const temporary = new library.Document({});
                    temporary.set('row', old.clone());
                    patch(temporary, ['row'], before[oldIndex], value);
                    return temporary.get('row', true);
                }
                const next = doc.createNode(value);
                if (old) { next.comment = old.comment; next.commentBefore = old.commentBefore; }
                return next;
            });
        } else if (after === undefined || after === null) {
            doc.deleteIn(path);
        } else if (library.isScalar(node) && !object(after) && !Array.isArray(after)) {
            node.value = after;
        } else {
            const next = doc.createNode(after);
            if (node) { next.comment = node.comment; next.commentBefore = node.commentBefore; }
            doc.setIn(path, next);
        }
    }

    function write(key, after, extraPatch) {
        if (invalidDocuments.has(key)) throw new Error(invalidDocuments.get(key));
        const state = documents.get(key);
        if (state && !extraPatch && equal(state.baseline, after)) return state.source;
        const { doc } = parse(state?.source || '{}\n');
        patch(doc, [], state?.baseline || {}, after);
        if (extraPatch) extraPatch(doc, state?.baseline);
        const output = doc.toString({ lineWidth: 0 });
        parse(output);
        return output;
    }

    function edit(source, path, value) {
        const { doc, value: original } = parse(source);
        const before = path.reduce((data, key) => data?.[key], original);
        patch(doc, path, before, value);
        const output = doc.toString({ lineWidth: 0 });
        parse(output);
        return output;
    }

    function campaign(data) {
        return decode({ key: '', name: '', start: '', end: '', timezone: '', buyMultiplier: 1, sellMultiplier: 1 }, data);
    }
    function campaignData(model) { return { key: model.key, ...encode(model) }; }

    function shopSettings(data) {
        const result = decode({ guiName: '&8Shop', rows: 3, permission: '', campaign: '',
            sellAddsToStock: false, allowSellStockOverflow: false, stockResetRule: createDefaultStockResetRule() }, data);
        result.availableTimes = list(data['available-times']).join('\n');
        result.campaigns = (data.campaigns || []).map(campaign);
        return window.GeniusSchemas.normalizeShopSettings(result);
    }

    function shopItem(data, id) {
        const base = window.GeniusSchemas.normalizeShopItem({ id });
        const result = decode(base, data);
        result.id = id;
        if (data['price-per-item'] !== undefined && data['buy-price-per-item'] === undefined) result.buyPricePerItem = data['price-per-item'];
        result.enchantments = clone(data.enchantments || {});
        const normalized = window.GeniusSchemas.normalizeShopItem(result);
        normalized.lore = list(data.lore);
        return normalized;
    }

    function shopData() {
        const data = encode(currentShopSettings);
        data['available-times'] = String(currentShopSettings.availableTimes || '').split(/\r?\n/).filter(line => line.trim());
        data.campaigns = (currentShopSettings.campaigns || []).map(campaignData);
        return data;
    }

    function readShop(source, retain = true) {
        const { value } = retain ? readChecked(`shop:${currentShopFile}`, source) : parse(source);
        if (value.items != null && !Array.isArray(value.items)) throw new Error('Shop items must be a YAML sequence.');
        const nextSettings = shopSettings(value);
        const nextItems = (value.items || []).map((row, index) => {
            if (!object(row)) throw new Error(`Shop item ${index + 1} must be a mapping.`);
            return shopItem(row, index);
        });
        currentShopSettings = nextSettings;
        items = nextItems;
        itemIdCounter = items.length;
        initializeShopItemSlots();
        if (retain) {
            remember(`shop:${currentShopFile}`, source, shopData());
            documents.get(`shop:${currentShopFile}`).items = items.map(item => ({ id: item.id, data: encode(item) }));
        }
    }

    function writeShop() {
        const key = `shop:${currentShopFile}`;
        const state = documents.get(key);
        if (invalidDocuments.has(key)) throw new Error(invalidDocuments.get(key));
        if (state && equal(state.baseline, shopData())
            && equal(state.items, items.map(item => ({ id: item.id, data: encode(item) })))) return state.source;
        return write(key, shopData(), doc => {
            const sequence = doc.get('items', true);
            const originals = library.isSeq(sequence) ? sequence.items : [];
            const nextSequence = doc.createNode([]);
            if (sequence) { nextSequence.comment = sequence.comment; nextSequence.commentBefore = sequence.commentBefore; }
            nextSequence.items = items.map(item => {
                const index = state?.items?.findIndex(original => original.id === item.id) ?? -1;
                const sourceNode = index >= 0 ? originals[index] : null;
                const row = sourceNode ? sourceNode.clone() : doc.createNode({});
                const temporary = new library.Document({});
                temporary.set('item', row);
                patch(temporary, ['item'], index >= 0 ? state.items[index].data : {}, encode(item));
                return temporary.get('item', true);
            });
            doc.set('items', nextSequence);
        });
    }

    function readMain(source) {
        const { value } = readChecked('main', source);
        mainMenuSettings = decode(defaults.main, value);
        loadedGuiShops = Object.entries(value.items || {}).map(([key, row]) => ({ key,
            ...decode({ slot: null, material: 'CHEST', name: key, lore: [], action: '', shopKey: '', commands: [],
                runAs: 'player', permission: '', hideAttributes: false, hideAdditional: false, closeAfterAction: false }, row),
            commands: list(row.commands ?? row.command)
        }));
        remember('main', source, mainData());
    }
    function mainData() {
        const data = { ...encode(mainMenuSettings), items: {} };
        loadedGuiShops.forEach(row => {
            const model = clone(row);
            if (!model.action && model.shopKey) model.action = 'shop-key';
            if (model.closeAfterAction && model.action === 'command') model.action = 'command-close';
            data.items[row.key] = encode(model);
        });
        return data;
    }

    function readTransaction(type, source) {
        const { value } = readChecked(type, source);
        const base = clone(defaults.transaction[type]);
        base.rows = 6;
        const settings = decode(base, value);
        settings.buttons = {};
        for (const [key, row] of Object.entries(value.buttons || {})) {
            if (['add', 'remove', 'set'].includes(key)) {
                settings[key] = { material: row.material || 'STONE', buttons: {} };
                Object.entries(row).forEach(([amount, button]) => {
                    if (amount !== 'material' && object(button)) settings[key].buttons[amount] = decode({ name: '', slot: 0 }, button);
                });
            } else if (object(row)) settings.buttons[key] = decode({ material: 'STONE', name: '', slot: 0 }, row);
        }
        transactionSettings[type] = settings;
        remember(type, source, transactionData(type));
    }
    function transactionData(type) {
        const data = encode(transactionSettings[type]);
        for (const group of ['add', 'remove', 'set']) {
            const model = transactionSettings[type][group];
            data.buttons[group] = { material: model.material, ...clone(model.buttons) };
            delete data[group];
        }
        // The runtime uses the camel-case sellAll button key.
        if (data.buttons['sell-all']) { data.buttons.sellAll = data.buttons['sell-all']; delete data.buttons['sell-all']; }
        return data;
    }

    function readGui(source) {
        const { value } = readChecked('gui', source);
        guiSettings = decode(defaults.gui, value.gui || {});
        remember('gui', source, { gui: encode(guiSettings) });
    }
    function readCampaigns(source) {
        const { value } = readChecked('campaigns', source);
        globalCampaigns = (value.campaigns || []).map(campaign);
        remember('campaigns', source, { campaigns: globalCampaigns.map(campaignData) });
    }

    function readCommands(source, retain = true) {
        const { value } = retain ? readChecked('commands', source) : parse(source);
        const next = Object.entries(value.commands || {}).map(([name, row]) => {
            const base = createDefaultCustomCommand(name);
            base.usage = `/${name}`;
            const command = decode(base, row);
            command.name = name;
            command._yamlSourceKey = name;
            command.action = { ...base.action, ...row.action };
            return command;
        });
        commandsFileRaw = source;
        customCommands = next;
        if (retain) remember('commands', source, commandsData());
    }
    function commandsData() {
        const data = { commands: {} };
        customCommands.forEach(command => {
            const row = encode(command);
            delete row.name;
            data.commands[command.name] = row;
        });
        return data;
    }
    function writeCommands() {
        if (invalidDocuments.has('commands')) throw new Error(invalidDocuments.get('commands'));
        collectCustomCommandsFromDom();
        const state = documents.get('commands');
        if (state && equal(state.baseline, commandsData())) return state.source;
        const { doc } = parse(state?.source || 'commands: {}\n');
        const oldMap = doc.get('commands', true);
        const next = doc.createNode({});
        if (oldMap) { next.comment = oldMap.comment; next.commentBefore = oldMap.commentBefore; }
        customCommands.forEach(command => {
            const oldKey = command._yamlSourceKey;
            const row = oldKey && library.isMap(oldMap) ? oldMap.get(oldKey, true)?.clone() : null;
            const temporary = new library.Document({});
            temporary.set('row', row || temporary.createNode({}));
            const data = encode(command);
            delete data.name;
            patch(temporary, ['row'], state?.baseline.commands[oldKey] || {}, data);
            const originalPair = library.isMap(oldMap) ? oldMap.items.find(pair => pair.key?.value === oldKey) : null;
            const keyNode = originalPair?.key?.clone() || doc.createNode(command.name);
            keyNode.value = command.name;
            next.add({ key: keyNode, value: temporary.get('row', true) });
        });
        doc.set('commands', next);
        const output = doc.toString({ lineWidth: 0 });
        parse(output);
        return output;
    }

    return { parse: source => parse(source).value, edit, readShop, writeShop, readMain,
        writeMain: () => write('main', mainData()), readTransaction,
        writeTransaction: type => write(type, transactionData(type)), readGui,
        writeGui: () => write('gui', { gui: encode(guiSettings) }), readCampaigns,
        writeCampaigns: () => write('campaigns', { campaigns: globalCampaigns.map(campaignData) }),
        readCommands, writeCommands };
})();
