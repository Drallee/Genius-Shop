// ===== CUSTOM COMMANDS EDITOR =====

const COMMAND_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const COMMAND_ACTION_TYPES = ['OPEN_SHOP', 'OPEN_ITEM', 'SELL_ALL'];
const COMMAND_MENU_MODES = ['BOTH', 'BUY', 'SELL'];
const PROTECTED_CUSTOM_COMMANDS = new Set(['shop', 'geniusshop', 'minecraft', 'bukkit', 'spigot', 'paper', 'reload', 'plugins', 'pl', 'version', 'ver']);

function createDefaultCustomCommand(name) {
    return {
        name: name || nextCustomCommandName(),
        enabled: false,
        aliases: [],
        description: 'Custom shop command',
        usage: '',
        permission: '',
        noPermissionMessage: '',
        shopBypassPermission: '',
        action: {
            type: 'OPEN_SHOP',
            shop: firstCommandShopKey(),
            item: '',
            menu: 'BOTH'
        }
    };
}

function nextCustomCommandName() {
    const used = new Set((customCommands || []).map(c => String(c.name || '').toLowerCase()));
    let index = 1;
    while (used.has(`command${index}`)) index++;
    return `command${index}`;
}

function parseCommandsYaml(yamlContent) {
    commandsFileRaw = typeof yamlContent === 'string' ? yamlContent : '';
    customCommands = [];
    const lines = commandsFileRaw.split(/\r?\n/);
    let inCommands = false;
    let current = null;
    let currentList = '';
    let inAction = false;

    lines.forEach(line => {
        const raw = line.replace(/\r$/, '');
        const trimmed = raw.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const indent = raw.search(/\S/);

        if (indent === 0) {
            inCommands = trimmed === 'commands:';
            current = null;
            currentList = '';
            inAction = false;
            return;
        }
        if (!inCommands) return;

        if (indent === 2 && trimmed.endsWith(':') && !trimmed.startsWith('-')) {
            const name = unquoteYaml(trimmed.slice(0, -1).trim());
            current = createDefaultCustomCommand(name);
            current.usage = `/${name}`;
            customCommands.push(current);
            currentList = '';
            inAction = false;
            return;
        }
        if (!current) return;

        if (indent === 4) {
            inAction = false;
            currentList = '';
            const pair = splitYamlPair(trimmed);
            if (!pair) return;
            const key = pair.key;
            const value = pair.value;
            if (key === 'aliases') {
                current.aliases = [];
                currentList = 'aliases';
            } else if (key === 'action') {
                inAction = true;
            } else if (key === 'enabled') {
                current.enabled = parseYamlBoolean(value, true);
            } else if (key === 'description') {
                current.description = unquoteYaml(value);
            } else if (key === 'usage') {
                current.usage = unquoteYaml(value);
            } else if (key === 'permission') {
                current.permission = unquoteYaml(value);
            } else if (key === 'no-permission-message') {
                current.noPermissionMessage = unquoteYaml(value);
            } else if (key === 'shop-bypass-permission') {
                current.shopBypassPermission = unquoteYaml(value);
            }
            return;
        }

        if (indent === 6 && currentList === 'aliases' && trimmed.startsWith('-')) {
            current.aliases.push(unquoteYaml(trimmed.substring(1).trim()));
            return;
        }
        if (indent === 6 && inAction) {
            const pair = splitYamlPair(trimmed);
            if (!pair) return;
            if (pair.key === 'type') current.action.type = normalizeActionType(pair.value);
            else if (pair.key === 'shop') current.action.shop = unquoteYaml(pair.value);
            else if (pair.key === 'item') current.action.item = unquoteYaml(pair.value);
            else if (pair.key === 'menu') current.action.menu = normalizeMenuMode(pair.value);
        }
    });
}

function splitYamlPair(trimmed) {
    const index = trimmed.indexOf(':');
    if (index < 0) return null;
    return {
        key: unquoteYaml(trimmed.substring(0, index).trim()),
        value: trimmed.substring(index + 1).trim()
    };
}

function unquoteYaml(value) {
    let text = String(value || '').trim();
    const hashIndex = text.indexOf(' #');
    if (hashIndex >= 0) text = text.substring(0, hashIndex).trim();
    if ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"'))) {
        text = text.substring(1, text.length - 1);
    }
    return text.replace(/''/g, "'");
}

