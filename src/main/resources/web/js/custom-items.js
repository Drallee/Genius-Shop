let customItemsFileRaw = 'items: {}\n';
let customItemsConfig = { items: {} };
const customItemTriggers = ['right-click-container', 'right-click-air', 'right-click-block'];
const customItemActions = ['SELL_CONTAINER', 'OPEN_MAIN_MENU', 'OPEN_SHOP', 'OPEN_BULK_SELL_MENU', 'COMMAND'];

function parseCustomItemsYaml(source) {
    const data = EditorYaml.parse(source);
    if (!data.items || typeof data.items !== 'object' || Array.isArray(data.items)) throw new Error('items must be a mapping');
    for (const [id, item] of Object.entries(data.items)) {
        if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(id) || !item || typeof item !== 'object' || Array.isArray(item)) {
            throw new Error(`Invalid custom item: ${id}`);
        }
    }
    customItemsFileRaw = source;
    customItemsConfig = data;
}

function changeCustomItem(id, path, value, redraw = false) {
    const before = customItemsFileRaw;
    const optional = ['permission', 'lore', 'enchantments', 'cooldown-seconds', 'max-uses'];
    if (path.length === 1 && optional.includes(path[0]) &&
        (value === '' || value === 0 || (Array.isArray(value) && value.length === 0))) value = undefined;
    const next = EditorYaml.edit(before, ['items', id, ...path], value);
    parseCustomItemsYaml(next);
    addActivityEntry('updated', 'custom-item', {content: before}, {content: next}, {itemId: id});
    scheduleAutoSave();
    if (redraw) renderCustomItemsTab();
}

function changeCustomItemCommands(id, trigger, value) {
    const action = {...customItemsConfig.items[id].actions[trigger],
        commands: value.split('\n').map(command => command.trim()).filter(Boolean)};
    delete action.command;
    changeCustomItem(id, ['actions', trigger], action);
}

function setCustomItemAction(id, trigger, type) {
    const existing = customItemsConfig.items[id]?.actions?.[trigger];
    let action;
    if (type) {
        action = { ...(existing || {}), type };
        for (const key of ['shop', 'multiplier', 'use-campaigns', 'commands', 'command', 'run-as']) delete action[key];
        if (type === 'SELL_CONTAINER') Object.assign(action, {multiplier: 1, 'use-campaigns': true});
        if (type === 'OPEN_SHOP') action.shop = Object.keys(loadedShopFiles || {})[0]?.replace(/\.yml$/, '') || 'blocks';
        if (type === 'COMMAND') action.commands = ['shop'];
    }
    changeCustomItem(id, ['actions', trigger], action, true);
}

function addCustomItem() {
    let id = 'new-item';
    for (let suffix = 2; customItemsConfig.items[id]; suffix++) id = `new-item-${suffix}`;
    changeCustomItem(id, [], {material: 'BLAZE_ROD', name: '&6New Item',
        actions: {'right-click-container': {type: 'SELL_CONTAINER', multiplier: 1, 'use-campaigns': true}}}, true);
}

async function deleteCustomItem(id) {
    if (!(await showConfirm(`Delete ${id}?`))) return;
    changeCustomItem(id, [], undefined, true);
}

function duplicateCustomItem(id) {
    let next = `${id.slice(0, 55)}-copy`;
    for (let suffix = 2; customItemsConfig.items[next]; suffix++) next = `${id.slice(0, 55)}-copy-${suffix}`;
    changeCustomItem(next, [], JSON.parse(JSON.stringify(customItemsConfig.items[id])), true);
}

function renameCustomItem(id, next) {
    if (next === id) return;
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(next) || customItemsConfig.items[next]) {
        showToast('Item ID must be unique and use lowercase letters, numbers, hyphens or underscores.', 'error');
        renderCustomItemsTab();
        return;
    }
    const before = customItemsFileRaw;
    const doc = ShopYamlLibrary.parseDocument(before);
    const mapping = doc.get('items', true);
    mapping.items.find(pair => pair.key.value === id).key.value = next;
    parseCustomItemsYaml(doc.toString({lineWidth: 0}));
    addActivityEntry('updated', 'custom-item', {content: before}, {content: customItemsFileRaw}, {itemId: next});
    scheduleAutoSave();
    renderCustomItemsTab();
}

function customItemInput(id, path, label, value, type = 'text') {
    const numeric = type === 'number';
    const expression = numeric ? 'Number(this.value)' : 'this.value';
    return `<div class="setting-item"><label>${escapeHtml(label)}
        <input class="input-base" type="${type}" ${numeric ? 'min="0" step="any"' : ''}
        value="${escapeHtml(String(value ?? ''))}" onchange='changeCustomItem(${JSON.stringify(id)}, ${JSON.stringify(path)}, ${expression})'></label></div>`;
}

