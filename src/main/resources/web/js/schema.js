// ===== DATA SCHEMAS (NORMALIZATION + VALIDATION) =====

(function attachSchemaApi(global) {
    function toStringSafe(value, fallback) {
        if (value === undefined || value === null) return fallback;
        return String(value);
    }

    function toNumberSafe(value, fallback) {
        const num = Number(value);
        return Number.isFinite(num) ? num : fallback;
    }

    function toIntSafe(value, fallback) {
        const num = parseInt(value, 10);
        return Number.isFinite(num) ? num : fallback;
    }

    function toBooleanSafe(value, fallback) {
        if (value === undefined || value === null) return fallback;
        return !!value;
    }

    function normalizeStringList(value) {
        if (!Array.isArray(value)) return [];
        return value.map(v => toStringSafe(v, '')).filter(v => v.length > 0);
    }

    function normalizeCampaign(input) {
        const src = input || {};
        return {
            key: toStringSafe(src.key, ''),
            name: toStringSafe(src.name, ''),
            start: toStringSafe(src.start, ''),
            end: toStringSafe(src.end, ''),
            timezone: toStringSafe(src.timezone, ''),
            buyMultiplier: Math.max(0.01, toNumberSafe(src.buyMultiplier, 1)),
            sellMultiplier: Math.max(0.01, toNumberSafe(src.sellMultiplier, 1))
        };
    }

    function normalizeShopSettings(settings) {
        const src = settings || {};
        const stockResetRule = (typeof global.sanitizeStockResetRule === 'function')
            ? global.sanitizeStockResetRule(src.stockResetRule)
            : (src.stockResetRule || {});

        return {
            guiName: toStringSafe(src.guiName, '&8Shop'),
            rows: Math.max(1, Math.min(6, toIntSafe(src.rows, 3))),
            permission: toStringSafe(src.permission, ''),
            campaign: toStringSafe(src.campaign, ''),
            campaigns: Array.isArray(src.campaigns) ? src.campaigns.map(normalizeCampaign).filter(c => c.key) : [],
            availableTimes: toStringSafe(src.availableTimes, ''),
            sellAddsToStock: toBooleanSafe(src.sellAddsToStock, false),
            allowSellStockOverflow: toBooleanSafe(src.allowSellStockOverflow, false),
            stockResetRule
        };
    }

    function normalizeShopItem(item) {
        const src = item || {};
        const safeStockResetRule = (typeof global.sanitizeStockResetRule === 'function')
            ? global.sanitizeStockResetRule(src.stockResetRule)
            : (src.stockResetRule || {});
        const safeEnchantments = (src.enchantments && typeof src.enchantments === 'object' && !Array.isArray(src.enchantments))
            ? src.enchantments
            : {};

        return {
            ...src,
            id: toIntSafe(src.id, -1),
            material: toStringSafe(src.material, 'STONE'),
            name: toStringSafe(src.name, '&eItem'),
            itemKey: toStringSafe(src.itemKey, ''),
            variantKey: toStringSafe(src.variantKey, ''),
            headTexture: toStringSafe(src.headTexture, ''),
            headOwner: toStringSafe(src.headOwner, ''),
            itemStack: toStringSafe(src.itemStack, ''),
            price: Math.max(0, toNumberSafe(src.price, 0)),
            sellPrice: Math.max(0, toNumberSafe(src.sellPrice, 0)),
            buyPricePerItem: toBooleanSafe(src.buyPricePerItem, true),
            sellPricePerItem: toBooleanSafe(src.sellPricePerItem, true),
            campaignEnabled: toBooleanSafe(src.campaignEnabled, false),
            campaign: toStringSafe(src.campaign, ''),
            campaignName: toStringSafe(src.campaignName, ''),
            campaignStart: toStringSafe(src.campaignStart, ''),
            campaignEnd: toStringSafe(src.campaignEnd, ''),
            campaignTimezone: toStringSafe(src.campaignTimezone, ''),
            campaignBuyMultiplier: Math.max(0.01, toNumberSafe(src.campaignBuyMultiplier, 1)),
            campaignSellMultiplier: Math.max(0.01, toNumberSafe(src.campaignSellMultiplier, 1)),
            amount: Math.max(1, toIntSafe(src.amount, 1)),
            lore: normalizeStringList(src.lore),
            enchantments: safeEnchantments,
            hideAttributes: toBooleanSafe(src.hideAttributes, false),
            hideAdditional: toBooleanSafe(src.hideAdditional, false),
            requireName: toBooleanSafe(src.requireName, false),
            requireLore: toBooleanSafe(src.requireLore, false),
            unstableTnt: toBooleanSafe(src.unstableTnt, false),
            spawnerType: src.spawnerType ? toStringSafe(src.spawnerType, null) : null,
            spawnerItem: src.spawnerItem ? toStringSafe(src.spawnerItem, null) : null,
            potionType: src.potionType ? toStringSafe(src.potionType, null) : null,
            potionLevel: toIntSafe(src.potionLevel, 0),
            commands: normalizeStringList(src.commands),
            runAs: toStringSafe(src.runAs, 'console'),
            minPlayerLevel: Math.max(0, toIntSafe(src.minPlayerLevel, 0)),
            maxPlayerLevel: Math.max(0, toIntSafe(src.maxPlayerLevel, 0)),
            requiredGamemode: toStringSafe(src.requiredGamemode, ''),
            allowedWorlds: normalizeStringList(src.allowedWorlds),
            deniedWorlds: normalizeStringList(src.deniedWorlds),
            limit: Math.max(0, toIntSafe(src.limit, 0)),
            globalLimit: Math.max(0, toIntSafe(src.globalLimit, 0)),
            dynamicPricing: toBooleanSafe(src.dynamicPricing, false),
            minPrice: Math.max(0, toNumberSafe(src.minPrice, 0)),
            maxPrice: Math.max(0, toNumberSafe(src.maxPrice, 0)),
            priceChange: toNumberSafe(src.priceChange, 0),
            buyPriceFormula: toStringSafe(src.buyPriceFormula, ''),
            sellPriceFormula: toStringSafe(src.sellPriceFormula, ''),
            stockResetRule: safeStockResetRule,
            showStock: toBooleanSafe(src.showStock, false),
            showStockResetTimer: toBooleanSafe(src.showStockResetTimer, false),
            runCommandOnly: toBooleanSafe(src.runCommandOnly, true),
            permission: toStringSafe(src.permission, ''),
            sellAddsToStock: (src.sellAddsToStock === null || src.sellAddsToStock === undefined) ? null : !!src.sellAddsToStock,
            allowSellStockOverflow: (src.allowSellStockOverflow === null || src.allowSellStockOverflow === undefined) ? null : !!src.allowSellStockOverflow,
            slot: (src.slot === null || src.slot === undefined) ? null : Math.max(0, toIntSafe(src.slot, 0))
        };
    }

    function validateShopItem(item, index) {
        const errors = [];
        const label = `items[${index}]`;
        if (!item.material || !String(item.material).trim()) errors.push(`${label}.material is required`);
        if (!item.name || !String(item.name).trim()) errors.push(`${label}.name is required`);
        if (!Number.isFinite(Number(item.amount)) || Number(item.amount) < 1) errors.push(`${label}.amount must be >= 1`);
        if (!Number.isFinite(Number(item.price)) || Number(item.price) < 0) errors.push(`${label}.price must be >= 0`);
        if (!Number.isFinite(Number(item.sellPrice)) || Number(item.sellPrice) < 0) errors.push(`${label}.sellPrice must be >= 0`);
        if (item.slot !== null && (!Number.isInteger(item.slot) || item.slot < 0)) errors.push(`${label}.slot must be null or >= 0 integer`);
        return errors;
    }

    function validateShopSettings(settings) {
        const errors = [];
        if (!settings.guiName || !String(settings.guiName).trim()) errors.push('shopSettings.guiName is required');
        if (!Number.isInteger(settings.rows) || settings.rows < 1 || settings.rows > 6) errors.push('shopSettings.rows must be between 1 and 6');
        return errors;
    }

    function validateCurrentEditorState(state) {
        const src = state || {};
        const safeItems = Array.isArray(src.items) ? src.items : [];
        const safeSettings = src.currentShopSettings || {};
        const errors = [];

        errors.push(...validateShopSettings(safeSettings));
        for (let i = 0; i < safeItems.length; i++) {
            errors.push(...validateShopItem(safeItems[i], i));
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    global.GeniusSchemas = {
        normalizeCampaign,
        normalizeShopSettings,
        normalizeShopItem,
        validateShopItem,
        validateCurrentEditorState
    };
})(window);