function parseYamlBoolean(value, fallback) {
    const text = unquoteYaml(value).toLowerCase();
    if (['true', 'yes', 'on'].includes(text)) return true;
    if (['false', 'no', 'off'].includes(text)) return false;
    return fallback;
}

function normalizeCommandToken(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^[^a-z0-9]+/, '')
        .substring(0, 32);
}

function normalizeActionType(value) {
    const text = unquoteYaml(value).toUpperCase().replace(/-/g, '_');
    return COMMAND_ACTION_TYPES.includes(text) ? text : text;
}

function normalizeMenuMode(value) {
    const text = unquoteYaml(value).toUpperCase().replace(/-/g, '_');
    return COMMAND_MENU_MODES.includes(text) ? text : text;
}

function commandShopEntries() {
    const catalog = commandCatalog || {};
    return Object.keys(catalog).sort((a, b) => a.localeCompare(b)).map(key => ({
        key,
        name: catalog[key] && catalog[key].name ? catalog[key].name : key,
        items: Array.isArray(catalog[key] && catalog[key].items) ? catalog[key].items : []
    }));
}

function firstCommandShopKey() {
    const shops = commandShopEntries();
    return shops.length > 0 ? shops[0].key : '';
}

function commandItemsForShop(shopKey) {
    const shop = (commandCatalog || {})[shopKey];
    return shop && Array.isArray(shop.items) ? shop.items.slice().sort((a, b) => String(a.key || '').localeCompare(String(b.key || ''))) : [];
}

function markCommandsDirty(action, beforeData, afterData) {
    addActivityEntry(action || 'updated', 'custom-command', beforeData || null, afterData || null);
    renderCommandsValidation();
    scheduleAutoSave();
}

function cloneCustomCommand(command) {
    return JSON.parse(JSON.stringify(command || {}));
}

function rememberCustomCommandBefore(element, index) {
    const command = customCommands[index];
    if (!element || !command) return;
    element.dataset.commandBefore = JSON.stringify(cloneCustomCommand(command));
}

function getRememberedCustomCommandBefore(element, index) {
    if (element && element.dataset.commandBefore) {
        try {
            return JSON.parse(element.dataset.commandBefore);
        } catch (e) {
            console.warn('Failed to parse command edit snapshot:', e);
        } finally {
            delete element.dataset.commandBefore;
        }
    }
    return cloneCustomCommand(customCommands[index]);
}

function renderCommandsTab() {
    const countEl = document.getElementById('commands-count');
    const container = document.getElementById('commands-container');
    if (!container) return;

    if (countEl) {
        const enabled = (customCommands || []).filter(c => c.enabled).length;
        countEl.textContent = `${customCommands.length} command${customCommands.length === 1 ? '' : 's'} (${enabled} enabled)`;
    }

    if (!customCommands || customCommands.length === 0) {
        container.innerHTML = `
            <div class="commands-empty card-base">
                <div class="campaign-hub-title">No custom commands</div>
                <div class="stock-item-sub">Create a command to write entries into commands.yml.</div>
            </div>
        `;
        renderCommandsValidation();
        return;
    }

    container.innerHTML = customCommands.map((command, index) => renderCommandCard(command, index)).join('');
    renderCommandsValidation();
    if (typeof initCustomSelects === 'function') initCustomSelects();
}

