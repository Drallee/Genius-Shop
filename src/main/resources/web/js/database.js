// ===== YAML PARSING & GENERATION =====

function parseShopYaml(yamlContent) {
    items = [];
    itemIdCounter = 0;

    // Decode HTML entities if present (e.g., &amp; -> &)
    yamlContent = yamlContent.replace(/&amp;/g, '&');

    const lines = yamlContent.split('\n');
    let currentItem = null;
    let inLore = false;
    let inItemsSection = false;
    let inAvailableTimes = false;
    let inShopItemLore = false;
    let availableTimesList = [];

    console.log('Parsing shop YAML, total lines:', lines.length);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith('#')) continue;

        const indent = line.search(/\S/);

        // Parse shop-level item-lore settings (indent 2)
        if (!inItemsSection && inShopItemLore && indent === 2) {
            const [key, ...valueParts] = trimmed.split(':');
            const value = valueParts.join(':').trim().replace(/['"]/g, '');

            if (key.trim() === 'shop-show-buy-price') {
                currentShopSettings.itemLore.showBuyPrice = value === 'true';
            } else if (key.trim() === 'shop-buy-price-line') {
                currentShopSettings.itemLore.buyPriceLine = value;
            } else if (key.trim() === 'shop-show-buy-hint') {
                currentShopSettings.itemLore.showBuyHint = value === 'true';
            } else if (key.trim() === 'shop-buy-hint-line') {
                currentShopSettings.itemLore.buyHintLine = value;
            } else if (key.trim() === 'shop-show-sell-price') {
                currentShopSettings.itemLore.showSellPrice = value === 'true';
            } else if (key.trim() === 'shop-sell-price-line') {
                currentShopSettings.itemLore.sellPriceLine = value;
            } else if (key.trim() === 'shop-show-sell-hint') {
                currentShopSettings.itemLore.showSellHint = value === 'true';
            } else if (key.trim() === 'shop-sell-hint-line') {
                currentShopSettings.itemLore.sellHintLine = value;
            }
        }

        // Parse shop-level properties (before items section)
        if (!inItemsSection && indent === 0 && trimmed.includes(':') && !trimmed.startsWith('-')) {
            const [key, ...valueParts] = trimmed.split(':');
            const value = valueParts.join(':').trim().replace(/['"]/g, '');

            if (key.trim() === 'gui-name') {
                currentShopSettings.guiName = value;
                inAvailableTimes = false;
                inShopItemLore = false;
            } else if (key.trim() === 'rows') {
                currentShopSettings.rows = parseInt(value) || 3;
                inAvailableTimes = false;
                inShopItemLore = false;
            } else if (key.trim() === 'permission') {
                currentShopSettings.permission = value;
                inAvailableTimes = false;
                inShopItemLore = false;
            } else if (key.trim() === 'available-times') {
                inAvailableTimes = true;
                inShopItemLore = false;
                availableTimesList = [];
            } else if (key.trim() === 'item-lore') {
                inShopItemLore = true;
                inAvailableTimes = false;
            }
        }

        // Parse available-times list items (indent 2)
        if (inAvailableTimes && indent === 2 && trimmed.startsWith('-')) {
            const timeValue = trimmed.substring(1).trim().replace(/['"]/g, '');
            availableTimesList.push(timeValue);
        }

        // Check if we're in the items section
        if (indent === 0 && trimmed === 'items:') {
            inItemsSection = true;
            inAvailableTimes = false;
            inShopItemLore = false;
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
                price: 0,
                sellPrice: 0,
                amount: 1,
                lore: [],
                enchantments: {},
                hideAttributes: false,
                hideAdditional: false,
                requireName: false,
                requireLore: false,
                unstableTnt: false
            };
            inLore = false;
        } else if (inItemsSection && trimmed === '-') {
            if (currentItem) {
                items.push(currentItem);
            }
            currentItem = {
                id: itemIdCounter++,
                material: 'STONE',
                name: '&eItem',
                price: 0,
                sellPrice: 0,
                amount: 1,
                lore: [],
                enchantments: {},
                hideAttributes: false,
                hideAdditional: false,
                requireName: false,
                requireLore: false,
                unstableTnt: false
            };
            inLore = false;
        } else if (currentItem && indent >= 2) {
            const [key, ...valueParts] = trimmed.split(':');
            const value = valueParts.join(':').trim().replace(/['"]/g, '');

            if (key.trim() === 'material') {
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
            } else if (trimmed.startsWith('-') && inLore) {
                const loreLine = trimmed.substring(1).trim().replace(/['"]/g, '');
                currentItem.lore.push(loreLine);
            } else if (indent >= 4 && !inLore && trimmed.includes(':')) {
                // Could be enchantment or other nested property
                if (line.includes(':')) {
                    const [subKey, subVal] = trimmed.split(':');
                    // Handle enchantments
                    if (currentItem.enchantments) {
                        currentItem.enchantments[subKey.trim().toUpperCase()] = parseInt(subVal.trim()) || 1;
                    }
                }
            }
        }
    }

    if (currentItem) {
        items.push(currentItem);
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

            if (currentShop && currentShop.slot !== null) {
                loadedGuiShops.push(currentShop);
            }

            currentShop = {
                key: shopKey,
                slot: null,
                material: 'CHEST',
                name: shopKey,
                lore: [],
                shopKey: shopKey,
                permission: '',
                hideAttributes: false,
                hideAdditional: false
            };
            currentField = null;
        } else if (currentField === 'lore' && indent > 4 && trimmed.startsWith('-')) {
            const loreValue = trimmed.substring(1).trim().replace(/['"]/g, '');
            if (currentShop) {
                currentShop.lore.push(loreValue);
            }
        } else if (currentShop && indent === 4 && trimmed.includes(':') && !trimmed.startsWith('-')) {
            if (currentField === 'lore') currentField = null;

            const [key, ...valueParts] = trimmed.split(':');
            const value = valueParts.join(':').trim().replace(/['"]/g, '');

            if (key.trim() === 'slot') {
                currentShop.slot = parseInt(value);
            } else if (key.trim() === 'material') {
                currentShop.material = value;
            } else if (key.trim() === 'name') {
                currentShop.name = value;
            } else if (key.trim() === 'lore') {
                currentField = 'lore';
            } else if (key.trim() === 'shop-key') {
                currentShop.shopKey = value;
            } else if (key.trim() === 'permission') {
                currentShop.permission = value;
            } else if (key.trim() === 'hide-attributes') {
                currentShop.hideAttributes = value.toLowerCase() === 'true';
            } else if (key.trim() === 'hide-additional') {
                currentShop.hideAdditional = value.toLowerCase() === 'true';
            }
        }
    }

    if (currentShop && currentShop.slot !== null) {
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

    const availableTimes = currentShopSettings.availableTimes.trim();
    if (availableTimes) {
        yaml += `available-times:\n`;
        availableTimes.split('\n').forEach(time => {
            if (time.trim()) {
                yaml += `  - '${time.trim()}'\n`;
            }
        });
    }

    // Add item-lore settings
    yaml += `item-lore:\n`;
    yaml += `  shop-show-buy-price: ${currentShopSettings.itemLore.showBuyPrice}\n`;
    yaml += `  shop-buy-price-line: '${currentShopSettings.itemLore.buyPriceLine}'\n`;
    yaml += `  shop-show-buy-hint: ${currentShopSettings.itemLore.showBuyHint}\n`;
    yaml += `  shop-buy-hint-line: '${currentShopSettings.itemLore.buyHintLine}'\n`;
    yaml += `  shop-show-sell-price: ${currentShopSettings.itemLore.showSellPrice}\n`;
    yaml += `  shop-sell-price-line: '${currentShopSettings.itemLore.sellPriceLine}'\n`;
    yaml += `  shop-show-sell-hint: ${currentShopSettings.itemLore.showSellHint}\n`;
    yaml += `  shop-sell-hint-line: '${currentShopSettings.itemLore.sellHintLine}'\n`;

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
                yaml += `      ${ench}: ${level}\n`;
            });
        }

        if (item.hideAttributes) yaml += `    hide-attributes: true\n`;
        if (item.hideAdditional) yaml += `    hide-additional: true\n`;
        if (item.requireName) yaml += `    require-name: true\n`;
        if (item.requireLore) yaml += `    require-lore: true\n`;
        if (item.unstableTnt) yaml += `    unstable-tnt: true\n`;
        if (item.limit > 0) yaml += `    limit: ${item.limit}\n`;
        if (item.dynamicPricing) yaml += `    dynamic-pricing: true\n`;
        if (item.minPrice > 0) yaml += `    min-price: ${item.minPrice}\n`;
        if (item.maxPrice > 0) yaml += `    max-price: ${item.maxPrice}\n`;
        if (item.priceChange !== 0) yaml += `    price-change: ${item.priceChange}\n`;
    });

    document.getElementById('export-output').textContent = yaml;
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
            if (key === 'display-material') transactionSettings.purchase.displayMaterial = value;
            if (key === 'title-prefix') transactionSettings.purchase.titlePrefix = value;
            if (key === 'display-slot') transactionSettings.purchase.displaySlot = parseInt(value);
            if (key === 'max-amount') transactionSettings.purchase.maxAmount = parseInt(value);
        } else if (inSell && indent === 4) {
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
    
    // 1. Escape HTML special characters to prevent XSS and unwanted entity parsing (like &#...)
    let escaped = escapeHtml(text);

    // 2. Handle Hex Colors: &#RRGGBB (Minecraft 1.16+)
    // In our escaped text, this looks like &amp;#RRGGBB
    escaped = escaped.replace(/&amp;#([0-9a-fA-F]{6})/g, (match, hex) => {
        return `</span><span style="color: #${hex}">`;
    });

    const colors = {
        '0': '#000000', '1': '#0000AA', '2': '#00AA00', '3': '#00AAAA',
        '4': '#AA0000', '5': '#AA00AA', '6': '#FFAA00', '7': '#AAAAAA',
        '8': '#555555', '9': '#5555FF', 'a': '#55FF55', 'b': '#55FFFF',
        'c': '#FF5555', 'd': '#FF55FF', 'e': '#FFFF55', 'f': '#FFFFFF'
    };
    
    // 3. Replace standard color codes (&amp;0-9, &amp;a-f)
    Object.entries(colors).forEach(([code, hex]) => {
        const regex = new RegExp(`&amp;${code}`, 'gi');
        escaped = escaped.replace(regex, `</span><span style="color: ${hex}">`);
    });
    
    // 4. Replace format codes
    escaped = escaped.replace(/&amp;l/gi, '</span><span style="font-weight: bold;">');
    escaped = escaped.replace(/&amp;o/gi, '</span><span style="font-style: italic;">');
    escaped = escaped.replace(/&amp;n/gi, '</span><span style="text-decoration: underline;">');
    escaped = escaped.replace(/&amp;m/gi, '</span><span style="text-decoration: line-through;">');
    escaped = escaped.replace(/&amp;r/gi, '</span><span>');
    
    return '<span>' + escaped + '</span>';
}