function renderCustomItemsTab() {
    const container = document.getElementById('custom-items-container');
    if (!container) return;
    const entries = Object.entries(customItemsConfig.items);
    document.getElementById('custom-items-count').textContent = `${entries.length} items`;
    container.innerHTML = entries.length ? entries.map(([id, item]) => `
        <section class="command-card card-base">
            <div class="command-card-header">
                <div class="flex items-center gap-12"><img width="32" height="32" alt="" src="${TEXTURE_API}${encodeURIComponent(String(item.material || 'BLAZE_ROD').toLowerCase())}.png">
                    <div class="campaign-hub-title">${escapeHtml(id)}</div></div>
                <div class="command-card-actions">
                    <label class="command-toggle"><input type="checkbox" ${item.enabled !== false ? 'checked' : ''}
                        onchange='changeCustomItem(${JSON.stringify(id)}, ["enabled"], this.checked)'>Enabled</label>
                    <button class="btn btn-secondary" title="Duplicate item" onclick='duplicateCustomItem(${JSON.stringify(id)})'><i class="fa-solid fa-copy"></i></button>
                    <button class="btn btn-danger" title="Delete item" onclick='deleteCustomItem(${JSON.stringify(id)})'><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
            <div class="command-grid">
                <div class="setting-item"><label>Item ID<input class="input-base" value="${escapeHtml(id)}"
                    onchange='renameCustomItem(${JSON.stringify(id)}, this.value)'></label></div>
                ${customItemInput(id, ['material'], 'Material', item.material || 'BLAZE_ROD')}
                ${customItemInput(id, ['name'], 'Name', item.name || id)}
                ${customItemInput(id, ['permission'], 'Permission', item.permission || '')}
                ${customItemInput(id, ['cooldown-seconds'], 'Cooldown (seconds)', item['cooldown-seconds'] || 0, 'number')}
                ${customItemInput(id, ['max-uses'], 'Maximum uses (0 = unlimited)', item['max-uses'] || 0, 'number')}
                <div class="setting-item"><label>Lore<textarea class="input-base" rows="3"
                    onchange='changeCustomItem(${JSON.stringify(id)}, ["lore"], this.value ? this.value.split("\\n") : [])'>${escapeHtml((item.lore || []).join('\n'))}</textarea></label></div>
            </div>
            ${customItemTriggers.map(trigger => {
                const action = item.actions?.[trigger] || {};
                const types = customItemActions.filter(type => trigger === 'right-click-container' || type !== 'SELL_CONTAINER');
                return `<div class="custom-item-action"><div class="command-grid">
                    <div class="setting-item"><label>${escapeHtml(trigger.replaceAll('-', ' '))}<select class="input-base"
                        onchange='setCustomItemAction(${JSON.stringify(id)}, ${JSON.stringify(trigger)}, this.value)'>
                        <option value="">None</option>${types.map(type => `<option ${action.type === type ? 'selected' : ''}>${type}</option>`).join('')}</select></label></div>
                    ${['SELL_CONTAINER', 'OPEN_SHOP'].includes(action.type) ? customItemInput(id, ['actions', trigger, 'shop'], 'Shop', action.shop || '') : ''}
                    ${action.type === 'SELL_CONTAINER' ? `${customItemInput(id, ['actions', trigger, 'multiplier'], 'Sell multiplier', action.multiplier ?? 1, 'number')}
                        <label class="command-toggle"><input type="checkbox" ${action['use-campaigns'] !== false ? 'checked' : ''}
                            onchange='changeCustomItem(${JSON.stringify(id)}, ["actions", ${JSON.stringify(trigger)}, "use-campaigns"], this.checked)'>Use campaigns</label>` : ''}
                    ${action.type === 'COMMAND' ? `<div class="setting-item"><label>Run as<select class="input-base"
                        onchange='changeCustomItem(${JSON.stringify(id)}, ["actions", ${JSON.stringify(trigger)}, "run-as"], this.value)'>
                        <option value="player">Player</option><option value="console" ${action['run-as'] === 'console' ? 'selected' : ''}>Console</option></select></label></div>
                        <div class="setting-item"><label>Commands<textarea class="input-base" rows="3"
                            onchange='changeCustomItemCommands(${JSON.stringify(id)}, ${JSON.stringify(trigger)}, this.value)'>${escapeHtml((action.commands || (action.command ? [action.command] : [])).join('\n'))}</textarea></label></div>` : ''}
                </div></div>`;
            }).join('')}
        </section>`).join('') : '<div class="commands-empty">No custom items</div>';
}

async function saveCustomItemsYaml(isSilent = false) {
    if (isLoadingFiles) return;
    const source = customItemsFileRaw;
    const response = await fetch('api/file/custom-items.yml', {method: 'POST',
        headers: {'Content-Type': 'application/json', 'X-Session-Token': sessionToken}, body: JSON.stringify({content: source})});
    if (response.status === 401) { logout(); throw new Error('Session expired'); }
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || error.error || 'Could not save custom items');
    }
    if (source === customItemsFileRaw) setUnsavedChanges(unsavedChanges.filter(change => change.target !== 'custom-item'));
    if (!isSilent) showToast('Custom items saved', 'success');
    return true;
}

function exportCustomItemsYaml() {
    const url = URL.createObjectURL(new Blob([customItemsFileRaw], {type: 'text/yaml'}));
    const link = document.createElement('a');
    link.href = url; link.download = 'custom-items.yml'; link.click(); URL.revokeObjectURL(url);
}

async function importCustomItemsYaml(file) {
    if (!file) return;
    try {
        const before = customItemsFileRaw;
        parseCustomItemsYaml(await file.text());
        addActivityEntry('updated', 'custom-item', {content: before}, {content: customItemsFileRaw});
        renderCustomItemsTab(); scheduleAutoSave();
    } catch (error) { showToast(error.message, 'error'); }
}