function renderCommandCard(command, index) {
    const action = command.action || {};
    const type = action.type || 'OPEN_SHOP';
    const showShop = type === 'OPEN_SHOP' || type === 'OPEN_ITEM' || type === 'SELL_ALL';
    const showItem = type === 'OPEN_ITEM';
    const showMenu = type === 'OPEN_ITEM';
    const shops = commandShopEntries();
    const itemOptions = action.shop ? commandItemsForShop(action.shop) : [];
    const aliases = Array.isArray(command.aliases) ? command.aliases.join(', ') : '';

    return `
        <section class="command-card card-base" data-command-card="${index}">
            <div class="command-card-header">
                <div>
                    <div class="campaign-hub-title">${escapeHtml(command.name || 'new-command')}</div>
                    <div class="stock-item-sub">${escapeHtml(type)}${command.enabled ? ' | enabled' : ' | disabled'}</div>
                </div>
                <div class="command-card-actions">
                    <label class="command-toggle">
                        <input type="checkbox" data-command-index="${index}" data-command-field="enabled" ${command.enabled ? 'checked' : ''} onchange="updateCustomCommand(${index}, 'enabled', this.checked)">
                        Enabled
                    </label>
                    <button class="btn btn-secondary" onclick="duplicateCustomCommand(${index})">DUPLICATE</button>
                    <button class="btn btn-danger" onclick="deleteCustomCommand(${index})">DELETE</button>
                </div>
            </div>

            <div class="command-grid">
                ${commandInput(index, 'name', 'Command Name', command.name, 'buy-diamonds')}
                ${commandInput(index, 'aliases', 'Aliases', aliases, 'alias-one, alias-two')}
                ${commandInput(index, 'description', 'Description', command.description, 'Opens the diamond shop')}
                ${commandInput(index, 'usage', 'Usage Message', command.usage, '/buy-diamonds')}
                ${commandInput(index, 'permission', 'Permission', command.permission, 'geniusshop.command.example')}
                ${commandInput(index, 'noPermissionMessage', 'No Permission Message', command.noPermissionMessage, '<red>You do not have permission.')}
                ${commandInput(index, 'shopBypassPermission', 'Shop Bypass Permission', command.shopBypassPermission, 'geniusshop.command.example.bypass')}
                <div class="setting-item">
                    <label>Action Type</label>
                    <select class="premium-select" data-command-index="${index}" data-command-action-field="type" onchange="updateCustomCommandAction(${index}, 'type', this.value)">
                        ${COMMAND_ACTION_TYPES.map(v => `<option value="${v}" ${type === v ? 'selected' : ''}>${v}</option>`).join('')}
                    </select>
                </div>
                ${showShop ? commandSelectOrTypeField({
                    index,
                    field: 'shop',
                    label: type === 'SELL_ALL' ? 'Shop Scope' : 'Shop',
                    value: action.shop || '',
                    placeholder: type === 'SELL_ALL' ? 'Blank = all shops' : 'main',
                    options: shops.map(shop => ({
                        value: shop.key,
                        label: `${shop.key}${shop.name && shop.name !== shop.key ? ` - ${stripMinecraftColorCodes(shop.name)}` : ''}`,
                        colorLabel: `${shop.key}${shop.name && shop.name !== shop.key ? ` - ${shop.name}` : ''}`
                    })),
                    includeBlank: type === 'SELL_ALL',
                    blankLabel: 'All shops'
                }) : ''}
                ${showItem ? commandSelectOrTypeField({
                    index,
                    field: 'item',
                    label: 'Item',
                    value: action.item || '',
                    placeholder: action.shop ? 'diamond' : 'Select or type a shop first',
                    options: itemOptions.map(item => ({
                        value: item.key || '',
                        label: `${item.key || ''}${item.material ? ` - ${item.material}` : ''}${item.name ? ` - ${stripMinecraftColorCodes(item.name)}` : ''}`,
                        colorLabel: `${item.key || ''}${item.material ? ` - ${item.material}` : ''}${item.name ? ` - ${item.name}` : ''}`
                    })),
                    disabled: !action.shop,
                    includeBlank: true,
                    blankLabel: 'Select item...'
                }) : ''}
                ${showMenu ? `
                    <div class="setting-item">
                        <label>Menu Mode</label>
                        <select class="premium-select" data-command-index="${index}" data-command-action-field="menu" onchange="updateCustomCommandAction(${index}, 'menu', this.value)">
                            ${COMMAND_MENU_MODES.map(v => `<option value="${v}" ${(action.menu || 'BOTH') === v ? 'selected' : ''}>${v}</option>`).join('')}
                        </select>
                    </div>
                ` : ''}
            </div>
        </section>
    `;
}

function commandInput(index, field, label, value, placeholder) {
    const isCommandName = field === 'name';
    return `
        <div class="setting-item">
            <label>${escapeHtml(label)}</label>
            <input type="text"
                class="input-base"
                name="gs-command-${index}-${field}"
                data-command-index="${index}"
                data-command-field="${field}"
                autocomplete="new-password"
                autocorrect="off"
                autocapitalize="none"
                spellcheck="false"
                value="${escapeHtml(value || '')}"
                placeholder="${escapeHtml(placeholder || '')}"
                onfocus="rememberCustomCommandBefore(this, ${index})"
                oninput="updateCustomCommandValue(${index}, '${field}', this.value)"
                onchange="commitCustomCommandField(this, ${index}, '${field}', this.value)"
                ${isCommandName ? 'aria-label="Command Name"' : ''}>
        </div>
    `;
}

