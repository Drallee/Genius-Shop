// ===== YAML PARSING & GENERATION =====

function sanitizeStockResetRule(rule) {
    const base = createDefaultStockResetRule();
    const input = rule || {};
    const type = (input.type || base.type || 'daily').toString().toLowerCase();
    const allowedTypes = ['daily', 'hourly', 'minute-interval', 'second-interval', 'weekly', 'monthly', 'yearly', 'once'];

    return {
        enabled: !!input.enabled,
        type: allowedTypes.includes(type) ? type : 'daily',
        time: (input.time || base.time || '00:00').toString(),
        interval: Math.max(1, parseInt(input.interval ?? base.interval, 10) || 1),
        dayOfWeek: (input.dayOfWeek || base.dayOfWeek || 'MONDAY').toString().toUpperCase(),
        dayOfMonth: Math.max(1, Math.min(31, parseInt(input.dayOfMonth ?? base.dayOfMonth, 10) || 1)),
        month: Math.max(1, Math.min(12, parseInt(input.month ?? base.month, 10) || 1)),
        monthDay: (input.monthDay || '').toString(),
        date: (input.date || '').toString(),
        timezone: (input.timezone || '').toString()
    };
}

function appendStockResetYaml(yaml, indent, rule) {
    const safe = sanitizeStockResetRule(rule);
    if (!safe.enabled) return yaml;

    const sp = ' '.repeat(indent);
    const child = ' '.repeat(indent + 2);
    yaml += `${sp}stock-reset:\n`;
    yaml += `${child}enabled: true\n`;
    yaml += `${child}type: '${safe.type}'\n`;
    if (safe.type === 'minute-interval' || safe.type === 'second-interval') {
        yaml += `${child}interval: ${safe.interval}\n`;
    } else {
        yaml += `${child}time: '${safe.time}'\n`;
    }

    if (safe.type === 'weekly') {
        yaml += `${child}day-of-week: '${safe.dayOfWeek}'\n`;
    } else if (safe.type === 'monthly') {
        yaml += `${child}day-of-month: ${safe.dayOfMonth}\n`;
    } else if (safe.type === 'yearly') {
        yaml += `${child}month: ${safe.month}\n`;
        yaml += `${child}day-of-month: ${safe.dayOfMonth}\n`;
    } else if (safe.type === 'once') {
        if (safe.date) yaml += `${child}date: '${safe.date}'\n`;
    }

    if (safe.monthDay && (safe.type === 'yearly' || safe.type === 'once')) {
        yaml += `${child}month-day: '${safe.monthDay}'\n`;
    }
    if (safe.timezone) {
        yaml += `${child}timezone: '${safe.timezone}'\n`;
    }

    return yaml;
}

