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

function parseCampaignsFileYaml(yamlContent) {
    EditorYaml.readCampaigns(yamlContent || 'campaigns: []\n');
}

function generateCampaignsFileYaml() {
    return EditorYaml.writeCampaigns();
}

function parseShopYaml(yamlContent, retain = true) {
    EditorYaml.readShop(yamlContent, retain);
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
    EditorYaml.readMain(yamlContent);
}

function parsePurchaseMenuYaml(yamlContent) {
    EditorYaml.readTransaction('purchase', yamlContent);
}

function parseSellMenuYaml(yamlContent) {
    EditorYaml.readTransaction('sell', yamlContent);
}

function updateExport() {
    const validation = window.GeniusSchemas.validateCurrentEditorState({ items, currentShopSettings });
    window.__schemaErrors = validation.errors || [];
    document.getElementById('export-output').textContent = EditorYaml.writeShop();
}

function parseGuiSettingsYaml(yamlContent) {
    EditorYaml.readGui(yamlContent);
}

function generateGuiSettingsYaml() {
    return EditorYaml.writeGui();
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
    text = resolveMessageText(text);

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