function commandSelectOrTypeField(config) {
    const options = Array.isArray(config.options) ? config.options : [];
    const suggestions = options.map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label || option.value)}</option>`).join('');
    const disabled = config.disabled ? 'disabled' : '';
    const listId = `command-${config.field}-suggestions-${config.index}`;
    const selected = options.find(option => option.value === config.value);
    const preview = selected
        ? (selected.colorLabel && typeof parseMinecraftColors === 'function' ? parseMinecraftColors(selected.colorLabel) : escapeHtml(selected.label || selected.value))
        : (config.value ? escapeHtml(config.value) : escapeHtml(config.blankLabel || ''));

    return `
        <div class="setting-item">
            <label>${escapeHtml(config.label)}</label>
            <div class="command-typeahead-field">
                <input type="text"
                    class="input-base"
                    name="gs-command-${config.index}-action-${config.field}"
                    data-command-index="${config.index}"
                    data-command-action-field="${config.field}"
                    list="${listId}"
                    autocomplete="new-password"
                    autocorrect="off"
                    autocapitalize="none"
                    spellcheck="false"
                    value="${escapeHtml(config.value || '')}"
                    placeholder="${escapeHtml(config.placeholder || '')}"
                    ${disabled}
                    onfocus="rememberCustomCommandBefore(this, ${config.index})"
                    oninput="updateCustomCommandActionValue(${config.index}, '${config.field}', this.value)"
                    onchange="commitCustomCommandActionField(this, ${config.index}, '${config.field}', this.value)">
                <datalist id="${listId}">
                    ${config.includeBlank ? `<option value="">${escapeHtml(config.blankLabel || 'None')}</option>` : ''}
                    ${suggestions}
                </datalist>
                <div class="command-selected-preview ${selected ? '' : 'muted'}">${preview || '&nbsp;'}</div>
            </div>
        </div>
    `;
}

function stripMinecraftColorCodes(value) {
    if (typeof stripMinecraftDisplayCodes === 'function') return stripMinecraftDisplayCodes(value);
    return String(value || '')
        .replace(/<gradient:[^>]+>([\s\S]*?)<\/gradient>/gi, '$1')
        .replace(/&[0-9a-fk-or]/gi, '')
        .replace(/&#[0-9a-fA-F]{6}/gi, '');
}

function updateCustomCommand(index, field, value) {
    const command = customCommands[index];
    if (!command) return;
    const before = cloneCustomCommand(command);
    applyCustomCommandFieldValue(command, field, value, before);
    const after = cloneCustomCommand(command);
    renderCommandsTab();
    markCommandsDirty('updated', before, after);
}

function commitCustomCommandField(element, index, field, value) {
    const command = customCommands[index];
    if (!command) return;
    const before = getRememberedCustomCommandBefore(element, index);
    applyCustomCommandFieldValue(command, field, value, before);
    const after = cloneCustomCommand(command);
    markCommandsDirty('updated', before, after);
}

function updateCustomCommandValue(index, field, value) {
    const command = customCommands[index];
    if (!command) return;
    applyCustomCommandFieldValue(command, field, value);
}

function applyCustomCommandFieldValue(command, field, value, beforeCommand) {
    if (field === 'aliases') {
        command.aliases = String(value || '').split(',').map(v => normalizeCommandToken(v)).filter(Boolean);
    } else if (field === 'enabled') {
        command.enabled = !!value;
    } else if (field === 'name') {
        const beforeName = beforeCommand ? beforeCommand.name : command.name;
        command.name = normalizeCommandToken(value);
        if (!command.usage || command.usage === `/${beforeName}`) {
            command.usage = command.name ? `/${command.name}` : '';
        }
    } else {
        command[field] = String(value || '').trim();
    }
}

function updateCustomCommandAction(index, field, value) {
    const command = customCommands[index];
    if (!command) return;
    const before = cloneCustomCommand(command);
    applyCustomCommandActionFieldValue(command, field, value, true);
    const after = cloneCustomCommand(command);
    renderCommandsTab();
    markCommandsDirty('updated', before, after);
}

function commitCustomCommandActionField(element, index, field, value) {
    const command = customCommands[index];
    if (!command) return;
    const before = getRememberedCustomCommandBefore(element, index);
    applyCustomCommandActionFieldValue(command, field, value, true);
    const after = cloneCustomCommand(command);
    renderCommandsTab();
    markCommandsDirty('updated', before, after);
}

function updateCustomCommandActionValue(index, field, value) {
    const command = customCommands[index];
    if (!command) return;
    applyCustomCommandActionFieldValue(command, field, value, false);
}

function applyCustomCommandActionFieldValue(command, field, value, updateDependentFields) {
    command.action = command.action || {};
    if (field === 'type') {
        command.action.type = normalizeActionType(value);
        if (updateDependentFields) {
            if (command.action.type === 'OPEN_SHOP') {
                command.action.item = '';
                command.action.menu = 'BOTH';
                if (!command.action.shop) command.action.shop = firstCommandShopKey();
            } else if (command.action.type === 'OPEN_ITEM') {
                if (!command.action.shop) command.action.shop = firstCommandShopKey();
                command.action.menu = COMMAND_MENU_MODES.includes(command.action.menu) ? command.action.menu : 'BOTH';
            } else if (command.action.type === 'SELL_ALL') {
                command.action.shop = '';
                command.action.item = '';
                command.action.menu = 'BOTH';
            }
        }
    } else if (field === 'menu') {
        command.action.menu = normalizeMenuMode(value);
    } else if (field === 'shop') {
        command.action.shop = String(value || '').trim();
        if (updateDependentFields && command.action.type === 'OPEN_ITEM') {
            const validItems = commandItemsForShop(command.action.shop).map(item => item.key);
            if (!validItems.includes(command.action.item)) command.action.item = '';
        }
    } else if (field === 'item') {
        command.action.item = String(value || '').trim();
    } else {
        command.action[field] = String(value || '').trim();
    }
}

function addCustomCommand() {
    const command = createDefaultCustomCommand();
    customCommands.push(command);
    renderCommandsTab();
    markCommandsDirty('created', null, JSON.parse(JSON.stringify(command)));
}

function duplicateCustomCommand(index) {
    const source = customCommands[index];
    if (!source) return;
    const copy = JSON.parse(JSON.stringify(source));
    copy.name = nextCustomCommandName();
    copy.enabled = false;
    copy.aliases = [];
    if (!copy.usage || copy.usage === `/${source.name}`) copy.usage = `/${copy.name}`;
    customCommands.splice(index + 1, 0, copy);
    renderCommandsTab();
    markCommandsDirty('created', null, copy);
}

async function deleteCustomCommand(index) {
    const command = customCommands[index];
    if (!command) return;
    const confirmed = await showConfirm(`Delete custom command ${command.name || index + 1}?`);
    if (!confirmed) return;
    customCommands.splice(index, 1);
    renderCommandsTab();
    markCommandsDirty('deleted', JSON.parse(JSON.stringify(command)), null);
}

function validateCustomCommands() {
    return validateCustomCommandsDetailed().errors;
}

function validateCustomCommandsForSave() {
    return validateCustomCommandsDetailed({ runtime: false }).errors;
}

function validateCustomCommandsDetailed(options = {}) {
    syncCustomCommandsFromDom();
    const runtime = options.runtime !== false;
    const errors = [];
    const warnings = [];
    const seen = new Map();
    const shops = new Set(commandShopEntries().map(shop => shop.key));

    (customCommands || []).forEach((command, index) => {
        const label = command.name || `command ${index + 1}`;
        const name = String(command.name || '').trim().toLowerCase();
        validateCommandToken(name, `Command ${index + 1}`, errors);
        if (runtime && command.enabled) {
            if (PROTECTED_CUSTOM_COMMANDS.has(name)) warnings.push(`Command '${name}' conflicts with a protected command and will not register.`);
            recordCommandToken(name, label, seen, errors);
        }

        (command.aliases || []).forEach(aliasRaw => {
            const alias = String(aliasRaw || '').trim().toLowerCase();
            validateCommandToken(alias, `Alias for ${label}`, errors);
            if (runtime && command.enabled) {
                if (PROTECTED_CUSTOM_COMMANDS.has(alias)) warnings.push(`Alias '${alias}' for '${label}' conflicts with a protected command and will not register.`);
                recordCommandToken(alias, `alias for ${label}`, seen, errors);
            }
        });

        const action = command.action || {};
        const type = normalizeActionType(action.type || '');
        if (!COMMAND_ACTION_TYPES.includes(type)) {
            errors.push(`Command '${label}' has invalid action type.`);
            return;
        }
        if ((type === 'OPEN_SHOP' || type === 'OPEN_ITEM') && !action.shop) {
            errors.push(`Command '${label}' requires a shop.`);
        }
        if (runtime && command.enabled && action.shop && !shops.has(action.shop)) {
            warnings.push(`Command '${label}' references missing shop '${action.shop}' and will not register.`);
        }
        if (type === 'OPEN_ITEM') {
            if (!action.item) errors.push(`Command '${label}' requires an item.`);
            const items = new Set(commandItemsForShop(action.shop).map(item => item.key));
            if (runtime && command.enabled && action.item && !items.has(action.item)) {
                warnings.push(`Command '${label}' references missing item '${action.item}' in shop '${action.shop || ''}' and will not register.`);
            }
            if (!COMMAND_MENU_MODES.includes(normalizeMenuMode(action.menu || ''))) {
                errors.push(`Command '${label}' has invalid menu mode.`);
            }
        }
    });

    return { errors, warnings };
}

function validateCommandToken(token, label, errors) {
    if (!token) {
        errors.push(`${label} is empty.`);
    } else if (!COMMAND_NAME_PATTERN.test(token)) {
        errors.push(`${label} '${token}' is invalid. Use lowercase letters, numbers, underscores, and hyphens.`);
    }
}

function recordCommandToken(token, label, seen, errors) {
    if (!token) return;
    if (seen.has(token)) errors.push(`Duplicate command or alias '${token}' used by ${seen.get(token)} and ${label}.`);
    else seen.set(token, label);
}

function renderCommandsValidation() {
    const el = document.getElementById('commands-validation');
    if (!el) return;
    const result = validateCustomCommandsDetailed();
    const errors = result.errors;
    const warnings = result.warnings;
    if (errors.length === 0 && warnings.length === 0) {
        el.innerHTML = '<div class="commands-valid">commands.yml is valid for saving.</div>';
        return;
    }
    el.innerHTML = `
        ${errors.length > 0 ? `
            <div class="commands-error">
                <strong>${errors.length} save issue${errors.length === 1 ? '' : 's'}</strong>
                <ul>${errors.slice(0, 12).map(error => `<li>${escapeHtml(error)}</li>`).join('')}</ul>
                ${errors.length > 12 ? `<div>${errors.length - 12} more issue(s).</div>` : ''}
            </div>
        ` : ''}
        ${warnings.length > 0 ? `
            <div class="commands-warning">
                <strong>${warnings.length} runtime warning${warnings.length === 1 ? '' : 's'}</strong>
                <ul>${warnings.slice(0, 12).map(warning => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>
                ${warnings.length > 12 ? `<div>${warnings.length - 12} more warning(s).</div>` : ''}
            </div>
        ` : ''}
    `;
}

function yamlQuote(value) {
    return `'${String(value || '').replace(/'/g, "''")}'`;
}