function parseShopYaml(yamlContent) {
    items = [];
    itemIdCounter = 0;
    Object.assign(currentShopSettings, {
        guiName: '&8Shop',
        rows: 3,
        permission: '',
        availableTimes: '',
        sellAddsToStock: false,
        allowSellStockOverflow: false,
        stockResetRule: createDefaultStockResetRule()
    });

    // Decode HTML entities if present (e.g., &amp; -> &)
    yamlContent = yamlContent.replace(/&amp;/g, '&');

    const lines = yamlContent.split('\n');
    let currentItem = null;
    let inLore = false;
    let inCommands = false;
    let inItemsSection = false;
    let inAvailableTimes = false;
    let inShopStockReset = false;
    let inItemStockReset = false;
    let availableTimesList = [];

    console.log('Parsing shop YAML, total lines:', lines.length);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith('#')) continue;

        const indent = line.search(/\S/);

        // Parse shop-level properties (before items section)
        if (!inItemsSection && indent === 0 && trimmed.includes(':') && !trimmed.startsWith('-')) {
            const [key, ...valueParts] = trimmed.split(':');
            const cleanKey = key.trim();
            const value = valueParts.join(':').trim().replace(/['"]/g, '');

            if (cleanKey === 'gui-name') {
                currentShopSettings.guiName = value;
                inAvailableTimes = false;
                inShopStockReset = false;
            } else if (cleanKey === 'rows') {
                currentShopSettings.rows = parseInt(value) || 3;
                inAvailableTimes = false;
                inShopStockReset = false;
            } else if (cleanKey === 'permission') {
                currentShopSettings.permission = value;
                inAvailableTimes = false;
                inShopStockReset = false;
            } else if (cleanKey === 'sell-adds-to-stock') {
                currentShopSettings.sellAddsToStock = value.toLowerCase() === 'true';
                inAvailableTimes = false;
                inShopStockReset = false;
            } else if (cleanKey === 'allow-sell-stock-overflow') {
                currentShopSettings.allowSellStockOverflow = value.toLowerCase() === 'true';
                inAvailableTimes = false;
                inShopStockReset = false;
            } else if (cleanKey === 'available-times') {
                inAvailableTimes = true;
                inShopStockReset = false;
                availableTimesList = [];
            } else if (cleanKey === 'stock-reset') {
                inShopStockReset = true;
                inAvailableTimes = false;
                currentShopSettings.stockResetRule = sanitizeStockResetRule({
                    ...currentShopSettings.stockResetRule,
                    enabled: true
                });
            } else {
                inAvailableTimes = false;
                inShopStockReset = false;
            }
        }

        // Parse available-times list items (indent 2)
        if (inAvailableTimes && indent === 2 && trimmed.startsWith('-')) {
            const timeValue = trimmed.substring(1).trim().replace(/['"]/g, '');
            availableTimesList.push(timeValue);
        }
        if (!inItemsSection && inShopStockReset && indent === 2 && !trimmed.startsWith('-') && trimmed.includes(':')) {
            const [rawKey, ...valueParts] = trimmed.split(':');
            const key = rawKey.trim();
            const value = valueParts.join(':').trim().replace(/['"]/g, '');
            const rule = { ...(currentShopSettings.stockResetRule || createDefaultStockResetRule()) };
            if (key === 'enabled') rule.enabled = value === 'true';
            else if (key === 'type') rule.type = value.toLowerCase();
            else if (key === 'time') rule.time = value;
            else if (key === 'interval') rule.interval = parseInt(value, 10) || 1;
            else if (key === 'day-of-week') rule.dayOfWeek = value.toUpperCase();
            else if (key === 'day-of-month') rule.dayOfMonth = parseInt(value, 10) || 1;
            else if (key === 'month') rule.month = parseInt(value, 10) || 1;
            else if (key === 'month-day') rule.monthDay = value;
            else if (key === 'date') rule.date = value;
            else if (key === 'timezone') rule.timezone = value;
            currentShopSettings.stockResetRule = sanitizeStockResetRule(rule);
        }

        // Check if we're in the items section
        if (indent === 0 && trimmed === 'items:') {
            inItemsSection = true;
            inAvailableTimes = false;
            inShopStockReset = false;
            // Set available-times state
            currentShopSettings.availableTimes = availableTimesList.join('\n');
            console.log('Found items section at line', i);
            continue;
        }

        // Skip non-items section content
        if (!inItemsSection) continue;

        // New item
        if (inItemsSection && trimmed.startsWith('- material:')) {
            if (currentItem) {
                items.push(currentItem);
            }
            const material = trimmed.substring(12).trim().replace(/['"]/g, '');
            currentItem = {
                id: itemIdCounter++,
                material: material,
                name: '&eItem',
                headTexture: '',
                headOwner: '',
                price: 0,
                sellPrice: 0,
                amount: 1,
                lore: [],
                enchantments: {},
                hideAttributes: false,
                hideAdditional: false,
                requireName: false,
                requireLore: false,
                unstableTnt: false,
                spawnerType: null,
                spawnerItem: null,
                potionType: null,
                potionLevel: 0,
                commands: [],
                runAs: 'console',
                limit: 0,
                globalLimit: 0,
                dynamicPricing: false,
                minPrice: 0,
                maxPrice: 0,
                priceChange: 0,
                stockResetRule: createDefaultStockResetRule(),
                showStock: false,
                showStockResetTimer: false,
                runCommandOnly: true,
                permission: '',
                sellAddsToStock: null,
                allowSellStockOverflow: null,
                slot: null
            };
            inLore = false;
            inCommands = false;
            inItemStockReset = false;
        } else if (inItemsSection && trimmed === '-') {
            if (currentItem) {
                items.push(currentItem);
            }
            currentItem = {
                id: itemIdCounter++,
                material: 'STONE',
                name: '&eItem',
                headTexture: '',
                headOwner: '',
                price: 0,
                sellPrice: 0,
                amount: 1,
                lore: [],
                enchantments: {},
                hideAttributes: false,
                hideAdditional: false,
                requireName: false,
                requireLore: false,
                unstableTnt: false,
                spawnerType: null,
                spawnerItem: null,
                potionType: null,
                potionLevel: 0,
                commands: [],
                runAs: 'console',
                limit: 0,
                globalLimit: 0,
                dynamicPricing: false,
                minPrice: 0,
                maxPrice: 0,
                priceChange: 0,
                stockResetRule: createDefaultStockResetRule(),
                showStock: false,
                showStockResetTimer: false,
                runCommandOnly: true,
                permission: '',
                sellAddsToStock: null,
                allowSellStockOverflow: null,
                slot: null
            };
            inLore = false;
            inCommands = false;
            inItemStockReset = false;
        } else if (currentItem && indent >= 2) {
            if (inItemStockReset && indent >= 4 && !trimmed.startsWith('-') && trimmed.includes(':')) {
                const [rawKey, ...valueParts] = trimmed.split(':');
                const key = rawKey.trim();
                const value = valueParts.join(':').trim().replace(/['"]/g, '');
                const rule = { ...(currentItem.stockResetRule || createDefaultStockResetRule()) };
                if (key === 'enabled') rule.enabled = value === 'true';
                else if (key === 'type') rule.type = value.toLowerCase();
                else if (key === 'time') rule.time = value;
                else if (key === 'interval') rule.interval = parseInt(value, 10) || 1;
                else if (key === 'day-of-week') rule.dayOfWeek = value.toUpperCase();
                else if (key === 'day-of-month') rule.dayOfMonth = parseInt(value, 10) || 1;
                else if (key === 'month') rule.month = parseInt(value, 10) || 1;
                else if (key === 'month-day') rule.monthDay = value;
                else if (key === 'date') rule.date = value;
                else if (key === 'timezone') rule.timezone = value;
                currentItem.stockResetRule = sanitizeStockResetRule(rule);
                continue;
            }

            let [key, ...valueParts] = trimmed.split(':');
            key = key.trim().replace(/['"]/g, '');
            const value = valueParts.join(':').trim().replace(/['"]/g, '');
            if (indent === 2 && key !== 'stock-reset') {
                inItemStockReset = false;
            }

            if (key === 'material') {
                currentItem.material = value;
                inLore = false;
            } else if (key.trim() === 'name') {
                currentItem.name = value;
                inLore = false;
            } else if (key.trim() === 'price') {
                currentItem.price = parseFloat(value) || 0;
                inLore = false;
            } else if (key.trim() === 'sell-price') {
                currentItem.sellPrice = parseFloat(value) || 0;
                inLore = false;
            } else if (key.trim() === 'amount') {
                currentItem.amount = parseInt(value) || 1;
                inLore = false;
            } else if (key.trim() === 'lore') {
                inLore = true;
            } else if (key.trim() === 'enchantments') {
                inLore = false;
                // Basic enchantment parsing if on same line (rare)
            } else if (key.trim() === 'hide-attributes') {
                currentItem.hideAttributes = value === 'true';
                inLore = false;
            } else if (key.trim() === 'hide-additional') {
                currentItem.hideAdditional = value === 'true';
                inLore = false;
            } else if (key.trim() === 'require-name') {
                currentItem.requireName = value === 'true';
                inLore = false;
            } else if (key.trim() === 'require-lore') {
                currentItem.requireLore = value === 'true';
                inLore = false;
            } else if (key.trim() === 'unstable-tnt') {
                currentItem.unstableTnt = value === 'true';
                inLore = false;
            } else if (key.trim() === 'limit') {
                currentItem.limit = parseInt(value) || 0;
                inLore = false;
            } else if (key.trim() === 'global-limit') {
                currentItem.globalLimit = parseInt(value) || 0;
                inLore = false;
            } else if (key.trim() === 'dynamic-pricing') {
                currentItem.dynamicPricing = value === 'true';
                inLore = false;
            } else if (key.trim() === 'min-price') {
                currentItem.minPrice = parseFloat(value) || 0;
                inLore = false;
            } else if (key.trim() === 'max-price') {
                currentItem.maxPrice = parseFloat(value) || 0;
                inLore = false;
            } else if (key.trim() === 'price-change') {
                currentItem.priceChange = parseFloat(value) || 0;
                inLore = false;
            } else if (key.trim() === 'run-command-only') {
                currentItem.runCommandOnly = value === 'true';
                inLore = false;
            } else if (key.trim() === 'run-as') {
                const normalizedRunAs = value.toLowerCase();
                currentItem.runAs = normalizedRunAs === 'player' ? 'player' : 'console';
                inLore = false;
            } else if (key.trim() === 'permission') {
                currentItem.permission = value;
                inLore = false;
            } else if (key.trim() === 'sell-adds-to-stock') {
                currentItem.sellAddsToStock = value === 'true';
                inLore = false;
            } else if (key.trim() === 'allow-sell-stock-overflow') {
                currentItem.allowSellStockOverflow = value === 'true';
                inLore = false;
            } else if (key.trim() === 'show-stock') {
                currentItem.showStock = value === 'true';
                inLore = false;
            } else if (key.trim() === 'show-stock-reset-timer') {
                currentItem.showStockResetTimer = value === 'true';
                inLore = false;
            } else if (key.trim() === 'stock-reset') {
                inItemStockReset = true;
                currentItem.stockResetRule = sanitizeStockResetRule({
                    ...(currentItem.stockResetRule || createDefaultStockResetRule()),
                    enabled: true
                });
                inLore = false;
                inCommands = false;
            } else if (key.trim() === 'spawner-type') {
                currentItem.spawnerType = value.toUpperCase();
                inLore = false;
            } else if (key.trim() === 'spawner-item') {
                currentItem.spawnerItem = value.toUpperCase();
                inLore = false;
            } else if (key.trim() === 'potion-type') {
                currentItem.potionType = value.toUpperCase();
                inLore = false;
            } else if (key.trim() === 'potion-level') {
                currentItem.potionLevel = parseInt(value) || 0;
                inLore = false;
            } else if (key.trim() === 'head-texture') {
                currentItem.headTexture = value;
                inLore = false;
            } else if (key.trim() === 'head-owner') {
                currentItem.headOwner = value;
                inLore = false;
            } else if (key.trim() === 'slot') {
                currentItem.slot = parseInt(value);
                inLore = false;
                inCommands = false;
            } else if (key.trim() === 'commands') {
                inCommands = true;
                inLore = false;
            } else if (trimmed.startsWith('-') && inLore) {
                const loreLine = trimmed.substring(1).trim().replace(/['"]/g, '');
                currentItem.lore.push(loreLine);
            } else if (trimmed.startsWith('-') && inCommands) {
                const cmd = trimmed.substring(1).trim().replace(/['"]/g, '');
                currentItem.commands.push(cmd);
            } else if (indent >= 4 && !inLore && !inCommands && trimmed.includes(':')) {
                // Could be enchantment or other nested property
                if (line.includes(':')) {
                    const lastColonIndex = trimmed.lastIndexOf(':');
                    if (lastColonIndex !== -1) {
                        let subKey = trimmed.substring(0, lastColonIndex).trim().replace(/['"]/g, '');
                        let subVal = trimmed.substring(lastColonIndex + 1).trim();
                        // Handle enchantments
                        if (currentItem.enchantments) {
                            const cleanKey = subKey;
                            const upperKey = cleanKey.toUpperCase();
                            // Filter out keys that might have been incorrectly put here or are known fields
                            if (!['SPAWNER-TYPE', 'SPAWNER-ITEM', 'POTION-TYPE', 'POTION-LEVEL', 'PRICE', 'SELL-PRICE', 'AMOUNT', 'LIMIT', 'GLOBAL-LIMIT', 'MATERIAL', 'NAME', 'LORE', 'SLOT', 'REQUIRE-NAME', 'REQUIRE-LORE', 'UNSTABLE-TNT', 'HIDE-ATTRIBUTES', 'HIDE-ADDITIONAL', 'COMMANDS', 'PERMISSION', 'SELL-ADDS-TO-STOCK', 'ALLOW-SELL-STOCK-OVERFLOW', 'HEAD-TEXTURE', 'HEAD-OWNER'].includes(upperKey)) {
                                currentItem.enchantments[cleanKey] = parseInt(subVal) || 1;
                            }
                        }
                    }
                }
            }
        }
    }

    if (currentItem) {
        items.push(currentItem);
    }
    currentShopSettings.availableTimes = availableTimesList.join('\n');
    currentShopSettings.stockResetRule = sanitizeStockResetRule(currentShopSettings.stockResetRule);
    items.forEach(item => {
        item.stockResetRule = sanitizeStockResetRule(item.stockResetRule);
    });

    initializeShopItemSlots();
}

function initializeShopItemSlots() {
    const explicitSlots = new Set();
    items.forEach(item => {
        if (item.slot !== undefined && item.slot !== null) {
            explicitSlots.add(item.slot);
        }
    });

    let nextSlot = 0;
    items.forEach(item => {
        if (item.slot === undefined || item.slot === null) {
            while (explicitSlots.has(nextSlot)) {
                nextSlot++;
            }
            item.slot = nextSlot;
            explicitSlots.add(nextSlot);
            nextSlot++;
        }
    });
}

function parsePriceFormatConfig(yamlContent) {
    if (!yamlContent || typeof yamlContent !== 'string') return;

    priceFormatSettings.mode = 'plain';
    priceFormatSettings.grouped.thousandsSeparator = '.';
    priceFormatSettings.grouped.decimalSeparator = ',';
    priceFormatSettings.grouped.maxDecimals = 2;

    const lines = yamlContent.split('\n');
    let inPriceFormat = false;
    let inGrouped = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const indent = line.search(/\S/);

        if (indent === 0 && trimmed === 'price-format:') {
            inPriceFormat = true;
            inGrouped = false;
            continue;
        }

        if (indent === 0 && inPriceFormat && trimmed.endsWith(':') && trimmed !== 'price-format:') {
            break;
        }

        if (!inPriceFormat) continue;

        if (indent === 2 && trimmed.startsWith('mode:')) {
            const mode = trimmed.split(':').slice(1).join(':').trim().replace(/['"]/g, '').toLowerCase();
            if (mode === 'plain' || mode === 'grouped' || mode === 'compact') {
                priceFormatSettings.mode = mode;
            }
            continue;
        }

        if (indent === 2 && trimmed === 'grouped:') {
            inGrouped = true;
            continue;
        }

        if (indent === 2 && trimmed.endsWith(':') && trimmed !== 'grouped:') {
            inGrouped = false;
            continue;
        }

        if (inGrouped && indent === 4 && trimmed.includes(':')) {
            const [rawKey, ...valueParts] = trimmed.split(':');
            const key = rawKey.trim();
            const value = valueParts.join(':').trim().replace(/['"]/g, '');
            if (key === 'thousands-separator' && value.length > 0) {
                priceFormatSettings.grouped.thousandsSeparator = value[0];
            } else if (key === 'decimal-separator' && value.length > 0) {
                priceFormatSettings.grouped.decimalSeparator = value[0];
            } else if (key === 'max-decimals') {
                const parsed = parseInt(value, 10);
                if (!isNaN(parsed)) {
                    priceFormatSettings.grouped.maxDecimals = Math.max(0, Math.min(6, parsed));
                }
            }
        }
    }
}

function parsePriceFormatPayload(payload) {
    if (!payload || typeof payload !== 'object') return;

    const mode = String(payload.mode || '').toLowerCase();
    if (mode === 'plain' || mode === 'grouped' || mode === 'compact') {
        priceFormatSettings.mode = mode;
    } else {
        priceFormatSettings.mode = 'plain';
    }

    const grouped = payload.grouped || {};
    if (grouped.thousandsSeparator && String(grouped.thousandsSeparator).length > 0) {
        priceFormatSettings.grouped.thousandsSeparator = String(grouped.thousandsSeparator)[0];
    }
    if (grouped.decimalSeparator && String(grouped.decimalSeparator).length > 0) {
        priceFormatSettings.grouped.decimalSeparator = String(grouped.decimalSeparator)[0];
    }
    if (grouped.maxDecimals !== undefined) {
        const parsed = parseInt(grouped.maxDecimals, 10);
        if (!isNaN(parsed)) {
            priceFormatSettings.grouped.maxDecimals = Math.max(0, Math.min(6, parsed));
        }
    }
}

function parseMainMenuYaml(yamlContent) {
    loadedGuiShops = [];
    const lines = yamlContent.split('\n');
    let currentShop = null;
    let currentField = null;
    let inItems = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith('#')) continue;

        const indent = line.search(/\S/);

        if (indent === 0 && trimmed.startsWith('title:')) {
            const [, ...valueParts] = trimmed.split(':');
            mainMenuSettings.title = valueParts.join(':').trim().replace(/['"]/g, '');
            continue;
        }

        if (indent === 0 && trimmed.startsWith('rows:')) {
            const [, ...valueParts] = trimmed.split(':');
            mainMenuSettings.rows = parseInt(valueParts.join(':').trim()) || 3;
            continue;
        }

        if (indent === 0 && trimmed === 'items:') {
            inItems = true;
            continue;
        }

        if (inItems && indent === 2 && trimmed.includes(':') && !trimmed.startsWith('-')) {
            const shopKey = trimmed.split(':')[0].trim();

            if (currentShop) {
                loadedGuiShops.push(currentShop);
            }

            currentShop = {
                key: shopKey,
                slot: null,
                material: 'CHEST',
                name: shopKey,
                lore: [],
                action: '',
                shopKey: '',
                commands: [],
                runAs: 'player',
                permission: '',
                hideAttributes: false,
                hideAdditional: false,
                closeAfterAction: false
            };
            currentField = null;
        } else if (currentShop && indent >= 4 && trimmed.startsWith('-') && (currentField === 'lore' || currentField === 'commands')) {
            const lineValue = trimmed.substring(1).trim().replace(/['"]/g, '');
            if (currentField === 'lore') {
                currentShop.lore.push(lineValue);
            } else if (currentField === 'commands') {
                currentShop.commands.push(lineValue);
            }
        } else if (currentShop && indent === 4 && trimmed.includes(':') && !trimmed.startsWith('-')) {
            if (currentField === 'lore' || currentField === 'commands') currentField = null;

            const [key, ...valueParts] = trimmed.split(':');
            const value = valueParts.join(':').trim().replace(/['"]/g, '');

            if (key.trim() === 'slot') {
                currentShop.slot = parseInt(value);
            } else if (key.trim() === 'material') {
                currentShop.material = value;
            } else if (key.trim() === 'name') {
                currentShop.name = value;
            } else if (key.trim() === 'action') {
                currentShop.action = value.toLowerCase();
            } else if (key.trim() === 'lore') {
                currentField = 'lore';
                if (value === '[]' || value === '') {
                    currentShop.lore = [];
                }
            } else if (key.trim() === 'shop-key') {
                currentShop.shopKey = value;
            } else if (key.trim() === 'command') {
                currentShop.commands = value ? [value] : [];
            } else if (key.trim() === 'commands') {
                currentField = 'commands';
                if (value === '[]' || value === '') {
                    currentShop.commands = [];
                }
            } else if (key.trim() === 'close-after-action') {
                currentShop.closeAfterAction = value.toLowerCase() === 'true';
            } else if (key.trim() === 'run-as') {
                const normalizedRunAs = value.toLowerCase();
                currentShop.runAs = normalizedRunAs === 'console' ? 'console' : 'player';
            } else if (key.trim() === 'permission') {
                currentShop.permission = value;
            } else if (key.trim() === 'hide-attributes') {
                currentShop.hideAttributes = value.toLowerCase() === 'true';
            } else if (key.trim() === 'hide-additional') {
                currentShop.hideAdditional = value.toLowerCase() === 'true';
            }
        }
    }

    if (currentShop) {
        loadedGuiShops.push(currentShop);
    }
}

function parsePurchaseMenuYaml(yamlContent) {
    const lines = yamlContent.split('\n');
    let inButtons = false;
    let currentButtonType = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith('#')) continue;

        const indent = line.search(/\S/);
        const [key, ...valueParts] = trimmed.split(':');
        const value = valueParts.join(':').trim().replace(/['"]/g, '');

        if (indent === 0) {
            if (key.trim() === 'title-prefix') {
                transactionSettings.purchase.titlePrefix = value;
            } else if (key.trim() === 'display-material') {
                transactionSettings.purchase.displayMaterial = value;
            } else if (key.trim() === 'display-slot') {
                transactionSettings.purchase.displaySlot = parseInt(value) || 22;
            } else if (key.trim() === 'max-amount') {
                transactionSettings.purchase.maxAmount = parseInt(value) || 2304;
            } else if (trimmed === 'buttons:') {
                inButtons = true;
            }
        } else if (indent === 2 && !inButtons) {
            if (key.trim() === 'amount') {
                transactionSettings.purchase.lore.amount = value;
            } else if (key.trim() === 'total') {
                transactionSettings.purchase.lore.total = value;
            } else if (key.trim() === 'spawner') {
                transactionSettings.purchase.lore.spawner = value;
            }
        } else if (inButtons && indent === 2 && trimmed.endsWith(':')) {
            currentButtonType = key.trim();
        } else if (inButtons && currentButtonType && indent === 4) {
            if (['confirm', 'cancel', 'back'].includes(currentButtonType)) {
                if (!transactionSettings.purchase.buttons[currentButtonType]) {
                    transactionSettings.purchase.buttons[currentButtonType] = { material: 'STONE', name: '', slot: 0 };
                }
                if (key.trim() === 'material') {
                    transactionSettings.purchase.buttons[currentButtonType].material = value;
                } else if (key.trim() === 'name') {
                    transactionSettings.purchase.buttons[currentButtonType].name = value;
                } else if (key.trim() === 'slot') {
                    transactionSettings.purchase.buttons[currentButtonType].slot = parseInt(value) || 0;
                }
            } else if (['add', 'remove', 'set'].includes(currentButtonType)) {
                if (key.trim() === 'material') {
                    if (!transactionSettings.purchase[currentButtonType]) {
                        transactionSettings.purchase[currentButtonType] = { material: 'STONE', buttons: {} };
                    }
                    transactionSettings.purchase[currentButtonType].material = value;
                } else if (!trimmed.endsWith(':')) {
                    const amount = key.trim().replace(/['"]/g, '');
                    if (!transactionSettings.purchase[currentButtonType]) {
                        transactionSettings.purchase[currentButtonType] = { material: 'STONE', buttons: {} };
                    }
                    if (!transactionSettings.purchase[currentButtonType].buttons[amount]) {
                        transactionSettings.purchase[currentButtonType].buttons[amount] = { name: '', slot: 0 };
                    }
                }
            }
        } else if (inButtons && currentButtonType && ['add', 'remove', 'set'].includes(currentButtonType) && indent === 6) {
            const buttonKeys = Object.keys(transactionSettings.purchase[currentButtonType].buttons || {});
            const lastKey = buttonKeys[buttonKeys.length - 1];
            if (lastKey) {
                if (key.trim() === 'name') {
                    transactionSettings.purchase[currentButtonType].buttons[lastKey].name = value;
                } else if (key.trim() === 'slot') {
                    transactionSettings.purchase[currentButtonType].buttons[lastKey].slot = parseInt(value) || 0;
                }
            }
        }
    }
}

function parseSellMenuYaml(yamlContent) {
    const lines = yamlContent.split('\n');
    let inButtons = false;
    let currentButtonType = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith('#')) continue;

        const indent = line.search(/\S/);
        const [key, ...valueParts] = trimmed.split(':');
        const value = valueParts.join(':').trim().replace(/['"]/g, '');

        if (indent === 0) {
            if (key.trim() === 'title-prefix') {
                transactionSettings.sell.titlePrefix = value;
            } else if (key.trim() === 'display-material') {
                transactionSettings.sell.displayMaterial = value;
            } else if (key.trim() === 'display-slot') {
                transactionSettings.sell.displaySlot = parseInt(value) || 22;
            } else if (key.trim() === 'max-amount') {
                transactionSettings.sell.maxAmount = parseInt(value) || 2304;
            } else if (trimmed === 'buttons:') {
                inButtons = true;
            }
        } else if (indent === 2 && !inButtons) {
            if (key.trim() === 'amount') {
                transactionSettings.sell.lore.amount = value;
            } else if (key.trim() === 'total') {
                transactionSettings.sell.lore.total = value;
            }
        } else if (inButtons && indent === 2 && trimmed.endsWith(':')) {
            currentButtonType = key.trim();
        } else if (inButtons && currentButtonType && indent === 4) {
            if (['confirm', 'cancel', 'back', 'sellAll'].includes(currentButtonType)) {
                if (!transactionSettings.sell.buttons[currentButtonType]) {
                    transactionSettings.sell.buttons[currentButtonType] = { material: 'STONE', name: '', slot: 0 };
                }
                if (key.trim() === 'material') {
                    transactionSettings.sell.buttons[currentButtonType].material = value;
                } else if (key.trim() === 'name') {
                    transactionSettings.sell.buttons[currentButtonType].name = value;
                } else if (key.trim() === 'slot') {
                    transactionSettings.sell.buttons[currentButtonType].slot = parseInt(value) || 0;
                }
            } else if (['add', 'remove', 'set'].includes(currentButtonType)) {
                if (key.trim() === 'material') {
                    if (!transactionSettings.sell[currentButtonType]) {
                        transactionSettings.sell[currentButtonType] = { material: 'STONE', buttons: {} };
                    }
                    transactionSettings.sell[currentButtonType].material = value;
                } else if (!trimmed.endsWith(':')) {
                    const amount = key.trim().replace(/['"]/g, '');
                    if (!transactionSettings.sell[currentButtonType]) {
                        transactionSettings.sell[currentButtonType] = { material: 'STONE', buttons: {} };
                    }
                    if (!transactionSettings.sell[currentButtonType].buttons[amount]) {
                        transactionSettings.sell[currentButtonType].buttons[amount] = { name: '', slot: 0 };
                    }
                }
            }
        } else if (inButtons && currentButtonType && ['add', 'remove', 'set'].includes(currentButtonType) && indent === 6) {
            const buttonKeys = Object.keys(transactionSettings.sell[currentButtonType].buttons || {});
            const lastKey = buttonKeys[buttonKeys.length - 1];
            if (lastKey) {
                if (key.trim() === 'name') {
                    transactionSettings.sell[currentButtonType].buttons[lastKey].name = value;
                } else if (key.trim() === 'slot') {
                    transactionSettings.sell[currentButtonType].buttons[lastKey].slot = parseInt(value) || 0;
                }
            }
        }
    }
}

function updateExport() {
    let yaml = `gui-name: '${currentShopSettings.guiName}'\n`;
    yaml += `rows: ${currentShopSettings.rows}\n`;
    const permission = currentShopSettings.permission;
    if (permission) {
        yaml += `permission: '${permission}'\n`;
    }
    if (currentShopSettings.sellAddsToStock) {
        yaml += `sell-adds-to-stock: true\n`;
    }
    if (currentShopSettings.allowSellStockOverflow) {
        yaml += `allow-sell-stock-overflow: true\n`;
    }

    if (currentShopSettings.availableTimes) {
        yaml += `available-times:\n`;
        const availableTimesStr = currentShopSettings.availableTimes;
        availableTimesStr.split('\n').forEach(time => {
            yaml += `  - '${time.trim()}'\n`;
        });
    }
    yaml = appendStockResetYaml(yaml, 0, currentShopSettings.stockResetRule);
    
    yaml += `items:\n`;

    items.forEach(item => {
        yaml += `  - material: ${item.material}\n`;
        yaml += `    name: '${item.name}'\n`;
        if (item.price > 0) yaml += `    price: ${item.price}\n`;
        if (item.sellPrice > 0) yaml += `    sell-price: ${item.sellPrice}\n`;
        yaml += `    amount: ${item.amount}\n`;
        
        if (item.lore && item.lore.length > 0) {
            yaml += `    lore:\n`;
            item.lore.forEach(line => {
                yaml += `      - '${line}'\n`;
            });
        }

        if (item.enchantments && Object.keys(item.enchantments).length > 0) {
            yaml += `    enchantments:\n`;
            Object.entries(item.enchantments).forEach(([ench, level]) => {
                yaml += `      '${ench}': ${level}\n`;
            });
        }

        if (item.hideAttributes) yaml += `    hide-attributes: true\n`;
        if (item.hideAdditional) yaml += `    hide-additional: true\n`;
        if (item.requireName) yaml += `    require-name: true\n`;
        if (item.requireLore) yaml += `    require-lore: true\n`;
        if (item.unstableTnt) yaml += `    unstable-tnt: true\n`;
        if (item.limit > 0) yaml += `    limit: ${item.limit}\n`;
        if (item.globalLimit > 0) yaml += `    global-limit: ${item.globalLimit}\n`;
        if (item.dynamicPricing) yaml += `    dynamic-pricing: true\n`;
        if (item.minPrice > 0) yaml += `    min-price: ${item.minPrice}\n`;
        if (item.maxPrice > 0) yaml += `    max-price: ${item.maxPrice}\n`;
        if (item.priceChange !== 0) yaml += `    price-change: ${item.priceChange}\n`;
        if (item.runCommandOnly === false) yaml += `    run-command-only: false\n`;
        if (item.runAs && item.runAs !== 'console') yaml += `    run-as: ${item.runAs}\n`;
        if (item.permission) yaml += `    permission: '${item.permission}'\n`;
        if (item.sellAddsToStock !== null) yaml += `    sell-adds-to-stock: ${item.sellAddsToStock ? 'true' : 'false'}\n`;
        if (item.allowSellStockOverflow !== null) yaml += `    allow-sell-stock-overflow: ${item.allowSellStockOverflow ? 'true' : 'false'}\n`;
        if (item.showStock) yaml += `    show-stock: true\n`;
        if (item.showStockResetTimer) yaml += `    show-stock-reset-timer: true\n`;

        if (item.commands && item.commands.length > 0) {
            yaml += `    commands:\n`;
            item.commands.forEach(cmd => {
                yaml += `      - '${cmd}'\n`;
            });
        }
        
        if (item.spawnerType) yaml += `    spawner-type: ${item.spawnerType}\n`;
        if (item.spawnerItem) yaml += `    spawner-item: ${item.spawnerItem}\n`;
        if (item.potionType) yaml += `    potion-type: ${item.potionType}\n`;
        if (item.potionLevel !== undefined && item.potionLevel !== 0) yaml += `    potion-level: ${item.potionLevel}\n`;
        if (item.headTexture) yaml += `    head-texture: '${item.headTexture}'\n`;
        if (item.headOwner) yaml += `    head-owner: '${item.headOwner}'\n`;
        yaml = appendStockResetYaml(yaml, 4, item.stockResetRule);
        if (item.slot !== undefined && item.slot !== null) yaml += `    slot: ${item.slot}\n`;
    });

    document.getElementById('export-output').textContent = yaml;
}

function parseGuiSettingsYaml(yamlContent) {
    const lines = yamlContent.split('\n');
    let inGui = false;
    let inItemLore = false;
    let inBackButton = false;
    let inPrevButton = false;
    let inNextButton = false;
    let inLore = false;
    let currentLoreArray = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const indent = line.search(/\S/);

        if (indent === 0 && trimmed === 'gui:') {
            inGui = true;
            continue;
        }

        if (inGui) {
            if (indent === 2) {
                inItemLore = trimmed === 'item-lore:';
                inBackButton = trimmed === 'back-button:';
                inPrevButton = trimmed === 'prev-button:';
                inNextButton = trimmed === 'next-button:';
                inLore = false;
                continue;
            }

            if (indent === 4) {
                inLore = false;
                const [key, ...valueParts] = trimmed.split(':');
                const value = valueParts.join(':').trim().replace(/['"]/g, '');

                if (inItemLore) {
                    if (key === 'show-buy-price') guiSettings.itemLore.showBuyPrice = value === 'true';
                    else if (key === 'buy-price-line') guiSettings.itemLore.buyPriceLine = value;
                    else if (key === 'show-sell-price') guiSettings.itemLore.showSellPrice = value === 'true';
                    else if (key === 'sell-price-line') guiSettings.itemLore.sellPriceLine = value;
                    else if (key === 'show-buy-hint') guiSettings.itemLore.showBuyHint = value === 'true';
                    else if (key === 'buy-hint-line') guiSettings.itemLore.buyHintLine = value;
                    else if (key === 'show-sell-hint') guiSettings.itemLore.showSellHint = value === 'true';
                    else if (key === 'sell-hint-line') guiSettings.itemLore.sellHintLine = value;
                    else if (key === 'amount-line') guiSettings.itemLore.amountLine = value;
                    else if (key === 'total-line') guiSettings.itemLore.totalLine = value;
                    else if (key === 'spawner-type-line') guiSettings.itemLore.spawnerTypeLine = value;
                    else if (key === 'spawner-item-line') guiSettings.itemLore.spawnerItemLine = value;
                    else if (key === 'potion-type-line') guiSettings.itemLore.potionTypeLine = value;
                    else if (key === 'global-limit-line') guiSettings.itemLore.globalLimitLine = value;
                    else if (key === 'player-limit-line') guiSettings.itemLore.playerLimitLine = value;
                    else if (key === 'stock-reset-timer-line') guiSettings.itemLore.stockResetTimerLine = value;
                    else if (key === 'global-limit-value-format') guiSettings.itemLore.globalLimitValueFormat = value;
                    else if (key === 'player-limit-value-format') guiSettings.itemLore.playerLimitValueFormat = value;
                    else if (key === 'stock-reset-timer-value-format') guiSettings.itemLore.stockResetTimerValueFormat = value;
                    else if (key === 'lore-format') {
                        inLore = true;
                        guiSettings.itemLore.loreFormat = [];
                        currentLoreArray = guiSettings.itemLore.loreFormat;
                    }
                } else if (inBackButton || inPrevButton || inNextButton) {
                    const btn = inBackButton ? guiSettings.backButton : (inPrevButton ? guiSettings.prevButton : guiSettings.nextButton);
                    if (key === 'name') btn.name = value;
                    else if (key === 'lore') {
                        inLore = true;
                        btn.lore = [];
                        currentLoreArray = btn.lore;
                    }
                }
                continue;
            }

            if (indent >= 4 && inLore && trimmed.startsWith('-')) {
                const loreLine = trimmed.substring(1).trim().replace(/['"]/g, '');
                currentLoreArray.push(loreLine);
            }
        }
    }
}

function generateGuiSettingsYaml() {
    let yaml = `# Common GUI settings shared across all menus\n`;
    yaml += `# This file contains buttons and settings used in shop pages\n\n`;
    yaml += `config-version: 3\n\n`;
    yaml += `gui:\n`;
    
    const writeButton = (key, btn) => {
        yaml += `  ${key}:\n`;
        yaml += `    name: '${btn.name}'\n`;
        yaml += `    lore:\n`;
        if (btn.lore && btn.lore.length > 0) {
            btn.lore.forEach(line => {
                yaml += `      - '${line}'\n`;
            });
        } else {
            yaml += `      []\n`;
        }
    };

    writeButton('back-button', guiSettings.backButton);
    yaml += `\n`;
    writeButton('prev-button', guiSettings.prevButton);
    yaml += `\n`;
    writeButton('next-button', guiSettings.nextButton);
    yaml += `\n`;

    yaml += `  # Controls lore lines on shop items\n`;
    yaml += `  item-lore:\n`;
    yaml += `    # Price display lines (shown at top of item lore)\n`;
    yaml += `    show-buy-price: ${guiSettings.itemLore.showBuyPrice}\n`;
    yaml += `    buy-price-line: '${guiSettings.itemLore.buyPriceLine}'\n`;
    yaml += `    show-sell-price: ${guiSettings.itemLore.showSellPrice}\n`;
    yaml += `    sell-price-line: '${guiSettings.itemLore.sellPriceLine}'\n`;
    yaml += `\n`;
    yaml += `    # Hint lines (shown at bottom of item lore)\n`;
    yaml += `    show-buy-hint: ${guiSettings.itemLore.showBuyHint}\n`;
    yaml += `    buy-hint-line: '${guiSettings.itemLore.buyHintLine}'\n`;
    yaml += `    show-sell-hint: ${guiSettings.itemLore.showSellHint}\n`;
    yaml += `    sell-hint-line: '${guiSettings.itemLore.sellHintLine}'\n`;
    yaml += `\n`;
    yaml += `    # Purchase menu amount and total lines\n`;
    yaml += `    amount-line: '${guiSettings.itemLore.amountLine}'\n`;
    yaml += `    total-line: '${guiSettings.itemLore.totalLine}'\n`;
    yaml += `    spawner-type-line: '${guiSettings.itemLore.spawnerTypeLine}'\n`;
    yaml += `    spawner-item-line: '${guiSettings.itemLore.spawnerItemLine}'\n`;
    yaml += `    potion-type-line: '${guiSettings.itemLore.potionTypeLine}'\n`;
    yaml += `    global-limit-line: '${guiSettings.itemLore.globalLimitLine}'\n`;
    yaml += `    player-limit-line: '${guiSettings.itemLore.playerLimitLine}'\n`;
    yaml += `    stock-reset-timer-line: '${guiSettings.itemLore.stockResetTimerLine}'\n`;
    yaml += `    global-limit-value-format: '${guiSettings.itemLore.globalLimitValueFormat}'\n`;
    yaml += `    player-limit-value-format: '${guiSettings.itemLore.playerLimitValueFormat}'\n`;
    yaml += `    stock-reset-timer-value-format: '${guiSettings.itemLore.stockResetTimerValueFormat}'\n`;
    yaml += `\n`;
    yaml += `    # Format of the item lore in shop pages\n`;
    yaml += `    # Available placeholders:\n`;
    yaml += `    # %price-line%, %buy-price-line%, %sell-price-line%\n`;
    yaml += `    # %custom-lore%, %spawner-type-line%, %spawner-item-line%, %potion-type-line%\n`;
    yaml += `    # %global-limit%, %player-limit%, %stock-reset-timer%\n`;
    yaml += `    # %hint-line%, %buy-hint-line%, %sell-hint-line%\n`;
    yaml += `    lore-format:\n`;
    if (guiSettings.itemLore.loreFormat && guiSettings.itemLore.loreFormat.length > 0) {
        guiSettings.itemLore.loreFormat.forEach(line => {
            yaml += `      - '${line}'\n`;
        });
    } else {
        yaml += `      []\n`;
    }

    return yaml;
}

function parseTransactionSettings(yamlContent) {
    const lines = yamlContent.split('\n');
    let inPurchase = false;
    let inSell = false;
    let inPurchaseLore = false;
    let inSellLore = false;
    let inPurchaseButtons = false;
    let inSellButtons = false;
    let currentButtonType = null; // 'add', 'remove', 'set'

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const indent = line.search(/\S/);

        // Detect purchase section (indent 2)
        if (indent === 2 && trimmed === 'purchase:') {
            inPurchase = true;
            inSell = false;
            inPurchaseLore = false;
            inPurchaseButtons = false;
            currentButtonType = null;
            continue;
        }

        // Detect sell section (indent 2)
        if (indent === 2 && trimmed === 'sell:') {
            inSell = true;
            inPurchase = false;
            inSellLore = false;
            inSellButtons = false;
            currentButtonType = null;
            continue;
        }

        // Detect lore section (indent 4)
        if (indent === 4 && trimmed === 'lore:') {
            if (inPurchase) inPurchaseLore = true;
            if (inSell) inSellLore = true;
            continue;
        }

        // Detect buttons section (indent 4)
        if (indent === 4 && trimmed === 'buttons:') {
            if (inPurchase) inPurchaseButtons = true;
            if (inSell) inSellButtons = true;
            continue;
        }

        // Detect button type (indent 6)
        if ((inPurchaseButtons || inSellButtons) && indent === 6 && trimmed.endsWith(':')) {
            currentButtonType = trimmed.slice(0, -1);
            continue;
        }

        // Properties (indent 4 or 8)
        const [key, ...valueParts] = trimmed.split(':');
        const value = valueParts.join(':').trim().replace(/['"]/g, '');

        if (inPurchase && indent === 4) {
            if (key === 'rows') transactionSettings.purchase.rows = parseInt(value);
            if (key === 'display-material') transactionSettings.purchase.displayMaterial = value;
            if (key === 'title-prefix') transactionSettings.purchase.titlePrefix = value;
            if (key === 'display-slot') transactionSettings.purchase.displaySlot = parseInt(value);
            if (key === 'max-amount') transactionSettings.purchase.maxAmount = parseInt(value);
        } else if (inSell && indent === 4) {
            if (key === 'rows') transactionSettings.sell.rows = parseInt(value);
            if (key === 'display-material') transactionSettings.sell.displayMaterial = value;
            if (key === 'title-prefix') transactionSettings.sell.titlePrefix = value;
            if (key === 'display-slot') transactionSettings.sell.displaySlot = parseInt(value);
            if (key === 'max-amount') transactionSettings.sell.maxAmount = parseInt(value);
        } else if (inPurchaseLore && indent === 6) {
            // Handle purchase lore placeholders
        } else if (inSellLore && indent === 6) {
            // Handle sell lore placeholders
        } else if (currentButtonType && indent === 8) {
            // Handle amount button properties
            const type = inPurchase ? 'purchase' : 'sell';
            const group = ['add', 'remove', 'set'].includes(currentButtonType) ? currentButtonType : 'main';
            const buttonKey = group === 'main' ? currentButtonType : trimmed.split(':')[0].trim();
            // This needs more detailed logic to match the complex parser in script.js
        }
    }
}


function parseMinecraftColors(text) {
    if (!text) return '';

    // Support both legacy section sign and ampersand codes in preview rendering.
    let source = String(text)
        .replace(/Ãƒâ€šÃ‚Â§/g, '§')
        .replace(/Ã‚Â§/g, '§')
        .replace(/Â§/g, '§')
        .replace(/§/g, '&');

    // Expand <gradient:#RRGGBB:#RRGGBB:...>Text</gradient> to per-char hex codes.
    source = expandGradientTags(source);

    // Escape HTML to avoid XSS and unwanted entity parsing.
    let escaped = escapeHtml(source);

    // Hex colors: &#RRGGBB (escaped as &amp;#RRGGBB)
    escaped = escaped.replace(/&amp;#([0-9a-fA-F]{6})/g, (_, hex) => {
        return `</span><span style="color: #${hex}">`;
    });

    const colors = {
        '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
        '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
        '8': '#555555', '9': '#5555FF', 'a': '#55FF55', 'b': '#55FFFF',
        'c': '#FF5555', 'd': '#FF55FF', 'e': '#FFFF55', 'f': '#FFFFFF'
    };

    // Standard color codes (&0-9, &a-f)
    Object.entries(colors).forEach(([code, hex]) => {
        const regex = new RegExp(`&amp;${code}`, 'gi');
        escaped = escaped.replace(regex, `</span><span style="color: ${hex}">`);
    });

    // Format codes
    escaped = escaped.replace(/&amp;l/gi, '</span><span style="font-weight: bold;">');
    escaped = escaped.replace(/&amp;o/gi, '</span><span style="font-style: italic;">');
    escaped = escaped.replace(/&amp;n/gi, '</span><span style="text-decoration: underline;">');
    escaped = escaped.replace(/&amp;m/gi, '</span><span style="text-decoration: line-through;">');
    escaped = escaped.replace(/&amp;r/gi, '</span><span>');

    return '<span>' + escaped + '</span>';
}

function expandGradientTags(input) {
    if (!input) return '';
    return input.replace(/<gradient:((?:#?[0-9a-fA-F]{6}:)*#?[0-9a-fA-F]{6})>([\s\S]*?)<\/gradient>/gi, (_, stopSpec, content) => {
        const stops = String(stopSpec)
            .split(':')
            .map(part => part.trim().replace(/^#/, ''))
            .filter(part => /^[0-9a-fA-F]{6}$/.test(part));
        return applyGradient(content, stops);
    });
}

function applyGradient(content, stops) {
    if (!content) return '';
    if (!stops || stops.length === 0) return content;
    if (stops.length === 1) stops = [stops[0], stops[0]];

    const chars = Array.from(content);
    if (chars.length <= 1) {
        return `&#${stops[0]}${content}`;
    }

    const rgbStops = stops.map(hexToRgb);
    let out = '';

    chars.forEach((char, index) => {
        const t = index / (chars.length - 1);
        const scaled = t * (rgbStops.length - 1);
        const segment = Math.min(Math.floor(scaled), rgbStops.length - 2);
        const localT = scaled - segment;
        const from = rgbStops[segment];
        const to = rgbStops[segment + 1];
        const r = Math.round(from.r + (to.r - from.r) * localT);
        const g = Math.round(from.g + (to.g - from.g) * localT);
        const b = Math.round(from.b + (to.b - from.b) * localT);
        out += `&#${toHex(r)}${toHex(g)}${toHex(b)}${char}`;
    });

    return out;
}

function hexToRgb(hex) {
    const clean = (hex || '000000').trim();
    return {
        r: parseInt(clean.substring(0, 2), 16),
        g: parseInt(clean.substring(2, 4), 16),
        b: parseInt(clean.substring(4, 6), 16)
    };
}

function toHex(value) {
    return Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0').toUpperCase();
}