function generateCommandsYaml() {
    const commands = collectCustomCommandsFromDom();
    let yaml = '# Custom commands for Genius Shop\n';
    yaml += '# Run /shop reload after saving to reload dynamic command registrations.\n\n';
    yaml += 'commands:\n';
    commands.forEach(command => {
        const name = String(command.name || '').trim().toLowerCase();
        if (!name) return;
        const action = command.action || {};
        const type = normalizeActionType(action.type || 'OPEN_SHOP');
        yaml += `  ${name}:\n`;
        yaml += `    enabled: ${command.enabled ? 'true' : 'false'}\n`;
        if (command.aliases && command.aliases.length > 0) {
            yaml += '    aliases:\n';
            command.aliases.forEach(alias => {
                if (alias) yaml += `      - ${yamlQuote(String(alias).trim().toLowerCase())}\n`;
            });
        } else {
            yaml += '    aliases: []\n';
        }
        yaml += `    description: ${yamlQuote(command.description || 'Custom shop command')}\n`;
        yaml += `    usage: ${yamlQuote(command.usage || `/${name}`)}\n`;
        if (command.permission) yaml += `    permission: ${yamlQuote(command.permission)}\n`;
        if (command.noPermissionMessage) yaml += `    no-permission-message: ${yamlQuote(command.noPermissionMessage)}\n`;
        if (command.shopBypassPermission) yaml += `    shop-bypass-permission: ${yamlQuote(command.shopBypassPermission)}\n`;
        yaml += '    action:\n';
        yaml += `      type: ${type}\n`;
        if (action.shop) yaml += `      shop: ${yamlQuote(action.shop)}\n`;
        if (type === 'OPEN_ITEM') {
            yaml += `      item: ${yamlQuote(action.item || '')}\n`;
            yaml += `      menu: ${normalizeMenuMode(action.menu || 'BOTH')}\n`;
        }
        yaml += '\n';
    });
    return yaml;
}

function collectCustomCommandsFromDom() {
    const container = document.getElementById('commands-container');
    const cards = container ? Array.from(container.querySelectorAll('[data-command-card]')) : [];
    if (cards.length === 0) {
        syncCustomCommandsFromDom();
        return customCommands || [];
    }

    const collected = cards.map(card => {
        const index = Number(card.dataset.commandCard);
        const fallback = customCommands[index] || createDefaultCustomCommand();
        const command = JSON.parse(JSON.stringify(fallback));
        command.action = command.action || {};

        card.querySelectorAll('[data-command-field]').forEach(field => {
            const key = field.dataset.commandField;
            if (!key) return;
            if (key === 'enabled') {
                command.enabled = !!field.checked;
            } else if (key === 'aliases') {
                command.aliases = String(field.value || '').split(',').map(v => normalizeCommandToken(v)).filter(Boolean);
            } else if (key === 'name') {
                command.name = normalizeCommandToken(field.value);
            } else {
                command[key] = String(field.value || '').trim();
            }
        });

        card.querySelectorAll('[data-command-action-field]').forEach(field => {
            const key = field.dataset.commandActionField;
            if (!key) return;
            if (key === 'type') {
                command.action.type = normalizeActionType(field.value || '');
            } else if (key === 'menu') {
                command.action.menu = normalizeMenuMode(field.value || '');
            } else {
                command.action[key] = String(field.value || '').trim();
            }
        });
        return command;
    });

    customCommands = collected;
    return collected;
}

function syncCustomCommandsFromDom() {
    const container = document.getElementById('commands-container');
    if (!container || !Array.isArray(customCommands)) return;

    container.querySelectorAll('[data-command-index][data-command-field]').forEach(field => {
        const index = Number(field.dataset.commandIndex);
        const key = field.dataset.commandField;
        const command = customCommands[index];
        if (!command || !key) return;

        if (key === 'enabled') {
            command.enabled = !!field.checked;
        } else if (key === 'aliases') {
            command.aliases = String(field.value || '').split(',').map(v => normalizeCommandToken(v)).filter(Boolean);
        } else if (key === 'name') {
            command.name = normalizeCommandToken(field.value);
        } else {
            command[key] = String(field.value || '').trim();
        }
    });

    container.querySelectorAll('[data-command-index][data-command-action-field]').forEach(field => {
        const index = Number(field.dataset.commandIndex);
        const key = field.dataset.commandActionField;
        const command = customCommands[index];
        if (!command || !key) return;
        command.action = command.action || {};
        if (key === 'type') {
            command.action.type = normalizeActionType(field.value || '');
        } else if (key === 'menu') {
            command.action.menu = normalizeMenuMode(field.value || '');
        } else {
            command.action[key] = String(field.value || '').trim();
        }
    });
}

function triggerCommandsImport() {
    const input = document.getElementById('commands-import-file');
    if (input) input.click();
}

function handleCommandsImport(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        const before = JSON.parse(JSON.stringify(customCommands || []));
        parseCommandsYaml(String(reader.result || ''));
        const errors = validateCustomCommands();
        if (errors.length > 0) {
            customCommands = before;
            renderCommandsTab();
            showAlert(`Import failed:\n\n${errors.slice(0, 10).join('\n')}`, 'error');
            return;
        }
        renderCommandsTab();
        markCommandsDirty('updated', before, JSON.parse(JSON.stringify(customCommands || [])));
        showToast('Commands imported', 'success');
    };
    reader.readAsText(file);
}

function exportCommandsYaml() {
    downloadFile(generateCommandsYaml(), 'commands.yml');
}
