// ===== UI RENDERING & PREVIEW =====

function updateGroupMaterial(type, group, material) {
    const beforeData = transactionSettings[type][group].material;
    transactionSettings[type][group].material = material.toUpperCase();
    
    addActivityEntry('updated', `${type}-menu-group-material`, beforeData, transactionSettings[type][group].material, {
        type: type,
        group: group
    });

    if (type === 'purchase') {
        updatePurchasePreview();
    } else {
        updateSellPreview();
    }
    scheduleAutoSave();
}

function getHeadTexturePreviewUrl(headTexture) {
    const texture = (headTexture || '').trim();
    if (!texture) return null;

    const match = texture.match(/textures\.minecraft\.net\/texture\/([A-Za-z0-9_-]+)/i);
    if (match && match[1]) {
        return `https://mc-heads.net/head/${match[1]}/64`;
    }

    if (/^[A-Za-z0-9_-]{20,}$/.test(texture) && !texture.startsWith('http')) {
        return `https://mc-heads.net/head/${texture}/64`;
    }

    // mc-heads supports base64 texture values as path input.
    return `https://mc-heads.net/head/${encodeURIComponent(texture)}/64`;
}

function getShopItemIconUrl(item) {
    if (item && item.material === 'PLAYER_HEAD' && item.headTexture) {
        const preview = getHeadTexturePreviewUrl(item.headTexture);
        if (preview) return preview;
    }
    const material = item && item.material ? item.material : 'STONE';
    return `${TEXTURE_API}${material.toLowerCase()}.png`;
}

function formatDisplayPrice(value) {
    const num = Number(value) || 0;
    const trim = (n, maxDecimals = 2) => {
        if (Number.isInteger(n)) return String(n);
        if (maxDecimals <= 0) return String(Math.round(n));
        return n.toFixed(maxDecimals).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
    };
    const abs = Math.abs(num);
    if (abs >= 1_000_000_000) return `${trim(num / 1_000_000_000)}b`;
    if (abs >= 1_000_000) return `${trim(num / 1_000_000)}m`;
    if (abs >= 1_000) return `${trim(num / 1_000)}k`;
    return trim(num);
}

function calculateItemTotalPrice(item, isSell = false) {
    const unitPrice = Number(isSell ? item.sellPrice : item.price) || 0;
    const amount = Math.max(1, Number(item.amount) || 1);
    const perItem = isSell
        ? (item.sellPricePerItem !== false)
        : (item.buyPricePerItem !== false);
    return perItem ? (unitPrice * amount) : unitPrice;
}

function parseCampaignDate(raw, timezone) {
    const input = String(raw || '').trim();
    if (!input) return null;
    const normalized = input.includes('T') ? input : input.replace(' ', 'T');
    const hasZone = /Z$|[+-]\d{2}:\d{2}$/.test(normalized);
    if (hasZone) {
        const parsed = new Date(normalized);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    if (timezone && typeof timezone === 'string' && timezone.trim()) {
        try {
            const base = new Date(normalized);
            if (isNaN(base.getTime())) return null;
            return new Date(base.toLocaleString('en-US', { timeZone: timezone.trim() }));
        } catch (e) {
            const fallback = new Date(normalized);
            return isNaN(fallback.getTime()) ? null : fallback;
        }
    }
    const fallback = new Date(normalized);
    return isNaN(fallback.getTime()) ? null : fallback;
}

function isCampaignWindowActive(start, end, timezone) {
    const now = new Date();
    const startDate = parseCampaignDate(start, timezone);
    const endDate = parseCampaignDate(end, timezone);
    if (!startDate && !endDate) return false;
    if (startDate && now < startDate) return false;
    if (endDate && now > endDate) return false;
    return true;
}

function resolveItemCampaign(item) {
    if (!item) return null;
    if (item.campaignEnabled && isCampaignWindowActive(item.campaignStart, item.campaignEnd, item.campaignTimezone)) {
        return {
            key: item.campaign || '',
            name: item.campaignName || '',
            buyMultiplier: Math.max(0.01, Number(item.campaignBuyMultiplier) || 1),
            sellMultiplier: Math.max(0.01, Number(item.campaignSellMultiplier) || 1)
        };
    }

    const findCampaign = (key) => (globalCampaigns || []).find(c => c && c.key === key);
    const itemCampaign = item.campaign ? findCampaign(item.campaign) : null;
    if (itemCampaign && isCampaignWindowActive(itemCampaign.start, itemCampaign.end, itemCampaign.timezone)) {
        return {
            key: itemCampaign.key,
            name: itemCampaign.name || '',
            buyMultiplier: Math.max(0.01, Number(itemCampaign.buyMultiplier) || 1),
            sellMultiplier: Math.max(0.01, Number(itemCampaign.sellMultiplier) || 1)
        };
    }

    const shopCampaign = currentShopSettings.campaign ? findCampaign(currentShopSettings.campaign) : null;
    if (shopCampaign && isCampaignWindowActive(shopCampaign.start, shopCampaign.end, shopCampaign.timezone)) {
        return {
            key: shopCampaign.key,
            name: shopCampaign.name || '',
            buyMultiplier: Math.max(0.01, Number(shopCampaign.buyMultiplier) || 1),
            sellMultiplier: Math.max(0.01, Number(shopCampaign.sellMultiplier) || 1)
        };
    }

    return null;
}

function calculateCampaignAdjustedTotal(item, isSell = false) {
    const base = calculateItemTotalPrice(item, isSell);
    const campaign = resolveItemCampaign(item);
    if (!campaign) {
        return { base, total: base, active: false, campaign: null };
    }
    const multiplier = isSell ? campaign.sellMultiplier : campaign.buyMultiplier;
    return { base, total: base * multiplier, active: Math.abs(multiplier - 1) > 0.0000001, campaign };
}

function updatePreviewParityLabel() {
    const labels = document.querySelectorAll('.preview-parity-label');
    labels.forEach(label => {
        label.textContent = `PARITY: ${previewParityMode ? 'ON' : 'OFF'}`;
    });
}

function togglePreviewParityMode() {
    previewParityMode = !previewParityMode;
    localStorage.setItem('previewParityMode', previewParityMode ? 'true' : 'false');
    updatePreviewParityLabel();
    if (currentTab === 'shop') {
        updatePreview();
    }
}

function buildGlobalLimitValue(item) {
    const current = 0;
    const limit = Math.max(0, Number(item.globalLimit) || 0);
    const template = guiSettings.itemLore.globalLimitValueFormat || '%current%/%limit%';
    return template
        .replace('%current%', String(current))
        .replace('%limit%', String(limit));
}

function buildPlayerLimitValue(item) {
    const current = 0;
    const limit = Math.max(0, Number(item.limit) || 0);
    const template = guiSettings.itemLore.playerLimitValueFormat || '%current%/%limit%';
    return template
        .replace('%current%', String(current))
        .replace('%limit%', String(limit));
}

function buildStockResetPreviewValue() {
    const template = guiSettings.itemLore.stockResetTimerValueFormat || 'Stock resets in %time%';
    return template.replace('%time%', '--');
}

function buildShopPriceLoreLines(item) {
    const lines = [];
    if (guiSettings.itemLore.showBuyPrice && (Number(item.price) || 0) > 0) {
        const buyData = calculateCampaignAdjustedTotal(item, false);
        const buyText = buyData.active
            ? `&m$${formatDisplayPrice(buyData.base)}&r &a$${formatDisplayPrice(buyData.total)}`
            : `$${formatDisplayPrice(buyData.total)}`;
        lines.push((guiSettings.itemLore.buyPriceLine || '&6Buy Price: &a%price%')
            .replace('%price%', buyText));
    }
    if (guiSettings.itemLore.showSellPrice && (Number(item.sellPrice) || 0) > 0) {
        const sellData = calculateCampaignAdjustedTotal(item, true);
        const sellText = sellData.active
            ? `&m$${formatDisplayPrice(sellData.base)}&r &a$${formatDisplayPrice(sellData.total)}`
            : `$${formatDisplayPrice(sellData.total)}`;
        lines.push((guiSettings.itemLore.sellPriceLine || '&cSell Price: &a%sell-price%')
            .replace('%sell-price%', sellText));
    }
    return lines;
}

function buildShopHintLoreLines(item) {
    const lines = [];
    if (guiSettings.itemLore.showBuyHint && (Number(item.price) || 0) > 0) {
        lines.push(guiSettings.itemLore.buyHintLine || '&eLeft-click to buy');
    }
    if (guiSettings.itemLore.showSellHint && (Number(item.sellPrice) || 0) > 0) {
        lines.push(guiSettings.itemLore.sellHintLine || '&aRight-click to sell');
    }
    return lines;
}

function replaceShopLorePlaceholders(line, item) {
    const normalizeTimes = (value, fallback) => {
        if (Array.isArray(value)) {
            const cleaned = value.map(v => String(v || '').trim()).filter(Boolean);
            return cleaned.length > 0 ? cleaned.join(', ') : fallback;
        }
        const raw = String(value || '').trim();
        if (!raw) return fallback;
        return raw.split('\n').map(v => v.trim()).filter(Boolean).join(', ');
    };

    const shopTimes = normalizeTimes(currentShopSettings.availableTimes, 'All day');
    const itemTimes = normalizeTimes(item.availableTimes, shopTimes);
    const globalLimitStr = (Number(item.globalLimit) || 0) > 0 ? buildGlobalLimitValue(item) : '';
    const playerLimitStr = (Number(item.limit) || 0) > 0 ? buildPlayerLimitValue(item) : '';

    return String(line || '')
        .replace(/%available-times%/g, itemTimes)
        .replace(/%global-limit%/g, globalLimitStr)
        .replace(/%player-limit%/g, playerLimitStr)
        .replace(/%limit%/g, (Number(item.limit) || 0) > 0 ? String(item.limit) : '')
        .replace(/%stock-reset-timer%/g, '');
}

function buildShopTooltipLoreParity(item) {
    const lore = [];
    const format = Array.isArray(guiSettings.itemLore.loreFormat) && guiSettings.itemLore.loreFormat.length > 0
        ? guiSettings.itemLore.loreFormat
        : [
            '%price-line%',
            '',
            '%custom-lore%',
            '%spawner-type-line%',
            '%spawner-item-line%',
            '%potion-type-line%',
            '%global-limit%',
            '%player-limit%',
            '%stock-reset-timer%',
            '',
            '%hint-line%'
        ];

    format.forEach(line => {
        switch (line) {
            case '%price-line%':
                lore.push(...buildShopPriceLoreLines(item));
                break;
            case '%buy-price-line%':
                lore.push(...buildShopPriceLoreLines({ ...item, sellPrice: 0 }));
                break;
            case '%sell-price-line%':
                lore.push(...buildShopPriceLoreLines({ ...item, price: 0 }));
                break;
            case '%custom-lore%':
                (item.lore || []).forEach(customLine => lore.push(replaceShopLorePlaceholders(customLine, item)));
                break;
            case '%spawner-type-line%':
                if (item.spawnerType) {
                    lore.push((guiSettings.itemLore.spawnerTypeLine || '&7Spawner Type: &e%type%').replace('%type%', item.spawnerType));
                }
                break;
            case '%spawner-item-line%':
                if (item.spawnerItem) {
                    lore.push((guiSettings.itemLore.spawnerItemLine || '&7Spawner Item: &e%item%').replace('%item%', item.spawnerItem));
                }
                break;
            case '%potion-type-line%':
                if (item.potionType) {
                    lore.push((guiSettings.itemLore.potionTypeLine || '&7Potion Type: &d%type%').replace('%type%', item.potionType));
                }
                break;
            case '%stock-reset-timer-line%':
            case '%stock-reset-timer%':
                if (item.showStockResetTimer && item.stockResetRule && item.stockResetRule.enabled) {
                    const timerLine = (guiSettings.itemLore.stockResetTimerLine || '&7%stock-reset-timer%')
                        .replace('%stock-reset-timer%', buildStockResetPreviewValue());
                    lore.push(timerLine);
                }
                break;
            case '%global-limit%':
            case '%global-limit-line%':
                if (item.showStock && (Number(item.globalLimit) || 0) > 0) {
                    lore.push((guiSettings.itemLore.globalLimitLine || '&7Stock: &e%global-limit%')
                        .replace('%global-limit%', buildGlobalLimitValue(item)));
                }
                break;
            case '%player-limit%':
            case '%player-limit-line%':
                if ((Number(item.limit) || 0) > 0) {
                    lore.push((guiSettings.itemLore.playerLimitLine || '&7Your limit: &e%player-limit%')
                        .replace('%player-limit%', buildPlayerLimitValue(item)));
                }
                break;
            case '%hint-line%':
                lore.push(...buildShopHintLoreLines(item));
                break;
            case '%buy-hint-line%':
                if (guiSettings.itemLore.showBuyHint && (Number(item.price) || 0) > 0) {
                    lore.push(guiSettings.itemLore.buyHintLine || '&eLeft-click to buy');
                }
                break;
            case '%sell-hint-line%':
                if (guiSettings.itemLore.showSellHint && (Number(item.sellPrice) || 0) > 0) {
                    lore.push(guiSettings.itemLore.sellHintLine || '&aRight-click to sell');
                }
                break;
            default:
                lore.push(line || '');
                break;
        }
    });

    return lore;
}

function switchTab(tabName) {
    setEditorState('currentTab', tabName);
    updateQuickTips(tabName);

    // Toggle tab content visibility
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Toggle preview section visibility
    const previewSection = document.querySelector('.minecraft-preview-section');
    if (previewSection) {
        previewSection.style.display = (tabName === 'guisettings' || tabName === 'campaigns' || tabName === 'stockanalytics' || tabName === 'dataeditor') ? 'none' : 'block';
    }

    // Toggle preview settings bar content
    document.querySelectorAll('.preview-tab-settings').forEach(settings => {
        settings.classList.remove('active');
    });
    const activeSettings = document.getElementById(`${tabName}-settings-preview`);
    if (activeSettings) activeSettings.classList.add('active');
    
    const activeTab = document.getElementById(`${tabName}-tab`);
    if (activeTab) activeTab.classList.add('active');

    // Toggle tab button states
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-tab') === tabName) {
            tab.classList.add('active');
        }
    });

    // Sync preview settings bar
    updatePreviewSettingsBar();
    updatePreviewParityLabel();

    // Handle tab specific logic
    if (tabName === 'mainmenu') {
        updateGuiPreview();
    } else if (tabName === 'shop') {
        updatePreview();
    } else if (tabName === 'campaigns') {
        renderCampaignsTab();
    } else if (tabName === 'stockanalytics') {
        loadStockAnalyticsData(true);
    } else if (tabName === 'dataeditor') {
        loadDatabaseEditorData(true);
        renderDatabaseEditor();
    } else if (tabName === 'purchase') {
        updatePurchasePreview();
    } else if (tabName === 'sell') {
        updateSellPreview();
    } else if (tabName === 'guisettings') {
        renderGuiSettings();
    }
}

function updatePreviewSettingsBar() {
    if (currentTab === 'mainmenu') {
        const rows = mainMenuSettings.rows || 6;
        const input = document.getElementById('mainmenu-rows-input');
        const display = document.getElementById('mainmenu-rows-display');
        if (input) input.value = rows;
        if (display) display.textContent = rows;
    } else if (currentTab === 'shop') {
        const rows = currentShopSettings.rows || 6;
        const input = document.getElementById('shop-rows-input');
        const display = document.getElementById('shop-rows-display');
        if (input) input.value = rows;
        if (display) display.textContent = rows;
        
        const permInput = document.getElementById('shop-permission-input');
        const permDisplay = document.getElementById('shop-permission-display');
        if (permInput) permInput.value = currentShopSettings.permission || '';
        if (permDisplay) permDisplay.textContent = currentShopSettings.permission || 'None';

        const timesInput = document.getElementById('shop-times-input');
        const timesDisplay = document.getElementById('shop-times-display');
        if (timesInput) {
            const times = currentShopSettings.availableTimes || '';
            timesInput.value = times;
            if (timesDisplay) timesDisplay.textContent = times.split('\n').join(', ') || 'All day';
        }
    } else if (currentTab === 'purchase') {
        const p = transactionSettings.purchase;
        const rInput = document.getElementById('purchase-rows-input');
        const rDisplay = document.getElementById('purchase-rows-display');
        if (rInput) rInput.value = p.rows || 6;
        if (rDisplay) rDisplay.textContent = p.rows || 6;

        const maxInput = document.getElementById('purchase-max-input');
        const maxDisplay = document.getElementById('purchase-max-display');
        const maxVal = p.maxAmount !== undefined ? p.maxAmount : 2304;
        if (maxInput) maxInput.value = maxVal;
        if (maxDisplay) maxDisplay.textContent = maxVal;
    } else if (currentTab === 'sell') {
        const s = transactionSettings.sell;
        const rInput = document.getElementById('sell-rows-input');
        const rDisplay = document.getElementById('sell-rows-display');
        if (rInput) rInput.value = s.rows || 6;
        if (rDisplay) rDisplay.textContent = s.rows || 6;

        const maxInput = document.getElementById('sell-max-input');
        const maxDisplay = document.getElementById('sell-max-display');
        const maxVal = s.maxAmount !== undefined ? s.maxAmount : 2304;
        if (maxInput) maxInput.value = maxVal;
        if (maxDisplay) maxDisplay.textContent = maxVal;
    }
}

function handleRowsChange(value) {
    let rows = parseInt(value);
    if (isNaN(rows)) rows = 6;
    if (rows < 1) rows = 1;
    if (rows > 6) rows = 6;

    let before;
    if (currentTab === 'shop') {
        before = currentShopSettings.rows;
        currentShopSettings.rows = rows;
        updatePreview();
    } else if (currentTab === 'mainmenu') {
        before = mainMenuSettings.rows;
        mainMenuSettings.rows = rows;
        updateGuiPreview();
    } else if (currentTab === 'purchase') {
        before = transactionSettings.purchase.rows || 6;
        transactionSettings.purchase.rows = rows;
        updatePurchasePreview();
    } else if (currentTab === 'sell') {
        before = transactionSettings.sell.rows || 6;
        transactionSettings.sell.rows = rows;
        updateSellPreview();
    }
    
    if (before !== rows) {
        addActivityEntry('updated', `${currentTab}-rows`, before, rows);
    }
    
    // Update display instantly
    updatePreviewSettingsBar();
    scheduleAutoSave();
}

function handleShopPermissionChange(value) {
    const before = currentShopSettings.permission;
    currentShopSettings.permission = value;
    if (before !== value) {
        addActivityEntry('updated', 'shop-permission', before, value);
        
        // Refresh custom shop selector to update lock icon
        const shopSelector = document.getElementById('shop-file-selector');
        if (shopSelector) {
            shopSelector.dispatchEvent(new Event('change'));
        }
    }
    updatePreviewSettingsBar();
    scheduleAutoSave();
}

function handleShopTimesChange(value) {
    const before = currentShopSettings.availableTimes;
    const newValue = value.trim();
    currentShopSettings.availableTimes = newValue;
    if (before !== newValue) {
        addActivityEntry('updated', 'shop-times', before, newValue);
    }
    updatePreviewSettingsBar();
    scheduleAutoSave();
}

function handlePurchaseSettingsChange() {
    const p = transactionSettings.purchase;
    const maxInput = document.getElementById('purchase-max-input');

    if (maxInput) {
        p.maxAmount = parseInt(maxInput.value);
        if (isNaN(p.maxAmount)) p.maxAmount = 2304;
    }
    
    updatePurchasePreview();
    scheduleAutoSave();
}

function handleSellSettingsChange() {
    const s = transactionSettings.sell;
    const maxInput = document.getElementById('sell-max-input');

    if (maxInput) {
        s.maxAmount = parseInt(maxInput.value);
        if (isNaN(s.maxAmount)) s.maxAmount = 2304;
    }
    
    updateSellPreview();
    scheduleAutoSave();
}

function updateCurrentTitle(value) {
    let beforeValue = null;
    let changed = false;

    if (currentTab === 'shop') {
        beforeValue = currentShopSettings.guiName;
        currentShopSettings.guiName = value;
        changed = beforeValue !== value;
        if (changed) {
            addActivityEntry(
                'updated',
                'shop-settings',
                { guiName: beforeValue },
                { guiName: value },
                { field: 'guiName', shopFile: currentShopFile }
            );
        }
    } else if (currentTab === 'mainmenu') {
        beforeValue = mainMenuSettings.title;
        mainMenuSettings.title = value;
        changed = beforeValue !== value;
        if (changed) {
            addActivityEntry(
                'updated',
                'main-menu-settings',
                { title: beforeValue },
                { title: value },
                { field: 'title' }
            );
        }
    } else if (currentTab === 'purchase') {
        beforeValue = transactionSettings.purchase.titlePrefix;
        transactionSettings.purchase.titlePrefix = value;
        changed = beforeValue !== value;
        if (changed) {
            addActivityEntry(
                'updated',
                'purchase-menu-settings',
                { titlePrefix: beforeValue },
                { titlePrefix: value },
                { field: 'titlePrefix' }
            );
        }
    } else if (currentTab === 'sell') {
        beforeValue = transactionSettings.sell.titlePrefix;
        transactionSettings.sell.titlePrefix = value;
        changed = beforeValue !== value;
        if (changed) {
            addActivityEntry(
                'updated',
                'sell-menu-settings',
                { titlePrefix: beforeValue },
                { titlePrefix: value },
                { field: 'titlePrefix' }
            );
        }
    }
    
    // Update display instantly
    const titleElement = document.getElementById('preview-title');
    if (titleElement) {
        let displayValue = value;
        if (currentTab === 'purchase' || currentTab === 'sell') {
            displayValue += 'Item';
        }
        titleElement.innerHTML = parseMinecraftColors(displayValue);
    }
    scheduleAutoSave();
}

function updateAll() {
    updatePreview();
    renderCampaignsTab();
    updateExport();
    updatePreviewSettingsBar();
    scheduleAutoSave();
}

function renderStockAnalyticsDashboard() {
    const generatedEl = document.getElementById('stock-analytics-generated');
    const summaryEl = document.getElementById('stock-analytics-summary');
    const tableEl = document.getElementById('stock-analytics-table');
    const shopFilterEl = document.getElementById('stock-analytics-shop-filter');
    if (!summaryEl || !tableEl) return;

    const payload = stockAnalyticsData || {};
    const totals = payload.totals || {};
    const entries = Array.isArray(payload.entries) ? payload.entries : [];

    if (generatedEl) {
        if (payload.generatedAt) {
            generatedEl.textContent = `Updated ${new Date(payload.generatedAt).toLocaleString()}`;
        } else {
            generatedEl.textContent = 'No data yet';
        }
    }

    if (shopFilterEl) {
        const current = String(shopFilterEl.value || '');
        const known = Array.from(new Set(entries.map(e => String(e.shopKey || '')).filter(Boolean))).sort((a, b) => a.localeCompare(b));
        shopFilterEl.innerHTML = '<option value="">All shops</option>' + known.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
        shopFilterEl.value = known.includes(current) ? current : '';
        shopFilterEl.dispatchEvent(new Event('refresh'));
    }

    const activeShop = shopFilterEl ? String(shopFilterEl.value || '') : '';
    const filtered = activeShop ? entries.filter(e => String(e.shopKey || '') === activeShop) : entries;
    const outCount = filtered.filter(e => (Number(e.remaining) || 0) <= 0).length;
    const lowCount = filtered.filter(e => {
        const limit = Math.max(0, Number(e.globalLimit) || 0);
        const remaining = Math.max(0, Number(e.remaining) || 0);
        return limit > 0 && remaining > 0 && remaining <= Math.max(1, Math.round(limit * 0.2));
    }).length;

    summaryEl.innerHTML = `
        <div class="stock-card"><div class="stock-card-label">Tracked Items</div><div class="stock-card-value">${filtered.length}</div></div>
        <div class="stock-card"><div class="stock-card-label">Out Of Stock</div><div class="stock-card-value">${outCount}</div></div>
        <div class="stock-card"><div class="stock-card-label">Low Stock</div><div class="stock-card-value">${lowCount}</div></div>
        <div class="stock-card"><div class="stock-card-label">Global Fill</div><div class="stock-card-value">${formatDisplayPrice(Number(totals.fillPct) || 0)}%</div></div>
    `;

    if (filtered.length === 0) {
        tableEl.innerHTML = `<div class="stock-table-row"><div class="stock-cell-main">No stock-limited items found for this filter.</div></div>`;
        initCustomSelects();
        return;
    }

    const rows = filtered.slice(0, 250).map(entry => {
        const utilization = Number(entry.utilizationPct) || 0;
        const statusClass = (Number(entry.remaining) || 0) <= 0 ? 'danger' : utilization >= 80 ? 'warn' : 'ok';
        const statusText = (Number(entry.remaining) || 0) <= 0 ? 'OUT' : utilization >= 80 ? 'LOW' : 'OK';
        const rawName = String(entry.name || '').trim();
        const name = rawName ? parseMinecraftColors(rawName) : escapeHtml(entry.material || 'UNKNOWN');
        return `
            <div class="stock-table-row">
                <div class="stock-cell-main">
                    <div class="stock-item-name">${name}</div>
                    <div class="stock-item-sub">${escapeHtml(entry.shopKey || '')} | ${escapeHtml(entry.itemKey || '')}</div>
                </div>
                <div class="stock-col-material">${escapeHtml(entry.material || '')}</div>
                <div class="stock-col-slot">#${Number(entry.slot) || 0}</div>
                <div>${Number(entry.current) || 0}</div>
                <div>${Number(entry.globalLimit) || 0}</div>
                <div>${Number(entry.remaining) || 0}</div>
                <div><span class="stock-pill ${statusClass}">${statusText} ${formatDisplayPrice(utilization)}%</span></div>
            </div>
        `;
    }).join('');

    tableEl.innerHTML = `
        <div class="stock-table-header">
            <div>Item</div>
            <div class="stock-col-material">Material</div>
            <div class="stock-col-slot">Slot</div>
            <div>Current</div>
            <div>Limit</div>
            <div>Remaining</div>
            <div>Status</div>
        </div>
        ${rows}
    `;
    initCustomSelects();
}

function renderSkeletons() {
    const itemsContainer = document.getElementById('items-container');
    const mainMenuContainer = document.getElementById('mainmenu-shops-container');
    const purchaseList = document.getElementById('purchase-buttons-list');
    const sellList = document.getElementById('sell-buttons-list');
    const guiSettings = document.getElementById('gui-settings-container');

    const itemSkeleton = `
        <div class="card-base" style="padding: 15px; height: 120px; border: 1px solid var(--border); opacity: 0.6;">
            <div class="skeleton" style="height: 20px; width: 60%; margin-bottom: 12px;"></div>
            <div class="skeleton" style="height: 15px; width: 40%; margin-bottom: 20px;"></div>
            <div class="skeleton" style="height: 12px; width: 100%; margin-bottom: 8px;"></div>
            <div class="skeleton" style="height: 12px; width: 80%;"></div>
        </div>
    `;

    if (itemsContainer) {
        itemsContainer.innerHTML = Array(12).fill(itemSkeleton).join('');
    }
    if (mainMenuContainer) {
        mainMenuContainer.innerHTML = Array(8).fill(itemSkeleton).join('');
    }
    if (purchaseList) {
        purchaseList.innerHTML = Array(2).fill(`
            <div class="card-base" style="padding: 20px; margin-bottom: 24px; opacity: 0.6;">
                <div class="flex justify-between items-center mb-20">
                    <div class="skeleton" style="height: 24px; width: 200px;"></div>
                    <div class="skeleton" style="height: 36px; width: 120px; border-radius: 10px;"></div>
                </div>
                <div class="grid-list" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));">
                    ${Array(4).fill(itemSkeleton).join('')}
                </div>
            </div>
        `).join('');
    }
    if (sellList) {
        sellList.innerHTML = Array(2).fill(`
            <div class="card-base" style="padding: 20px; margin-bottom: 24px; opacity: 0.6;">
                <div class="flex justify-between items-center mb-20">
                    <div class="skeleton" style="height: 24px; width: 200px;"></div>
                    <div class="skeleton" style="height: 36px; width: 120px; border-radius: 10px;"></div>
                </div>
                <div class="grid-list" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));">
                    ${Array(4).fill(itemSkeleton).join('')}
                </div>
            </div>
        `).join('');
    }
    if (guiSettings) {
        guiSettings.innerHTML = Array(4).fill(`
            <div class="card-base" style="padding: 20px; height: 160px; opacity: 0.6;">
                <div class="skeleton" style="height: 20px; width: 40%; margin-bottom: 15px;"></div>
                <div class="skeleton" style="height: 45px; width: 100%; margin-bottom: 15px;"></div>
                <div class="skeleton" style="height: 15px; width: 90%;"></div>
            </div>
        `).join('');
    }
}

function toggleQuickTips() {
    const list = document.getElementById('quick-tips-list');
    const icon = document.getElementById('tips-toggle-icon');
    if (list && icon) {
        const isHidden = list.style.display === 'none';
        list.style.display = isHidden ? 'block' : 'none';
        icon.textContent = isHidden ? '\u25B2' : '\u25BC';
    }
}

const QUICK_TIPS_BY_TAB = {
    mainmenu: [
        'Use slot numbers to keep category layout consistent.',
        'Buttons can open shops, run commands, or do nothing.',
        'Keep button names short so they stay readable in GUI.',
        'Use parity mode to preview lore placeholders.',
        'Save after large button rearrangements.'
    ],
    shop: [
        'Click an item card or preview slot to edit details.',
        'Sort and search before bulk edits to avoid mistakes.',
        'Set slot explicitly when you need stable layout order.',
        'Use campaign and stock flags only where needed.',
        'Use import/export for faster cross-shop updates.'
    ],
    campaigns: [
        'Create campaign keys once, then assign them in bulk.',
        'Set timezone explicitly for predictable start/end windows.',
        'Use shop-level campaign for broad promos.',
        'Use item-level campaign to override specific products.',
        'Save campaigns, then save affected shop files.'
    ],
    stockanalytics: [
        'Use the shop filter to isolate stock bottlenecks.',
        'Track out-of-stock and low-stock counts first.',
        'High utilization means your global limit is near full.',
        'Rows are sorted by highest utilization to surface risk.',
        'Refresh after major buy/sell testing.'
    ],
    dataeditor: [
        'Player Counts are per-player item limit counters.',
        'Global Counts are shared stock counters per item key.',
        'Stock Resets track last reset run times in epoch millis.',
        'Edit carefully: these values affect live shop behavior.',
        'Refresh after each change to verify persisted data.'
    ],
    purchase: [
        'Keep confirm/cancel/back buttons on predictable slots.',
        'Set max amount based on your economy balance.',
        'Check display slot so preview item is always visible.',
        'Match button labels with their configured amounts.',
        'Use parity mode to validate lore output.'
    ],
    sell: [
        'Place Sell All where users can find it quickly.',
        'Keep remove/add/set amounts balanced for UX.',
        'Lower max amount if economy abuse is a concern.',
        'Verify sell lore lines match your placeholders.',
        'Use parity mode before publishing menu changes.'
    ],
    guisettings: [
        'Edit global lore formats carefully; all shops use them.',
        'Test buy/sell hint visibility with real item states.',
        'Use safety presets as a baseline, then fine-tune.',
        'Set separators/decimals to match your server locale.',
        'Save and retest one shop after major global changes.'
    ]
};

function updateQuickTips(tabName = currentTab) {
    const list = document.getElementById('quick-tips-list');
    if (!list) return;

    const tips = QUICK_TIPS_BY_TAB[tabName] || QUICK_TIPS_BY_TAB.shop;
    list.innerHTML = tips.map(tip => `<li>${escapeHtml(tip)}</li>`).join('');
}

function switchShop(filename) {
    if (filename === currentShopFile) return;
    loadShopFromData(filename);
}

function toggleNavDropdown(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('nav-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

// Global click listener to close dropdowns when clicking outside
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('nav-dropdown');
    const userInfo = document.getElementById('user-info');
    if (dropdown && dropdown.classList.contains('active')) {
        if (!dropdown.contains(event.target) && userInfo && !userInfo.contains(event.target)) {
            dropdown.classList.remove('active');
        }
    }
});

function scrollToItem(itemId) {
    const el = Array.from(document.querySelectorAll('.shop-item')).find(item => 
        item.onclick && item.onclick.toString().includes(itemId)
    );
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.boxShadow = '0 0 20px rgba(85, 255, 85, 0.4)';
        setTimeout(() => el.style.boxShadow = '', 2000);
    }
}

function getItemTexture(material) {
    if (!material) return `${TEXTURE_API}stone.png`;
    return `${TEXTURE_API}${material.toLowerCase()}.png`;
}

function changePage(direction) {
    const rows = currentShopSettings.rows || 3;
    const itemsPerPage = rows * 9;
    let maxSlot = items.length > 0 ? Math.max(...items.map(it => it.slot || 0)) : 0;
    const maxPage = Math.ceil((maxSlot + 1) / itemsPerPage) - 1;
    
    currentPreviewPage += direction;
    if (currentPreviewPage < 0) currentPreviewPage = 0;
    
    // Allow going beyond the current maximum if dragging an item to create new pages
    const allowedMax = draggedSlotIndex !== null ? Math.max(maxPage + 1, currentPreviewPage) : maxPage;
    if (currentPreviewPage > allowedMax) currentPreviewPage = allowedMax;
    
    updatePreview();
    
    // Update page indicator
    const pageIndicator = document.getElementById('page-indicator');
    if (pageIndicator) {
        pageIndicator.textContent = t('web-editor.page-indicator', {
            page: currentPreviewPage + 1,
            total: (allowedMax + 1)
        });
    }
}

function renderButtonGroup(container, type, group, title, namePrefix) {
    if (!container) return;
    const groupData = transactionSettings[type][group];
    
    let html = `
        <div class="settings-group card-base" style="margin-bottom: 2rem;">
            <div class="flex justify-between items-center mb-24">
                <div class="flex items-center gap-16 flex-1">
                    <div class="flex items-center gap-12">
                        <h3 class="m-0" style="font-size: 1.1rem; color: #fff;">${title}</h3>
                        <div class="count-badge">
                            ${t('web-editor.main-menu.buttons-count', {count: Object.keys(groupData.buttons).length})}
                        </div>
                    </div>
                    <div class="stealth-edit-container" title="Click to edit Material" style="max-width: 275px; margin-left: 20px;">
                        <input type="text" class="stealth-input" 
                               value="${groupData.material}" 
                               onchange="updateGroupMaterial('${type}', '${group}', this.value)"
                               oninput="const val = this.value.toUpperCase(); const icon = this.nextElementSibling.querySelector('img'); icon.src = getItemTexture(val); icon.parentElement.title = this.value;"
                               placeholder="Material...">
                        <div class="stealth-display-wrapper">
                            <span class="stealth-label" data-i18n="web-editor.display-material">${t('web-editor.display-material', 'Material:')}</span>
                            <div class="item-icon" style="width: 24px; height: 24px; margin: 0 4px;" title="${groupData.material}">
                                <img src="${getItemTexture(groupData.material)}" onerror="this.src='${TEXTURE_API}stone.png'">
                            </div>
                            <span class="edit-icon-small">\u270E</span>
                        </div>
                    </div>
                </div>
                <button class="btn btn-primary" onclick="addCustomButton('${type}', '${group}')" style="padding: 6px 16px; height: 36px; font-size: 0.85em; border-radius: 10px;">
                    <span>${t('web-editor.main-menu.add-new', 'ADD NEW')}</span>
                </button>
            </div>
            <div class="grid-list" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));">
    `;

    Object.entries(groupData.buttons).sort((a,b) => parseInt(a[0]) - parseInt(b[0])).forEach(([amount, btn]) => {
        let loreHtml = '';
        if (btn.lore && btn.lore.length > 0) {
            loreHtml = `<div class="item-lore-preview" style="margin-top: 8px; font-size: 0.75rem; opacity: 0.8; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px;">
                ${btn.lore.slice(0, 3).map(l => `<div>${parseMinecraftColors(l)}</div>`).join('')}
                ${btn.lore.length > 3 ? '<div>...</div>' : ''}
            </div>`;
        }

        html += `
            <div class="shop-item" onclick="openTransactionButtonModal('${type}', '${group}', '${amount}')">
                <div class="flex justify-between items-center mb-8">
                    <div class="item-title">${namePrefix} ${amount}</div>
                    <div class="item-subtitle" style="background: rgba(0,0,0,0.3); padding: 2px 8px; border-radius: 6px;">#${btn.slot}</div>
                </div>
                <div class="item-subtitle" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600;">
                    ${parseMinecraftColors(btn.name) || 'Default Name'}
                </div>
                ${loreHtml}
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

function renderTransactionPreview(type) {
    const grid = document.getElementById('preview-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const settings = transactionSettings[type];
    document.getElementById('preview-title').innerHTML = parseMinecraftColors(settings.titlePrefix + 'Item');

    for (let i = 0; i < 54; i++) {
        const slot = document.createElement('div');
        slot.className = 'preview-slot';
        
        // Buttons and items logic already in updatePurchasePreview/updateSellPreview
        // This is a more generic version if needed
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showAlert(t('web-editor.modals.copied', 'Copied to clipboard!'), 'success');
        });
    } else {
        // Fallback for non-secure contexts
        try {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            textArea.style.top = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            if (successful) {
                showAlert(t('web-editor.modals.copied', 'Copied to clipboard!'), 'success');
            }
        } catch (err) {
            // Silently fail if even fallback doesn't work
        }
    }
}

function downloadFile(content, filename) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/yaml;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

function handleItemSearch() {
    const input = document.getElementById('item-search');
    if (input) {
        itemSearchQuery = input.value.toLowerCase().trim();
        renderItems();
    }
}

function handleItemSort() {
    const select = document.getElementById('item-sort');
    if (select) {
        currentSort = select.value;
        renderItems();
    }
}

function renderItems() {
    const container = document.getElementById('items-container');
    if (!container) {
        // Update item count badge
        if (document.getElementById('shop-items-count')) {
            document.getElementById('shop-items-count').textContent = `${items.length} items`;
        }
        return;
    }
    container.innerHTML = '';

    let sortedItems = [...items];

    // Apply sorting
    const [field, order] = currentSort.split('-');
    const isAsc = order === 'asc' || !order;

    sortedItems.sort((a, b) => {
        let valA, valB;
        
        if (field === 'slot') {
            valA = a.slot || 0;
            valB = b.slot || 0;
        } else if (field === 'name') {
            valA = (a.name || '').toLowerCase();
            valB = (b.name || '').toLowerCase();
        } else if (field === 'material') {
            valA = (a.material || '').toLowerCase();
            valB = (b.material || '').toLowerCase();
        } else if (field === 'price') {
            valA = a.price || 0;
            valB = b.price || 0;
        } else if (field === 'sellPrice') {
            valA = a.sellPrice || 0;
            valB = b.sellPrice || 0;
        } else if (field === 'id') {
            valA = a.id || 0;
            valB = b.id || 0;
        } else {
            return 0;
        }

        if (valA < valB) return isAsc ? -1 : 1;
        if (valA > valB) return isAsc ? 1 : -1;
        return 0;
    });

    const filteredItems = sortedItems.filter(item => {
        if (!itemSearchQuery) return true;
        const name = (item.name || '').toLowerCase();
        const material = (item.material || '').toLowerCase();
        return name.includes(itemSearchQuery) || material.includes(itemSearchQuery);
    });

    filteredItems.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'shop-item';
        
        let tagsHtml = '<div class="item-tags">';
        if (item.enchantments && Object.keys(item.enchantments).length > 0) {
            tagsHtml += `<span class="item-tag active">Enchanted (${Object.keys(item.enchantments).length})</span>`;
        }
        if (item.lore && item.lore.length > 0) {
            tagsHtml += `<span class="item-tag active">Lore (${item.lore.length})</span>`;
        }
        if (item.spawnerType) {
            tagsHtml += `<span class="item-tag spawner">Spawner: ${escapeHtml(item.spawnerType)}</span>`;
        }
        if (item.spawnerItem) {
            tagsHtml += `<span class="item-tag spawner">Item Spawner: ${escapeHtml(item.spawnerItem)}</span>`;
        }
        if (serverInfo.smartSpawnerEnabled && (item.spawnerType || item.spawnerItem)) {
            tagsHtml += `<span class="item-tag active" style="background: rgba(0, 230, 118, 0.15); color: #00e676; border-color: rgba(0, 230, 118, 0.3);">SmartSpawner</span>`;
        }
        if (item.potionType) tagsHtml += `<span class="item-tag potion">Potion: ${escapeHtml(item.potionType)}</span>`;
        if (item.dynamicPricing) tagsHtml += `<span class="item-tag dynamic">Dynamic</span>`;
        if (item.campaignEnabled) {
            const campaignName = String(item.campaignName || '').trim();
            tagsHtml += `<span class="item-tag active">Campaign${campaignName ? `: ${escapeHtml(campaignName)}` : ''}</span>`;
        }
        if (item.campaign) {
            tagsHtml += `<span class="item-tag active">Campaign Key: ${escapeHtml(item.campaign)}</span>`;
        }
        if (item.limit > 0) tagsHtml += `<span class="item-tag active">Player Limit: ${item.limit}</span>`;
        if (item.globalLimit > 0) tagsHtml += `<span class="item-tag active" style="background: rgba(255, 160, 0, 0.15); color: #ffa000; border-color: rgba(255, 160, 0, 0.3);">Global Limit: ${item.globalLimit}</span>`;
        if (item.permission) tagsHtml += `<span class="item-tag active" title="${escapeHtml(item.permission)}">Permission</span>`;
        if (item.itemKey) tagsHtml += `<span class="item-tag active">Item Key: ${escapeHtml(item.itemKey)}</span>`;
        if (item.variantKey) tagsHtml += `<span class="item-tag active">Variant: ${escapeHtml(item.variantKey)}</span>`;
        if (item.unstableTnt) tagsHtml += `<span class="item-tag active">Unstable TNT</span>`;
        if (item.requireName) tagsHtml += `<span class="item-tag active">Req Name</span>`;
        if (item.requireLore) tagsHtml += `<span class="item-tag active">Req Lore</span>`;
        if (item.hideAttributes) tagsHtml += `<span class="item-tag">Hide Attr</span>`;
        if (item.hideAdditional) tagsHtml += `<span class="item-tag">Hide Addon</span>`;
        if (item.commands && item.commands.length > 0) {
            tagsHtml += `<span class="item-tag command">Commands (${item.commands.length})</span>`;
            if (item.runCommandOnly) {
                tagsHtml += `<span class="item-tag command">Run Cmd Only</span>`;
            } else {
                tagsHtml += `<span class="item-tag command">Cmds + Item</span>`;
            }
        }
        tagsHtml += '</div>';

        let loreHtml = '';
        if (item.lore && item.lore.length > 0) {
            loreHtml = '<div class="item-lore-preview">';
            item.lore.slice(0, 3).forEach(line => {
                loreHtml += `<div class="lore-line">${parseMinecraftColors(line) || '&nbsp;'}</div>`;
            });
            if (item.lore.length > 3) loreHtml += '<div class="lore-line text-muted">...</div>';
            loreHtml += '</div>';
        }

        const rows = (currentShopSettings && currentShopSettings.rows) ? currentShopSettings.rows : 3;
        const itemsPerPage = rows * 9;
        const page = Math.floor(item.slot / itemsPerPage) + 1;
        const slotOnPage = item.slot % itemsPerPage;
        const buyDisplay = calculateCampaignAdjustedTotal(item, false);
        const sellDisplay = calculateCampaignAdjustedTotal(item, true);
        const buyPriceHtml = item.price > 0
            ? (buyDisplay.active
                ? `<div class="item-price-tag" style="color: var(--success);"><span style="opacity:0.65;text-decoration:line-through;margin-right:6px;">$${formatDisplayPrice(buyDisplay.base)}</span>$${formatDisplayPrice(buyDisplay.total)}</div>`
                : `<div class="item-price-tag" style="color: var(--success);">$${formatDisplayPrice(buyDisplay.total)}</div>`)
            : '';
        const sellPriceHtml = item.sellPrice > 0
            ? (sellDisplay.active
                ? `<div class="item-price-tag" style="color: var(--danger);"><span style="opacity:0.65;text-decoration:line-through;margin-right:6px;">$${formatDisplayPrice(sellDisplay.base)}</span>$${formatDisplayPrice(sellDisplay.total)}</div>`
                : `<div class="item-price-tag" style="color: var(--danger);">$${formatDisplayPrice(sellDisplay.total)}</div>`)
            : '';

        itemEl.innerHTML = `
            <div class="item-header">
                <div class="item-icon">
                    <img src="${getShopItemIconUrl(item)}" onerror="this.src='${TEXTURE_API}stone.png'">
                </div>
                <div class="flex-1">
                    <div class="item-title">${parseMinecraftColors(item.name)}</div>
                    <div class="item-subtitle">
                        ${escapeHtml(item.material)} - ${item.amount}
                        <span style="margin-left: 8px; opacity: 0.6; font-size: 0.9em;">(${t('web-editor.item.item-location', {page: page, slot: slotOnPage})})</span>
                    </div>
                    ${tagsHtml}
                </div>
                <div class="flex flex-col gap-8 items-end">
                    ${buyPriceHtml}
                    ${sellPriceHtml}
                </div>
            </div>
            ${loreHtml}
        `;
        itemEl.onclick = () => openShopItemModal(item.id);
        container.appendChild(itemEl);
    });

    if (filteredItems.length === 0 && itemSearchQuery) {
        container.innerHTML = `
            <div class="text-center" style="padding: 4rem 0;">
                <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.2;">\uD83D\uDD0D</div>
                <div class="text-muted">No items match your search</div>
            </div>
        `;
    }

    if (document.getElementById('shop-items-count')) {
        document.getElementById('shop-items-count').textContent = `${items.length} items`;
    }

    initCustomSelects();
}

function updateShopCampaignAssignment(value) {
    applyCampaignToShopFile(currentShopFile, value, true);
}

function getTopLevelCampaignFromShopYaml(yaml) {
    if (!yaml || typeof yaml !== 'string') return '';
    const lines = yaml.split('\n');
    for (const raw of lines) {
        const line = String(raw || '');
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const indent = line.search(/\S/);
        if (indent !== 0) continue;
        const match = trimmed.match(/^campaign:\s*(.*)$/i);
        if (!match) continue;
        return String(match[1] || '').replace(/['"]/g, '').trim();
    }
    return '';
}

function setTopLevelCampaignInShopYaml(yaml, campaignKey) {
    const source = String(yaml || '');
    const nextKey = String(campaignKey || '').trim();
    const hasTrailingNewline = source.endsWith('\n');
    const lines = source.split('\n');
    const campaignLineIndex = lines.findIndex(line => {
        const trimmed = String(line || '').trim();
        if (!trimmed || trimmed.startsWith('#')) return false;
        const indent = String(line || '').search(/\S/);
        return indent === 0 && /^campaign:\s*/i.test(trimmed);
    });

    if (!nextKey) {
        if (campaignLineIndex >= 0) lines.splice(campaignLineIndex, 1);
    } else {
        const escaped = nextKey.replace(/'/g, "''");
        const replacement = `campaign: '${escaped}'`;
        if (campaignLineIndex >= 0) {
            lines[campaignLineIndex] = replacement;
        } else {
            const itemsIndex = lines.findIndex(line => /^items:\s*/i.test(String(line || '').trim()) && String(line || '').search(/\S/) === 0);
            if (itemsIndex >= 0) lines.splice(itemsIndex, 0, replacement);
            else lines.push(replacement);
        }
    }

    let out = lines.join('\n');
    if (hasTrailingNewline && !out.endsWith('\n')) out += '\n';
    return out;
}

function getShopCampaignAssignment(shopFile) {
    if (shopFile === currentShopFile) return String(currentShopSettings.campaign || '').trim();
    return getTopLevelCampaignFromShopYaml(allShops[shopFile] || '');
}

function applyCampaignToShopFile(shopFile, campaignKey, refresh = false) {
    const file = String(shopFile || '').trim();
    if (!file) return false;

    const next = String(campaignKey || '').trim();
    const before = getShopCampaignAssignment(file);
    if (before === next) return false;

    if (file === currentShopFile) {
        currentShopSettings.campaign = next;
    } else {
        const sourceYaml = allShops[file];
        if (typeof sourceYaml !== 'string') return false;
        allShops[file] = setTopLevelCampaignInShopYaml(sourceYaml, next);
        campaignHubDirtyShopFiles.add(file);
    }

    addActivityEntry(
        'updated',
        'shop-settings',
        { campaign: before },
        { campaign: next },
        { field: 'campaign', shopFile: file, campaignHub: true }
    );

    if (refresh) {
        renderCampaignsTab();
        updateAll();
    }
    return true;
}

function updateCampaignHubSelected(value) {
    campaignHubSelectedKey = String(value || '').trim();
    renderCampaignsTab();
}

function getCampaignHubItemShopFile() {
    const available = Object.keys(allShops || {});
    if (campaignHubItemShopFile && allShops[campaignHubItemShopFile]) {
        return campaignHubItemShopFile;
    }
    if (currentShopFile && allShops[currentShopFile]) {
        campaignHubItemShopFile = currentShopFile;
        return campaignHubItemShopFile;
    }
    campaignHubItemShopFile = available.length > 0 ? available[0] : '';
    return campaignHubItemShopFile;
}

function updateCampaignHubItemShop(value) {
    campaignHubItemShopFile = String(value || '').trim();
    renderCampaignsTab();
}

function withParsedShopContext(shopFile, handler) {
    const targetFile = String(shopFile || '').trim();
    if (!targetFile || !allShops[targetFile]) {
        return handler ? handler([], {}) : null;
    }
    if (targetFile === currentShopFile) {
        return handler ? handler(items, currentShopSettings) : null;
    }

    const originalShopFile = currentShopFile;
    const originalItems = JSON.parse(JSON.stringify(items || []));
    const originalSettings = JSON.parse(JSON.stringify(currentShopSettings || {}));
    const originalItemIdCounter = itemIdCounter;
    const exportOutput = document.getElementById('export-output');
    const originalExport = exportOutput ? exportOutput.textContent : '';

    try {
        currentShopFile = targetFile;
        parseShopYaml(allShops[targetFile]);
        return handler ? handler(items, currentShopSettings) : null;
    } finally {
        currentShopFile = originalShopFile;
        items = originalItems;
        currentShopSettings = originalSettings;
        itemIdCounter = originalItemIdCounter;
        if (exportOutput) exportOutput.textContent = originalExport;
    }
}

function getParsedShopYamlFromCurrentContext() {
    if (typeof getCurrentShopYamlContent === 'function') {
        return getCurrentShopYamlContent();
    }
    if (typeof updateExport === 'function') {
        updateExport();
    } else if (typeof generateShopYaml === 'function') {
        generateShopYaml();
    }
    const exportOutput = document.getElementById('export-output');
    return exportOutput ? exportOutput.textContent : '';
}

function getCampaignHubItemsForShop(shopFile) {
    const target = String(shopFile || '').trim();
    if (!target) return [];
    if (target === currentShopFile) return JSON.parse(JSON.stringify(items || []));
    return withParsedShopContext(target, (parsedItems) => JSON.parse(JSON.stringify(parsedItems || []))) || [];
}

function editSelectedCampaign() {
    const index = (globalCampaigns || []).findIndex(c => c && c.key === campaignHubSelectedKey);
    if (index < 0) {
        showAlert('Select a campaign first.', 'warning');
        return;
    }
    openCampaignEditorModal(index);
}

function removeSelectedCampaign() {
    const index = (globalCampaigns || []).findIndex(c => c && c.key === campaignHubSelectedKey);
    if (index < 0) {
        showAlert('Select a campaign first.', 'warning');
        return;
    }
    removeCampaignTemplate(index);
}

function renderCampaignHubShopAssignments() {
    const listEl = document.getElementById('campaign-shop-assignment-list');
    if (!listEl) return;

    const filterInput = document.getElementById('campaign-shop-filter');
    const filter = String(filterInput ? filterInput.value : '').toLowerCase().trim();
    const files = Object.keys(allShops || {}).sort((a, b) => a.localeCompare(b));
    const rows = files.filter(file => !filter || file.toLowerCase().includes(filter));

    if (rows.length === 0) {
        listEl.innerHTML = '<div class="campaign-assignment-row"><span class="campaign-assignment-sub">No shops match this filter.</span></div>';
        return;
    }

    listEl.innerHTML = rows.map(file => {
        const assigned = getShopCampaignAssignment(file);
        const currentTag = file === currentShopFile ? ' (current)' : '';
        return `
            <label class="campaign-assignment-row" for="campaign-shop-check-${escapeHtml(file)}">
                <div class="campaign-assignment-main">
                    <input type="checkbox" id="campaign-shop-check-${escapeHtml(file)}" class="campaign-shop-check" value="${escapeHtml(file)}">
                    <div>
                        <div class="campaign-assignment-name">${escapeHtml(file)}${escapeHtml(currentTag)}</div>
                        <div class="campaign-assignment-sub">Assigned: ${escapeHtml(assigned || 'None')}</div>
                    </div>
                </div>
            </label>
        `;
    }).join('');
}

function renderCampaignHubItemAssignments() {
    const listEl = document.getElementById('campaign-item-assignment-list');
    const shopMeta = document.getElementById('campaign-item-shop-meta');
    const selectedItemShop = getCampaignHubItemShopFile();
    const itemSource = getCampaignHubItemsForShop(selectedItemShop);
    if (shopMeta) {
        shopMeta.textContent = `Shop: ${selectedItemShop || '-'} (${itemSource.length} items)`;
    }
    if (!listEl) return;

    const filterInput = document.getElementById('campaign-item-filter');
    const filter = String(filterInput ? filterInput.value : '').toLowerCase().trim();
    const rows = itemSource.filter(item => {
        if (!filter) return true;
        const name = String(item.name || '').toLowerCase();
        const mat = String(item.material || '').toLowerCase();
        return name.includes(filter) || mat.includes(filter) || String(item.id).includes(filter);
    });

    if (rows.length === 0) {
        listEl.innerHTML = '<div class="campaign-assignment-row"><span class="campaign-assignment-sub">No items match this filter.</span></div>';
        return;
    }

    listEl.innerHTML = rows.map(item => `
        <label class="campaign-assignment-row" for="campaign-item-check-${item.id}">
            <div class="campaign-assignment-main">
                <input type="checkbox" id="campaign-item-check-${item.id}" class="campaign-item-check" value="${item.id}">
                <div>
                    <div class="campaign-assignment-name">${escapeHtml((item.name || item.material || `Item ${item.id}`))}</div>
                    <div class="campaign-assignment-sub">${escapeHtml(item.material || 'UNKNOWN')} x${Number(item.amount) || 1} | Slot ${Number(item.slot) || 0} | Assigned: ${escapeHtml(item.campaign || 'None')}</div>
                </div>
            </div>
        </label>
    `).join('');
}

function toggleCampaignHubShopSelection(selectAll) {
    document.querySelectorAll('#campaign-shop-assignment-list .campaign-shop-check').forEach(cb => {
        cb.checked = !!selectAll;
    });
}

function toggleCampaignHubItemSelection(selectAll) {
    document.querySelectorAll('#campaign-item-assignment-list .campaign-item-check').forEach(cb => {
        cb.checked = !!selectAll;
    });
}

function assignCampaignToSelectedShops() {
    const key = String(campaignHubSelectedKey || '').trim();
    if (!key) {
        showAlert('Select a campaign first.', 'warning');
        return;
    }
    const selectedFiles = Array.from(document.querySelectorAll('#campaign-shop-assignment-list .campaign-shop-check:checked'))
        .map(el => el.value)
        .filter(Boolean);
    if (selectedFiles.length === 0) {
        showAlert('Select at least one shop.', 'warning');
        return;
    }

    let changed = 0;
    selectedFiles.forEach(file => {
        if (applyCampaignToShopFile(file, key, false)) changed++;
    });
    if (changed > 0) {
        renderCampaignsTab();
        updateAll();
        showToast(`Assigned campaign to ${changed} shop(s).`, 'success');
    }
}

function clearCampaignFromSelectedShops() {
    const selectedFiles = Array.from(document.querySelectorAll('#campaign-shop-assignment-list .campaign-shop-check:checked'))
        .map(el => el.value)
        .filter(Boolean);
    if (selectedFiles.length === 0) {
        showAlert('Select at least one shop.', 'warning');
        return;
    }

    let changed = 0;
    selectedFiles.forEach(file => {
        if (applyCampaignToShopFile(file, '', false)) changed++;
    });
    if (changed > 0) {
        renderCampaignsTab();
        updateAll();
        showToast(`Cleared campaign on ${changed} shop(s).`, 'success');
    }
}

function assignCampaignToSelectedItems() {
    const key = String(campaignHubSelectedKey || '').trim();
    if (!key) {
        showAlert('Select a campaign first.', 'warning');
        return;
    }
    const targetShop = getCampaignHubItemShopFile();
    if (!targetShop) {
        showAlert('Select a shop first.', 'warning');
        return;
    }
    const selectedIds = Array.from(document.querySelectorAll('#campaign-item-assignment-list .campaign-item-check:checked'))
        .map(el => parseInt(el.value, 10))
        .filter(id => Number.isFinite(id));
    if (selectedIds.length === 0) {
        showAlert('Select at least one item.', 'warning');
        return;
    }

    const before = [];
    const after = [];
    if (targetShop === currentShopFile) {
        selectedIds.forEach(id => {
            const item = items.find(it => it.id === id);
            if (!item) return;
            const prev = String(item.campaign || '').trim();
            if (prev === key) return;
            before.push({ id, campaign: prev });
            item.campaign = key;
            after.push({ id, campaign: key });
        });
    } else {
        withParsedShopContext(targetShop, (parsedItems) => {
            selectedIds.forEach(id => {
                const item = parsedItems.find(it => it.id === id);
                if (!item) return;
                const prev = String(item.campaign || '').trim();
                if (prev === key) return;
                before.push({ id, campaign: prev });
                item.campaign = key;
                after.push({ id, campaign: key });
            });
            allShops[targetShop] = getParsedShopYamlFromCurrentContext();
            campaignHubDirtyShopFiles.add(targetShop);
        });
    }
    if (before.length === 0) return;

    addActivityEntry(
        'updated',
        'shop-item',
        { campaignAssignments: before },
        { campaignAssignments: after },
        { field: 'campaign', shopFile: targetShop, campaignHub: true, itemIds: before.map(e => e.id) }
    );
    renderCampaignsTab();
    updateAll();
    showToast(`Assigned campaign to ${before.length} item(s) in ${targetShop}.`, 'success');
}

function clearCampaignFromSelectedItems() {
    const targetShop = getCampaignHubItemShopFile();
    if (!targetShop) {
        showAlert('Select a shop first.', 'warning');
        return;
    }
    const selectedIds = Array.from(document.querySelectorAll('#campaign-item-assignment-list .campaign-item-check:checked'))
        .map(el => parseInt(el.value, 10))
        .filter(id => Number.isFinite(id));
    if (selectedIds.length === 0) {
        showAlert('Select at least one item.', 'warning');
        return;
    }

    const before = [];
    const after = [];
    if (targetShop === currentShopFile) {
        selectedIds.forEach(id => {
            const item = items.find(it => it.id === id);
            if (!item) return;
            const prev = String(item.campaign || '').trim();
            if (!prev) return;
            before.push({ id, campaign: prev });
            item.campaign = '';
            after.push({ id, campaign: '' });
        });
    } else {
        withParsedShopContext(targetShop, (parsedItems) => {
            selectedIds.forEach(id => {
                const item = parsedItems.find(it => it.id === id);
                if (!item) return;
                const prev = String(item.campaign || '').trim();
                if (!prev) return;
                before.push({ id, campaign: prev });
                item.campaign = '';
                after.push({ id, campaign: '' });
            });
            allShops[targetShop] = getParsedShopYamlFromCurrentContext();
            campaignHubDirtyShopFiles.add(targetShop);
        });
    }
    if (before.length === 0) return;

    addActivityEntry(
        'updated',
        'shop-item',
        { campaignAssignments: before },
        { campaignAssignments: after },
        { field: 'campaign', shopFile: targetShop, campaignHub: true, itemIds: before.map(e => e.id) }
    );
    renderCampaignsTab();
    updateAll();
    showToast(`Cleared campaign on ${before.length} item(s) in ${targetShop}.`, 'success');
}

function addCampaignTemplate() {
    openCampaignEditorModal(-1);
}

function openCampaignEditorModal(index) {
    const list = Array.isArray(globalCampaigns) ? globalCampaigns : [];
    const editing = index >= 0 && index < list.length;
    const campaign = editing ? list[index] : { key: '', name: '', start: '', end: '', timezone: '', buyMultiplier: 1, sellMultiplier: 1 };

    openEditModal({
        title: editing ? 'Edit Campaign' : 'Add Campaign',
        fields: [
            { id: 'modal-campaign-key', label: 'Key', value: campaign.key || '', hint: 'Unique id used by item/shop campaign selector.' },
            { id: 'modal-campaign-name', label: 'Name', value: campaign.name || '' },
            { id: 'modal-campaign-start', label: 'Start', value: campaign.start || '', hint: 'YYYY-MM-DD HH:mm (or ISO)' },
            { id: 'modal-campaign-end', label: 'End', value: campaign.end || '', hint: 'YYYY-MM-DD HH:mm (or ISO)' },
            { id: 'modal-campaign-timezone', label: 'Timezone', value: campaign.timezone || '', hint: 'Optional, e.g. UTC or Europe/Copenhagen' },
            { id: 'modal-campaign-buy', label: 'Buy Multiplier', type: 'number', value: Number(campaign.buyMultiplier) || 1, min: 0.01, step: '0.01', row: true },
            { id: 'modal-campaign-sell', label: 'Sell Multiplier', type: 'number', value: Number(campaign.sellMultiplier) || 1, min: 0.01, step: '0.01', row: true }
        ],
        onSave: (data) => {
            const key = String(data['modal-campaign-key'] || '').trim();
            if (!key) {
                showAlert('Campaign key is required.', 'warning');
                return;
            }
            const normalized = {
                key,
                name: String(data['modal-campaign-name'] || '').trim(),
                start: String(data['modal-campaign-start'] || '').trim(),
                end: String(data['modal-campaign-end'] || '').trim(),
                timezone: String(data['modal-campaign-timezone'] || '').trim(),
                buyMultiplier: Math.max(0.01, Number(data['modal-campaign-buy']) || 1),
                sellMultiplier: Math.max(0.01, Number(data['modal-campaign-sell']) || 1)
            };
            const duplicate = list.findIndex((c, i) => c && c.key === key && i !== index);
            if (duplicate !== -1) {
                showAlert(`Campaign key '${key}' already exists.`, 'warning');
                return;
            }

            const before = JSON.parse(JSON.stringify(globalCampaigns || []));
            if (!Array.isArray(globalCampaigns)) globalCampaigns = [];
            if (editing) globalCampaigns[index] = normalized;
            else globalCampaigns.push(normalized);
            campaignHubSelectedKey = normalized.key;
            addActivityEntry('updated', 'campaign-settings', { campaigns: before }, { campaigns: JSON.parse(JSON.stringify(globalCampaigns)) }, { field: 'campaigns' });
            renderCampaignsTab();
            updateAll();
        },
        onDelete: editing ? (() => removeCampaignTemplate(index)) : null
    });
}

function removeCampaignTemplate(index) {
    if (!Array.isArray(globalCampaigns) || index < 0 || index >= globalCampaigns.length) return;
    const beforeCampaigns = JSON.parse(JSON.stringify(globalCampaigns));
    const beforeShopCampaign = currentShopSettings.campaign || '';
    const affectedItemIds = [];
    const removed = globalCampaigns[index];
    globalCampaigns.splice(index, 1);
    if (currentShopSettings.campaign === removed.key) currentShopSettings.campaign = '';
    Object.keys(allShops || {}).forEach(file => {
        if (file === currentShopFile) return;
        if (getShopCampaignAssignment(file) !== removed.key) return;
        applyCampaignToShopFile(file, '', false);
    });
    items.forEach(item => {
        if (item.campaign === removed.key) {
            item.campaign = '';
            affectedItemIds.push(item.id);
        }
    });
    addActivityEntry(
        'updated',
        'campaign-settings',
        { campaigns: beforeCampaigns },
        { campaigns: JSON.parse(JSON.stringify(globalCampaigns)) },
        { field: 'campaigns' }
    );
    if (beforeShopCampaign !== (currentShopSettings.campaign || '')) {
        addActivityEntry(
            'updated',
            'shop-settings',
            { campaign: beforeShopCampaign },
            { campaign: currentShopSettings.campaign || '' },
            { field: 'campaign', shopFile: currentShopFile }
        );
    }
    if (affectedItemIds.length > 0) {
        addActivityEntry(
            'updated',
            'shop-item',
            { campaign: removed.key, itemCount: affectedItemIds.length },
            { campaign: '', itemCount: affectedItemIds.length },
            { field: 'campaign', itemIds: affectedItemIds, shopFile: currentShopFile }
        );
    }
    if (campaignHubSelectedKey === removed.key) {
        campaignHubSelectedKey = '';
    }
    renderCampaignsTab();
    updateAll();
}

function renderCampaignsTab() {
    const container = document.getElementById('campaigns-container');
    const count = document.getElementById('campaigns-count');
    const campaignSelect = document.getElementById('campaign-hub-selected');
    const itemShopSelect = document.getElementById('campaign-item-shop-select');
    const selectedMeta = document.getElementById('campaign-hub-selected-meta');
    const list = Array.isArray(globalCampaigns) ? globalCampaigns : [];

    if (count) count.textContent = `${list.length} campaigns`;

    if (list.length > 0 && !list.some(c => c && c.key === campaignHubSelectedKey)) {
        campaignHubSelectedKey = list[0].key;
    }
    if (list.length === 0) {
        campaignHubSelectedKey = '';
    }

    if (campaignSelect) {
        campaignSelect.innerHTML = '';
        list.forEach(c => {
            if (!c || !c.key) return;
            const opt = document.createElement('option');
            opt.value = c.key;
            opt.textContent = c.name ? `${c.name} (${c.key})` : c.key;
            campaignSelect.appendChild(opt);
        });
        campaignSelect.value = campaignHubSelectedKey || '';
        campaignSelect.dispatchEvent(new Event('refresh'));
    }

    if (itemShopSelect) {
        itemShopSelect.innerHTML = '';
        Object.keys(allShops || {}).sort((a, b) => a.localeCompare(b)).forEach(file => {
            const opt = document.createElement('option');
            opt.value = file;
            opt.textContent = file;
            itemShopSelect.appendChild(opt);
        });
        itemShopSelect.value = getCampaignHubItemShopFile();
        itemShopSelect.dispatchEvent(new Event('refresh'));
    }

    if (selectedMeta) {
        const selected = list.find(c => c && c.key === campaignHubSelectedKey) || null;
        if (!selected) {
            selectedMeta.textContent = 'No campaign selected.';
        } else {
            const active = isCampaignWindowActive(selected.start, selected.end, selected.timezone);
            const assignedShops = Object.keys(allShops || {}).filter(file => getShopCampaignAssignment(file) === selected.key).length;
            const selectedItemShop = getCampaignHubItemShopFile();
            const selectedShopItems = getCampaignHubItemsForShop(selectedItemShop);
            const assignedItems = selectedShopItems.filter(item => String(item.campaign || '').trim() === selected.key).length;
            selectedMeta.textContent = `${active ? 'Active' : 'Inactive'} | Buy x${formatDisplayPrice(Number(selected.buyMultiplier) || 1)} | Sell x${formatDisplayPrice(Number(selected.sellMultiplier) || 1)} | Shops: ${assignedShops} | Selected Shop Items: ${assignedItems}`;
        }
    }

    renderCampaignHubShopAssignments();
    renderCampaignHubItemAssignments();

    if (!container) return;
    container.innerHTML = '';
    if (list.length === 0) {
        container.innerHTML = `<div class="text-center" style="padding: 2.5rem 0; opacity: 0.75;">No campaigns yet. Click ADD CAMPAIGN.</div>`;
        initCustomSelects();
        return;
    }

    list.forEach((campaign, index) => {
        if (!campaign || !campaign.key) return;
        const active = isCampaignWindowActive(campaign.start, campaign.end, campaign.timezone);
        const assignedShops = Object.keys(allShops || {}).filter(file => getShopCampaignAssignment(file) === campaign.key).length;
        const selectedItemShop = getCampaignHubItemShopFile();
        const selectedShopItems = getCampaignHubItemsForShop(selectedItemShop);
        const assignedItems = selectedShopItems.filter(item => String(item.campaign || '').trim() === campaign.key).length;
        const card = document.createElement('div');
        card.className = 'shop-item';
        card.innerHTML = `
            <div class="item-header">
                <div class="flex-1">
                    <div class="item-title">${escapeHtml(campaign.name || campaign.key)}</div>
                    <div class="item-subtitle">${escapeHtml(campaign.key)}</div>
                    <div class="item-tags">
                        <span class="item-tag active">${active ? 'Active' : 'Inactive'}</span>
                        <span class="item-tag">Buy x${formatDisplayPrice(Number(campaign.buyMultiplier) || 1)}</span>
                        <span class="item-tag">Sell x${formatDisplayPrice(Number(campaign.sellMultiplier) || 1)}</span>
                        <span class="item-tag">Shops: ${assignedShops}</span>
                        <span class="item-tag">Selected Shop Items: ${assignedItems}</span>
                    </div>
                </div>
                <div class="flex flex-col gap-8 items-end">
                    <button class="btn btn-secondary" style="padding: 6px 10px;" onclick="openCampaignEditorModal(${index})">EDIT</button>
                </div>
            </div>
            <div class="item-subtitle" style="margin-top: 8px;">
                ${escapeHtml(campaign.start || '...')} -> ${escapeHtml(campaign.end || '...')}
                ${campaign.timezone ? ` (${escapeHtml(campaign.timezone)})` : ''}
            </div>
        `;
        container.appendChild(card);
    });

    initCustomSelects();
}

/**
 * CUSTOM SELECT SYSTEM
 */
function initCustomSelects() {
    document.querySelectorAll('select.premium-select').forEach(select => {
        if (select.dataset.customInitialized) return;
        createCustomDropdown(select);
    });
}

function createCustomDropdown(select) {
    const container = document.createElement('div');
    container.className = 'custom-select';
    if (select.id) container.id = 'custom-' + select.id;
    
    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';
    
    function getDisplayText(option) {
        if (!option) return 'Select...';
        let text = option.textContent;
        if (select.id === 'shop-file-selector') {
            const filename = option.value;
            let hasPerm = false;
            
            if (filename === currentShopFile) {
                hasPerm = currentShopSettings.permission && currentShopSettings.permission.trim() !== '';
            } else if (allShops[filename]) {
                // Better regex to check for shop-level permission (not indented)
                const match = allShops[filename].match(/^permission:\s*['"]?([^'"]+)['"]?/m);
                hasPerm = match && match[1].trim() !== '';
            }
            
            text = (hasPerm ? '\uD83D\uDD12 ' : '') + filename;
        }
        return text;
    }

    const triggerText = document.createElement('span');
    triggerText.textContent = getDisplayText(select.options[select.selectedIndex]);
    trigger.appendChild(triggerText);
    
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'custom-select-options';
    
    function updateOptions() {
        optionsContainer.innerHTML = '';
        Array.from(select.options).forEach((option, index) => {
            const opt = document.createElement('div');
            opt.className = 'custom-select-option';
            if (index === select.selectedIndex) opt.classList.add('selected');
            
            const displayText = getDisplayText(option);
            opt.textContent = displayText;
            opt.onclick = (e) => {
                e.stopPropagation();
                select.selectedIndex = index;
                select.dispatchEvent(new Event('change'));
                triggerText.textContent = displayText;
                container.classList.remove('open');
                updateOptions();
            };
            optionsContainer.appendChild(opt);
        });
    }
    
    updateOptions();
    
    trigger.onclick = (e) => {
        e.stopPropagation();
        const isOpen = container.classList.contains('open');
        // Close all other custom selects
        document.querySelectorAll('.custom-select').forEach(s => s.classList.remove('open'));
        if (!isOpen) container.classList.add('open');
    };
    
    container.appendChild(trigger);
    container.appendChild(optionsContainer);
    
    select.parentNode.insertBefore(container, select);
    select.dataset.customInitialized = "true";
    
    // Listen for external changes to the original select
    const updateDropdown = () => {
        triggerText.textContent = getDisplayText(select.options[select.selectedIndex]);
        updateOptions();
    };
    select.addEventListener('change', updateDropdown);
    select.addEventListener('refresh', updateDropdown);

    // Close on click outside
    document.addEventListener('click', () => {
        container.classList.remove('open');
    });
}

function updatePaginationVisibility(totalPages) {
    const pageNav = document.getElementById('page-navigation');
    if (!pageNav) return;

    if (currentTab === 'shop') {
        const rows = (currentShopSettings && currentShopSettings.rows) ? currentShopSettings.rows : 3;
        const itemsPerPage = rows * 9;
        
        if (!totalPages) {
            let maxSlot = items.length > 0 ? Math.max(...items.map(it => it.slot || 0)) : 0;
            totalPages = Math.ceil((maxSlot + 1) / itemsPerPage);
        }
        
        // Setup pagination drag listeners
        const buttons = pageNav.querySelectorAll('.page-btn');
        if (buttons.length >= 2) {
            const prevBtn = buttons[0];
            const nextBtn = buttons[1];
            
            prevBtn.ondragover = (e) => e.preventDefault();
            prevBtn.ondragenter = (e) => handlePaginationDragEnter(e, -1);
            prevBtn.ondragleave = (e) => handlePaginationDragLeave(e);
            
            nextBtn.ondragover = (e) => e.preventDefault();
            nextBtn.ondragenter = (e) => handlePaginationDragEnter(e, 1);
            nextBtn.ondragleave = (e) => handlePaginationDragLeave(e);
        }

        if (totalPages > 1 || draggedSlotIndex !== null) {
            pageNav.style.display = 'block';
            const indicator = document.getElementById('page-indicator');
            const displayTotal = Math.max(totalPages || 1, currentPreviewPage + 1);
            if (indicator) indicator.textContent = `Page ${currentPreviewPage + 1}/${displayTotal}`;
        } else {
            pageNav.style.display = 'none';
        }
    } else {
        pageNav.style.display = 'none';
    }
}

function updatePreview() {
    const grid = document.getElementById('preview-grid');
    if (!grid) return;
    grid.innerHTML = '';
    updatePreviewParityLabel();

    const rows = currentShopSettings.rows || 3;
    const rowsInput = document.getElementById('shop-rows-input');
    if (rowsInput) rowsInput.value = rows;
    const itemsPerPage = rows * 9;

    // Calculate total pages based on max slot
    let maxSlot = items.length > 0 ? Math.max(...items.map(it => it.slot || 0)) : 0;
    const totalPages = Math.ceil((maxSlot + 1) / itemsPerPage);
    
    const guiName = currentShopSettings.guiName;
    const titleElement = document.getElementById('preview-title');
    const titleInput = document.getElementById('preview-title-input');
    if (titleElement) titleElement.innerHTML = parseMinecraftColors(guiName);
    if (titleInput) titleInput.value = guiName;
    
    // Handle paging visibility
    updatePaginationVisibility(totalPages);

    for (let i = 0; i < rows * 9; i++) {
        const slot = document.createElement('div');
        slot.className = 'gui-slot';
        slot.dataset.slotIndex = i;
        
        // Drag and drop listeners
        slot.ondragover = handleDragOver;
        slot.ondragenter = handleDragEnter;
        slot.ondragleave = handleDragLeave;
        slot.ondragend = handleDragEnd;
        slot.ondrop = (e) => handleDrop(e, i, 'shop');
        
        const absoluteSlot = (currentPreviewPage * itemsPerPage) + i;
        const item = items.find(it => it.slot === absoluteSlot);

        if (item) {
            slot.draggable = true;
            slot.ondragstart = (e) => handleDragStart(e, i, 'shop');
            slot.classList.add('filled');
            
            slot.innerHTML = `<div class="item-icon"><img src="${getShopItemIconUrl(item)}" onerror="this.src='${TEXTURE_API}stone.png'"></div>`;
            if (item.amount > 1) {
                slot.innerHTML += `<div class="slot-amount">${item.amount}</div>`;
            }

            if (item.enchantments && Object.keys(item.enchantments).length > 0) {
                slot.classList.add('enchanted');
            }
            
            slot.onclick = () => openShopItemModal(item.id);
            
            if (previewParityMode) {
                setupTooltip(slot, item.name, buildShopTooltipLoreParity(item), '');
            } else {
                let extraHtml = '';

                // Add global GUI lore settings
                if (guiSettings.itemLore.showBuyPrice && item.price > 0) {
                    const processed = guiSettings.itemLore.buyPriceLine.replace('%price%', '$' + formatDisplayPrice(calculateItemTotalPrice(item, false)));
                    extraHtml += `<div class="tooltip-line">${parseMinecraftColors(processed)}</div>`;
                }
                if (guiSettings.itemLore.showSellPrice && item.sellPrice > 0) {
                    const processed = guiSettings.itemLore.sellPriceLine.replace('%sell-price%', '$' + formatDisplayPrice(calculateItemTotalPrice(item, true)));
                    extraHtml += `<div class="tooltip-line">${parseMinecraftColors(processed)}</div>`;
                }

                // Hints at the bottom
                let hintHtml = '';
                if (guiSettings.itemLore.showBuyHint && item.price > 0) {
                    hintHtml += `<div class="tooltip-line">${parseMinecraftColors(guiSettings.itemLore.buyHintLine)}</div>`;
                }
                if (guiSettings.itemLore.showSellHint && item.sellPrice > 0) {
                    hintHtml += `<div class="tooltip-line">${parseMinecraftColors(guiSettings.itemLore.sellHintLine)}</div>`;
                }

                if (hintHtml) extraHtml += `<div style="margin-top: 8px;">${hintHtml}</div>`;
                setupTooltip(slot, item.name, item.lore || [], extraHtml);
            }
        }
        
        grid.appendChild(slot);
    }
}

function setupTooltip(element, title, lore = [], extraHtml = '') {
    element.addEventListener('mouseenter', (e) => {
        const tooltip = document.getElementById('minecraft-tooltip');
        if (!tooltip) return;
        let html = `<div class="tooltip-title">${parseMinecraftColors(title)}</div>`;
        if (lore && lore.length > 0) {
            lore.forEach(line => {
                const coloredLine = parseMinecraftColors(line);
                html += `<div class="tooltip-line">${coloredLine || '&nbsp;'}</div>`;
            });
        }
        html += extraHtml;
        tooltip.innerHTML = html;
        tooltip.classList.add('show');
        moveMinecraftTooltip(e);
    });
    element.addEventListener('mousemove', moveMinecraftTooltip);
    element.addEventListener('mouseleave', hideMinecraftTooltip);
}

function moveMinecraftTooltip(e) {
    const tooltip = document.getElementById('minecraft-tooltip');
    if (!tooltip) return;
    tooltip.style.left = (e.clientX + 15) + 'px';
    tooltip.style.top = (e.clientY - 15) + 'px';
}

function hideMinecraftTooltip() {
    const tooltip = document.getElementById('minecraft-tooltip');
    if (tooltip) tooltip.classList.remove('show');
}

// ===== DRAG AND DROP HANDLERS =====

function handleDragStart(e, index, source) {
    if (!e || !e.dataTransfer) return;
    if (!Number.isInteger(index) || index < 0) return;
    draggedSlotIndex = index;
    draggedItemSource = source;
    draggedFromPage = currentPreviewPage;
    
    // Ensure pagination is visible if dragging shop items
    if (source === 'shop') {
        updatePaginationVisibility();
    }
    
    // Use a small delay to ensure the class is applied after the ghost image is created
    setTimeout(() => {
        e.target.classList.add('dragging');
    }, 0);
    
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.gui-slot').forEach(slot => {
        slot.classList.remove('drag-over');
    });
    
    draggedSlotIndex = null;
    draggedItemSource = null;
    draggedFromPage = null;
    if (pageFlipTimeout) {
        clearTimeout(pageFlipTimeout);
        pageFlipTimeout = null;
    }

    // Refresh pagination visibility
    updatePaginationVisibility();
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    e.target.closest('.gui-slot')?.classList.add('drag-over');
}

function handleDragLeave(e) {
    const slot = e.target.closest('.gui-slot');
    if (slot) {
        // Only remove if we're actually leaving the slot, not moving into a child element
        const rect = slot.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX >= rect.right || e.clientY < rect.top || e.clientY >= rect.bottom) {
            slot.classList.remove('drag-over');
        }
    }
}

function handleDrop(e, targetIndex, source) {
    if (!e) return false;
    e.stopPropagation();
    e.preventDefault();
    
    document.querySelectorAll('.gui-slot').forEach(slot => {
        slot.classList.remove('drag-over');
        slot.classList.remove('dragging');
    });

    if (draggedSlotIndex === null || draggedItemSource !== source) return false;
    if (!Number.isInteger(targetIndex) || targetIndex < 0) return false;
    if (draggedSlotIndex === targetIndex) return false;

    if (source === 'shop') {
        const rows = currentShopSettings.rows || 3;
        const itemsPerPage = rows * 9;
        if (!Number.isInteger(itemsPerPage) || itemsPerPage <= 0) return false;
        const fromAbsoluteSlot = (draggedFromPage * itemsPerPage) + draggedSlotIndex;
        const toAbsoluteSlot = (currentPreviewPage * itemsPerPage) + targetIndex;
        if (fromAbsoluteSlot < 0 || toAbsoluteSlot < 0) return false;

        const fromItem = items.find(it => it.slot === fromAbsoluteSlot);
        const toItem = items.find(it => it.slot === toAbsoluteSlot);

        if (fromItem) {
            const beforeFrom = JSON.parse(JSON.stringify(fromItem));
            const beforeTo = toItem ? JSON.parse(JSON.stringify(toItem)) : null;

            fromItem.slot = toAbsoluteSlot;
            if (toItem) {
                toItem.slot = fromAbsoluteSlot;
            }
            
            renderItems();
            updateAll();
            
            if (toItem) {
                addActivityEntry('updated', 'shop-item', 
                    [beforeFrom, beforeTo], 
                    [JSON.parse(JSON.stringify(fromItem)), JSON.parse(JSON.stringify(toItem))], 
                    { shopFile: currentShopFile, isSwap: true }
                );
            } else {
                addActivityEntry('updated', 'shop-item', beforeFrom, JSON.parse(JSON.stringify(fromItem)), {
                    shopFile: currentShopFile
                });
            }
            if (window.EditorTelemetry) window.EditorTelemetry.track('drag_drop', { source: 'shop', swap: !!toItem }, true);
        }
    } else if (source === 'mainmenu') {
        if (targetIndex > 53) return false;
        const fromItem = loadedGuiShops.find(s => s.slot === draggedSlotIndex);
        const toItem = loadedGuiShops.find(s => s.slot === targetIndex);
        
        if (fromItem) {
            const beforeFrom = JSON.parse(JSON.stringify(fromItem));
            const beforeTo = toItem ? JSON.parse(JSON.stringify(toItem)) : null;

            fromItem.slot = targetIndex;
            if (toItem) {
                toItem.slot = draggedSlotIndex;
            }
            
            renderMainMenuShops();
            updateGuiPreview();
            scheduleAutoSave();
            
            if (toItem) {
                addActivityEntry('updated', 'main-menu-button', 
                    [beforeFrom, beforeTo], 
                    [JSON.parse(JSON.stringify(fromItem)), JSON.parse(JSON.stringify(toItem))],
                    { isSwap: true }
                );
            } else {
                addActivityEntry('updated', 'main-menu-button', beforeFrom, JSON.parse(JSON.stringify(fromItem)));
            }
            if (window.EditorTelemetry) window.EditorTelemetry.track('drag_drop', { source: 'mainmenu', swap: !!toItem }, true);
        }
    } else if (source === 'purchase' || source === 'sell') {
        const settings = transactionSettings[source];
        if (!settings) return false;
        
        const findItem = (slot) => {
            for (const [key, btn] of Object.entries(settings.buttons)) {
                if (btn.slot === slot) return { type: 'main', key, btn };
            }
            for (const group of ['add', 'remove', 'set']) {
                for (const [amount, btn] of Object.entries(settings[group].buttons)) {
                    if (btn.slot === slot) return { type: group, key: amount, btn };
                }
            }
            if (settings.displaySlot === slot) return { type: 'display' };
            return null;
        };

        const fromInfo = findItem(draggedSlotIndex);
        const toInfo = findItem(targetIndex);

        if (fromInfo) {
            let beforeFrom, beforeTo;

            // Capture before states
            if (fromInfo.type === 'display') {
                beforeFrom = { slot: settings.displaySlot, isDisplay: true, name: 'Display Item' };
            } else {
                beforeFrom = JSON.parse(JSON.stringify(fromInfo.btn));
            }

            if (toInfo) {
                if (toInfo.type === 'display') {
                    beforeTo = { slot: settings.displaySlot, isDisplay: true, name: 'Display Item' };
                } else {
                    beforeTo = JSON.parse(JSON.stringify(toInfo.btn));
                }
            }

            // Move fromInfo to targetIndex
            if (fromInfo.type === 'display') {
                settings.displaySlot = targetIndex;
            } else {
                fromInfo.btn.slot = targetIndex;
            }

            // Swap if toInfo exists
            if (toInfo) {
                if (toInfo.type === 'display') {
                    settings.displaySlot = draggedSlotIndex;
                } else {
                    toInfo.btn.slot = draggedSlotIndex;
                }
            }

            updateTransactionSettings();
            scheduleAutoSave();

            // Add activity entries
            const afterFrom = fromInfo.type === 'display' ? { slot: settings.displaySlot, isDisplay: true, name: 'Display Item' } : JSON.parse(JSON.stringify(fromInfo.btn));
            
            if (toInfo) {
                const afterTo = toInfo.type === 'display' ? { slot: settings.displaySlot, isDisplay: true, name: 'Display Item' } : JSON.parse(JSON.stringify(toInfo.btn));
                addActivityEntry('updated', `${source}-menu-button`, 
                    [beforeFrom, beforeTo], 
                    [afterFrom, afterTo], 
                    {
                        type: source,
                        isSwap: true,
                        batch: [
                            { group: fromInfo.type, key: fromInfo.key },
                            { group: toInfo.type, key: toInfo.key }
                        ]
                    }
                );
            } else {
                addActivityEntry('updated', `${source}-menu-button`, beforeFrom, afterFrom, {
                    type: source,
                    group: fromInfo.type,
                    key: fromInfo.key
                });
            }
            if (window.EditorTelemetry) window.EditorTelemetry.track('drag_drop', { source, swap: !!toInfo }, true);
        }
    }

    draggedSlotIndex = null;
    draggedItemSource = null;
    draggedFromPage = null;
    if (pageFlipTimeout) {
        clearTimeout(pageFlipTimeout);
        pageFlipTimeout = null;
    }
    return false;
}

function handlePaginationDragEnter(e, direction) {
    if (draggedSlotIndex === null || draggedItemSource !== 'shop') return;
    const btn = e.target.closest('.page-btn');
    if (!btn) return;
    
    btn.classList.add('drag-over');
    
    if (pageFlipTimeout) clearTimeout(pageFlipTimeout);
    pageFlipTimeout = setTimeout(() => {
        const newPage = currentPreviewPage + direction;
        if (newPage >= 0) {
            changePage(direction);
        }
    }, 600);
}

function handlePaginationDragLeave(e) {
    const btn = e.target.closest('.page-btn');
    if (btn) {
        const rect = btn.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX >= rect.right || e.clientY < rect.top || e.clientY >= rect.bottom) {
            btn.classList.remove('drag-over');
            if (pageFlipTimeout) {
                clearTimeout(pageFlipTimeout);
                pageFlipTimeout = null;
            }
        }
    }
}

function renderGuiSettings() {
    const container = document.getElementById('gui-settings-container');
    if (!container) return;

    container.innerHTML = `
        <div class="settings-group card-base full-width" style="grid-column: 1 / -1;">
            <h3 class="group-title">Navigation Buttons</h3>
            <div class="grid-list" style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));">
                <div class="shop-item" onclick="openGuiButtonModal('backButton', 'Back Button')">
                    <div class="item-title">${parseMinecraftColors(guiSettings.backButton.name)}</div>
                    <div class="item-subtitle">Back Button</div>
                </div>
                <div class="shop-item" onclick="openGuiButtonModal('prevButton', 'Previous Page Button')">
                    <div class="item-title">${parseMinecraftColors(guiSettings.prevButton.name)}</div>
                    <div class="item-subtitle">Previous Page Button</div>
                </div>
                <div class="shop-item" onclick="openGuiButtonModal('nextButton', 'Next Page Button')">
                    <div class="item-title">${parseMinecraftColors(guiSettings.nextButton.name)}</div>
                    <div class="item-subtitle">Next Page Button</div>
                </div>
            </div>
        </div>

        <div class="settings-group card-base full-width" style="grid-column: 1 / -1;">
            <div class="flex justify-between items-center mb-16">
                <h3 class="group-title m-0">Economy Safety Guards</h3>
                <div class="flex items-center gap-8">
                    <button class="btn btn-secondary" style="padding: 6px 10px;" onclick="applyEconomySafetyPreset('strict')" title="Strict safety limits and confirmations">STRICT</button>
                    <button class="btn btn-secondary" style="padding: 6px 10px;" onclick="applyEconomySafetyPreset('balanced')" title="Balanced defaults for most servers">BALANCED</button>
                    <button class="btn btn-secondary" style="padding: 6px 10px;" onclick="applyEconomySafetyPreset('off')" title="Disable optional safety checks">OFF</button>
                </div>
            </div>
            <div class="checkbox-grid" style="margin-bottom: 14px;">
                <label class="flex items-center gap-8 cursor-pointer" title="Master toggle for economy safety checks">
                    <input type="checkbox" ${economySafetySettings.enabled ? 'checked' : ''} onchange="updateEconomySafetySetting('enabled', this.checked)">
                    <span>Enabled</span>
                </label>
                <label class="flex items-center gap-8 cursor-pointer" title="Enable anti-spike multiplier and step-change checks">
                    <input type="checkbox" ${economySafetySettings.antiSpikeEnabled ? 'checked' : ''} onchange="updateEconomySafetySetting('antiSpikeEnabled', this.checked)">
                    <span>Anti-Spike Enabled</span>
                </label>
                <label class="flex items-center gap-8 cursor-pointer" title="Enable per-action cooldowns">
                    <input type="checkbox" ${economySafetySettings.cooldownsEnabled ? 'checked' : ''} onchange="updateEconomySafetySetting('cooldownsEnabled', this.checked)">
                    <span>Cooldowns Enabled</span>
                </label>
                <label class="flex items-center gap-8 cursor-pointer" title="Require second confirm click above threshold">
                    <input type="checkbox" ${economySafetySettings.largePurchaseConfirmEnabled ? 'checked' : ''} onchange="updateEconomySafetySetting('largePurchaseConfirmEnabled', this.checked)">
                    <span>Large Purchase Confirm</span>
                </label>
                <label class="flex items-center gap-8 cursor-pointer" title="Notify admins on guard/economy failures">
                    <input type="checkbox" ${economySafetySettings.adminAlertsEnabled ? 'checked' : ''} onchange="updateEconomySafetySetting('adminAlertsEnabled', this.checked)">
                    <span>Admin Alerts Enabled</span>
                </label>
            </div>
            <div class="form-row">
                <div class="setting-item flex-1">
                    <label title="0 disables this cap">Max Transaction Value</label>
                    <input type="number" min="0" step="0.01" value="${economySafetySettings.maxTransactionValue}" onchange="updateEconomySafetySetting('maxTransactionValue', Number(this.value) || 0)">
                </div>
                <div class="setting-item flex-1">
                    <label title="0 disables this cap">Max Unit Price</label>
                    <input type="number" min="0" step="0.01" value="${economySafetySettings.maxUnitPrice}" onchange="updateEconomySafetySetting('maxUnitPrice', Number(this.value) || 0)">
                </div>
            </div>
            <div class="form-row">
                <div class="setting-item flex-1">
                    <label title="Buy cooldown in ms">Buy Cooldown (ms)</label>
                    <input type="number" min="0" step="1" value="${economySafetySettings.buyCooldownMs}" onchange="updateEconomySafetySetting('buyCooldownMs', Math.max(0, parseInt(this.value, 10) || 0))">
                </div>
                <div class="setting-item flex-1">
                    <label title="Sell cooldown in ms">Sell Cooldown (ms)</label>
                    <input type="number" min="0" step="1" value="${economySafetySettings.sellCooldownMs}" onchange="updateEconomySafetySetting('sellCooldownMs', Math.max(0, parseInt(this.value, 10) || 0))">
                </div>
                <div class="setting-item flex-1">
                    <label title="Bulk sell cooldown in ms">Bulk Sell Cooldown (ms)</label>
                    <input type="number" min="0" step="1" value="${economySafetySettings.bulkSellCooldownMs}" onchange="updateEconomySafetySetting('bulkSellCooldownMs', Math.max(0, parseInt(this.value, 10) || 0))">
                </div>
            </div>
            <div class="form-row">
                <div class="setting-item flex-1">
                    <label title="Maximum unit/base multiplier">Anti-Spike Max Base Multiplier</label>
                    <input type="number" min="0" step="0.01" value="${economySafetySettings.antiSpikeMaxBaseMultiplier}" onchange="updateEconomySafetySetting('antiSpikeMaxBaseMultiplier', Number(this.value) || 0)">
                </div>
                <div class="setting-item flex-1">
                    <label title="Minimum unit/base multiplier (0 disables lower bound)">Anti-Spike Min Base Multiplier</label>
                    <input type="number" min="0" step="0.01" value="${economySafetySettings.antiSpikeMinBaseMultiplier}" onchange="updateEconomySafetySetting('antiSpikeMinBaseMultiplier', Number(this.value) || 0)">
                </div>
                <div class="setting-item flex-1">
                    <label title="Allowed relative step change from last successful trade">Anti-Spike Max Step Change Ratio</label>
                    <input type="number" min="0" step="0.01" value="${economySafetySettings.antiSpikeMaxStepChangeRatio}" onchange="updateEconomySafetySetting('antiSpikeMaxStepChangeRatio', Number(this.value) || 0)">
                </div>
            </div>
            <div class="form-row">
                <div class="setting-item flex-1">
                    <label title="Confirmation threshold amount">Large Purchase Threshold</label>
                    <input type="number" min="0" step="0.01" value="${economySafetySettings.largePurchaseConfirmThreshold}" onchange="updateEconomySafetySetting('largePurchaseConfirmThreshold', Number(this.value) || 0)">
                </div>
                <div class="setting-item flex-1">
                    <label title="Second-click timeout in seconds">Large Purchase Timeout (s)</label>
                    <input type="number" min="1" step="1" value="${economySafetySettings.largePurchaseConfirmTimeoutSeconds}" onchange="updateEconomySafetySetting('largePurchaseConfirmTimeoutSeconds', Math.max(1, parseInt(this.value, 10) || 10))">
                </div>
            </div>
            <div class="form-row">
                <div class="setting-item flex-1">
                    <label title="Permission that receives alert messages">Admin Notify Permission</label>
                    <input type="text" value="${escapeHtml(economySafetySettings.adminNotifyPermission || 'geniusshop.admin')}" onchange="updateEconomySafetySetting('adminNotifyPermission', this.value)">
                </div>
                <div class="setting-item flex-1">
                    <label title="Minimum time between alert broadcasts">Admin Alert Rate Limit (ms)</label>
                    <input type="number" min="0" step="1" value="${economySafetySettings.adminAlertRateLimitMs}" onchange="updateEconomySafetySetting('adminAlertRateLimitMs', Math.max(0, parseInt(this.value, 10) || 0))">
                </div>
            </div>
        </div>

        <div class="settings-group card-base">
            <h3 class="group-title">Item Lore Price Lines</h3>
            <div class="form-row">
                <div class="setting-item flex-1">
                    <label for="gui-buy-price-line">Buy Price Line</label>
                    <input type="text" id="gui-buy-price-line" name="buy-price-line" value="${guiSettings.itemLore.buyPriceLine}" onchange="updateGuiSetting('itemLore', 'buyPriceLine', this.value)">
                </div>
                <div class="setting-item flex-1">
                    <label for="gui-sell-price-line">Sell Price Line</label>
                    <input type="text" id="gui-sell-price-line" name="sell-price-line" value="${guiSettings.itemLore.sellPriceLine}" onchange="updateGuiSetting('itemLore', 'sellPriceLine', this.value)">
                </div>
            </div>
            <div class="form-row">
                <div class="setting-item flex-1">
                    <label for="gui-buy-hint-line">Buy Hint Line</label>
                    <input type="text" id="gui-buy-hint-line" name="buy-hint-line" value="${guiSettings.itemLore.buyHintLine}" onchange="updateGuiSetting('itemLore', 'buyHintLine', this.value)">
                </div>
                <div class="setting-item flex-1">
                    <label for="gui-sell-hint-line">Sell Hint Line</label>
                    <input type="text" id="gui-sell-hint-line" name="sell-hint-line" value="${guiSettings.itemLore.sellHintLine}" onchange="updateGuiSetting('itemLore', 'sellHintLine', this.value)">
                </div>
            </div>
            
            <div class="checkbox-grid">
                <label class="flex items-center gap-8 cursor-pointer">
                    <input type="checkbox" id="gui-show-buy-price" name="show-buy-price" ${guiSettings.itemLore.showBuyPrice ? 'checked' : ''} onchange="updateGuiSetting('itemLore', 'showBuyPrice', this.checked)">
                    <span>Show Buy Price</span>
                </label>
                <label class="flex items-center gap-8 cursor-pointer">
                    <input type="checkbox" id="gui-show-sell-price" name="show-sell-price" ${guiSettings.itemLore.showSellPrice ? 'checked' : ''} onchange="updateGuiSetting('itemLore', 'showSellPrice', this.checked)">
                    <span>Show Sell Price</span>
                </label>
                <label class="flex items-center gap-8 cursor-pointer">
                    <input type="checkbox" id="gui-show-buy-hint" name="show-buy-hint" ${guiSettings.itemLore.showBuyHint ? 'checked' : ''} onchange="updateGuiSetting('itemLore', 'showBuyHint', this.checked)">
                    <span>Show Buy Hint</span>
                </label>
                <label class="flex items-center gap-8 cursor-pointer">
                    <input type="checkbox" id="gui-show-sell-hint" name="show-sell-hint" ${guiSettings.itemLore.showSellHint ? 'checked' : ''} onchange="updateGuiSetting('itemLore', 'showSellHint', this.checked)">
                    <span>Show Sell Hint</span>
                </label>
            </div>
        </div>

        <div class="settings-group card-base">
            <h3 class="group-title">Special Item Lines</h3>
            <div class="form-row">
                <div class="setting-item flex-1">
                    <label for="gui-amount-line">Amount Line</label>
                    <input type="text" id="gui-amount-line" name="amount-line" value="${guiSettings.itemLore.amountLine}" onchange="updateGuiSetting('itemLore', 'amountLine', this.value)">
                </div>
                <div class="setting-item flex-1">
                    <label for="gui-total-line">Total Line</label>
                    <input type="text" id="gui-total-line" name="total-line" value="${guiSettings.itemLore.totalLine}" onchange="updateGuiSetting('itemLore', 'totalLine', this.value)">
                </div>
            </div>
            <div class="form-row">
                <div class="setting-item flex-1">
                    <label for="gui-spawner-type-line">Spawner Type Line</label>
                    <input type="text" id="gui-spawner-type-line" name="spawner-type-line" value="${guiSettings.itemLore.spawnerTypeLine}" onchange="updateGuiSetting('itemLore', 'spawnerTypeLine', this.value)">
                </div>
                <div class="setting-item flex-1">
                    <label for="gui-spawner-item-line">Spawner Item Line</label>
                    <input type="text" id="gui-spawner-item-line" name="spawner-item-line" value="${guiSettings.itemLore.spawnerItemLine}" onchange="updateGuiSetting('itemLore', 'spawnerItemLine', this.value)">
                </div>
            </div>
            <div class="form-row">
                <div class="setting-item flex-1">
                    <label for="gui-potion-type-line">Potion Type Line</label>
                    <input type="text" id="gui-potion-type-line" name="potion-type-line" value="${guiSettings.itemLore.potionTypeLine}" onchange="updateGuiSetting('itemLore', 'potionTypeLine', this.value)">
                </div>
            </div>
            <div class="form-row">
                <div class="setting-item flex-1">
                    <label for="gui-global-limit-line">Global Limit Line</label>
                    <input type="text" id="gui-global-limit-line" name="global-limit-line" value="${guiSettings.itemLore.globalLimitLine}" onchange="updateGuiSetting('itemLore', 'globalLimitLine', this.value)">
                </div>
                <div class="setting-item flex-1">
                    <label for="gui-player-limit-line">Player Limit Line</label>
                    <input type="text" id="gui-player-limit-line" name="player-limit-line" value="${guiSettings.itemLore.playerLimitLine}" onchange="updateGuiSetting('itemLore', 'playerLimitLine', this.value)">
                </div>
            </div>
            <div class="form-row">
                <div class="setting-item flex-1">
                    <label for="gui-stock-reset-timer-line">Stock Reset Timer Line</label>
                    <input type="text" id="gui-stock-reset-timer-line" name="stock-reset-timer-line" value="${guiSettings.itemLore.stockResetTimerLine}" onchange="updateGuiSetting('itemLore', 'stockResetTimerLine', this.value)">
                </div>
                <div class="setting-item flex-1">
                    <label for="gui-global-limit-value-format">Global Limit Value Format</label>
                    <input type="text" id="gui-global-limit-value-format" name="global-limit-value-format" value="${guiSettings.itemLore.globalLimitValueFormat}" onchange="updateGuiSetting('itemLore', 'globalLimitValueFormat', this.value)">
                </div>
            </div>
            <div class="form-row">
                <div class="setting-item flex-1">
                    <label for="gui-player-limit-value-format">Player Limit Value Format</label>
                    <input type="text" id="gui-player-limit-value-format" name="player-limit-value-format" value="${guiSettings.itemLore.playerLimitValueFormat}" onchange="updateGuiSetting('itemLore', 'playerLimitValueFormat', this.value)">
                </div>
                <div class="setting-item flex-1">
                    <label for="gui-stock-reset-timer-value-format">Stock Reset Timer Value Format</label>
                    <input type="text" id="gui-stock-reset-timer-value-format" name="stock-reset-timer-value-format" value="${guiSettings.itemLore.stockResetTimerValueFormat}" onchange="updateGuiSetting('itemLore', 'stockResetTimerValueFormat', this.value)">
                </div>
            </div>
        </div>

        <div class="settings-group card-base full-width" style="grid-column: 1 / -1;">
            <h3 class="group-title" data-i18n="web-editor.gui-settings.lore-format-title">Shop Item Lore Format</h3>
            <div class="setting-item">
                <label for="gui-lore-format" class="sr-only" data-i18n="web-editor.gui-settings.lore-format-label">Lore Format</label>
                <textarea id="gui-lore-format" name="lore-format" rows="8" style="width: 100%; background: rgba(0,0,0,0.2); color: #f8fafc; border: 1px solid var(--border); border-radius: 12px; padding: 15px; font-family: 'Consolas', monospace; font-size: 14px; line-height: 1.6;" 
                          onchange="updateGuiLoreFormat(this.value)">${guiSettings.itemLore.loreFormat ? guiSettings.itemLore.loreFormat.join('\n') : ''}</textarea>
                <div style="margin-top: 12px; font-size: 13px; color: var(--text-muted); line-height: 1.6; background: rgba(120, 119, 198, 0.05); padding: 15px; border-radius: 8px; border: 1px solid rgba(120, 119, 198, 0.1);">
                    <strong style="color: var(--primary-light);">Available Placeholders:</strong><br>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; margin-top: 10px;">
                        <code>%price-line%</code> <code>%buy-price-line%</code> <code>%sell-price-line%</code> <code>%custom-lore%</code> <code>%spawner-type-line%</code> <code>%spawner-item-line%</code> <code>%potion-type-line%</code> <code>%global-limit%</code> <code>%player-limit%</code> <code>%stock-reset-timer%</code> <code>%hint-line%</code> <code>%buy-hint-line%</code> <code>%sell-hint-line%</code>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function updateGuiLoreFormat(value) {
    const beforeData = [...(guiSettings.itemLore.loreFormat || [])];
    const lines = value.split('\n').map(l => l.trim());
    guiSettings.itemLore.loreFormat = lines;
    
    addActivityEntry('updated', 'gui-settings', { loreFormat: beforeData }, { loreFormat: lines }, {
        group: 'itemLore',
        field: 'loreFormat'
    });
    
    scheduleAutoSave();
}

function updateGuiSetting(group, field, value) {
    const beforeData = JSON.parse(JSON.stringify(guiSettings[group]));
    guiSettings[group][field] = value;
    
    addActivityEntry('updated', 'gui-settings', beforeData, JSON.parse(JSON.stringify(guiSettings[group])), {
        group: group,
        field: field
    });
    
    scheduleAutoSave();
}

function updateGuiSettingGroup(group, subGroup, field, value) {
    const beforeData = JSON.parse(JSON.stringify(guiSettings[group][subGroup]));
    guiSettings[group][subGroup][field] = value;
    
    addActivityEntry('updated', 'gui-settings', beforeData, JSON.parse(JSON.stringify(guiSettings[group][subGroup])), {
        group: group,
        subGroup: subGroup,
        field: field
    });
    
    scheduleAutoSave();
}

function updateEconomySafetySetting(field, value) {
    const beforeData = JSON.parse(JSON.stringify(economySafetySettings));
    economySafetySettings[field] = value;

    addActivityEntry('updated', 'config-settings', beforeData, JSON.parse(JSON.stringify(economySafetySettings)), {
        section: 'economy-safety',
        field
    });
    scheduleAutoSave();
}

function applyEconomySafetyPreset(mode) {
    const beforeData = JSON.parse(JSON.stringify(economySafetySettings));
    const presets = {
        strict: {
            enabled: true,
            maxTransactionValue: 1000000,
            maxUnitPrice: 100000,
            antiSpikeEnabled: true,
            antiSpikeMaxBaseMultiplier: 3,
            antiSpikeMinBaseMultiplier: 0.2,
            antiSpikeMaxStepChangeRatio: 1.5,
            cooldownsEnabled: true,
            buyCooldownMs: 500,
            sellCooldownMs: 500,
            bulkSellCooldownMs: 1000,
            largePurchaseConfirmEnabled: true,
            largePurchaseConfirmThreshold: 250000,
            largePurchaseConfirmTimeoutSeconds: 12,
            adminAlertsEnabled: true,
            adminNotifyPermission: 'geniusshop.admin',
            adminAlertRateLimitMs: 1500
        },
        balanced: {
            enabled: true,
            maxTransactionValue: 50000000,
            maxUnitPrice: 10000000,
            antiSpikeEnabled: true,
            antiSpikeMaxBaseMultiplier: 10,
            antiSpikeMinBaseMultiplier: 0,
            antiSpikeMaxStepChangeRatio: 5,
            cooldownsEnabled: true,
            buyCooldownMs: 250,
            sellCooldownMs: 250,
            bulkSellCooldownMs: 500,
            largePurchaseConfirmEnabled: true,
            largePurchaseConfirmThreshold: 1000000,
            largePurchaseConfirmTimeoutSeconds: 10,
            adminAlertsEnabled: false,
            adminNotifyPermission: 'geniusshop.admin',
            adminAlertRateLimitMs: 3000
        },
        off: {
            enabled: false,
            maxTransactionValue: 0,
            maxUnitPrice: 0,
            antiSpikeEnabled: false,
            antiSpikeMaxBaseMultiplier: 10,
            antiSpikeMinBaseMultiplier: 0,
            antiSpikeMaxStepChangeRatio: 5,
            cooldownsEnabled: false,
            buyCooldownMs: 0,
            sellCooldownMs: 0,
            bulkSellCooldownMs: 0,
            largePurchaseConfirmEnabled: false,
            largePurchaseConfirmThreshold: 0,
            largePurchaseConfirmTimeoutSeconds: 10,
            adminAlertsEnabled: false,
            adminNotifyPermission: 'geniusshop.admin',
            adminAlertRateLimitMs: 3000
        }
    };

    if (!presets[mode]) return;
    economySafetySettings = { ...economySafetySettings, ...presets[mode] };
    addActivityEntry('updated', 'config-settings', beforeData, JSON.parse(JSON.stringify(economySafetySettings)), {
        section: 'economy-safety',
        preset: mode
    });
    renderGuiSettings();
    scheduleAutoSave();
}

function openGuiButtonModal(buttonKey, title) {
    const btn = guiSettings[buttonKey];
    openEditModal({
        title: `Edit ${title}`,
        fields: [
            { id: 'modal-name', label: 'Display Name', value: btn.name },
            { id: 'modal-lore', label: 'Lore (one per line)', type: 'textarea', value: (btn.lore || []).join('\n') }
        ],
        onSave: (data) => {
            const beforeData = JSON.parse(JSON.stringify(btn));
            btn.name = data['modal-name'];
            btn.lore = data['modal-lore'].split('\n');
            
            addActivityEntry('updated', 'gui-settings', beforeData, JSON.parse(JSON.stringify(btn)), {
                button: buttonKey
            });
            
            renderGuiSettings();
            scheduleAutoSave();
        }
    });
}

function renderMainMenuShops() {
    const container = document.getElementById('mainmenu-shops-container');
    if (!container) {
        if (document.getElementById('mainmenu-title-display')) {
            document.getElementById('mainmenu-title-display').innerHTML = parseMinecraftColors(mainMenuSettings.title);
        }
        if (document.getElementById('mainmenu-rows-display')) {
            document.getElementById('mainmenu-rows-display').textContent = mainMenuSettings.rows;
        }
        if (document.getElementById('mainmenu-buttons-count')) {
            document.getElementById('mainmenu-buttons-count').textContent = loadedGuiShops.length;
        }
        return;
    }
    container.innerHTML = '';

    loadedGuiShops.forEach((shop, index) => {
        const el = document.createElement('div');
        el.className = 'shop-item';
        
        let action = (shop.action || '').toString().trim().toLowerCase();
        if (!action) {
            if (shop.shopKey) {
                action = 'shop-key';
            } else if (shop.commands && shop.commands.length > 0) {
                action = 'command';
            } else {
                action = 'no-action';
            }
        }

        let tagsHtml = '<div class="item-tags">';
        tagsHtml += `<span class="item-tag active">Action: ${escapeHtml(action)}</span>`;
        if (action === 'shop-key' && shop.shopKey) tagsHtml += `<span class="item-tag active">Shop: ${escapeHtml(shop.shopKey)}</span>`;
        if ((action === 'command' || action === 'command-close') && shop.commands && shop.commands.length > 0) {
            tagsHtml += `<span class="item-tag active">Commands (${shop.commands.length})</span>`;
        }
        if (shop.lore && shop.lore.length > 0) {
            tagsHtml += `<span class="item-tag active">Lore (${shop.lore.length})</span>`;
        }
        if (shop.permission) tagsHtml += `<span class="item-tag active" title="${escapeHtml(shop.permission)}">Permission</span>`;
        if (shop.hideAttributes) tagsHtml += `<span class="item-tag">Hide Attr</span>`;
        if (shop.hideAdditional) tagsHtml += `<span class="item-tag">Hide Addon</span>`;
        tagsHtml += '</div>';

        let loreHtml = '';
        if (shop.lore && shop.lore.length > 0) {
            loreHtml = '<div class="item-lore-preview">';
            shop.lore.forEach(line => {
                loreHtml += `<div class="lore-line">${parseMinecraftColors(line) || '&nbsp;'}</div>`;
            });
            loreHtml += '</div>';
        }

        el.innerHTML = `
            <div class="item-header">
                <div class="item-icon">
                    <img src="${TEXTURE_API}${shop.material.toLowerCase()}.png" onerror="this.src='${TEXTURE_API}chest.png'">
                </div>
                <div class="flex-1">
                    <div class="item-title">${parseMinecraftColors(shop.name)}</div>
                    <div class="item-subtitle">Slot: ${shop.slot}</div>
                    ${tagsHtml}
                </div>
            </div>
            ${loreHtml}
        `;
        el.onclick = () => openMainMenuShopModal(index);
        container.appendChild(el);
    });

    if (document.getElementById('mainmenu-title-display')) {
        document.getElementById('mainmenu-title-display').innerHTML = parseMinecraftColors(mainMenuSettings.title);
    }
    if (document.getElementById('mainmenu-rows-display')) {
        document.getElementById('mainmenu-rows-display').textContent = mainMenuSettings.rows;
    }
    if (document.getElementById('mainmenu-buttons-count')) {
        document.getElementById('mainmenu-buttons-count').textContent = loadedGuiShops.length;
    }
}

function updateGuiPreview() {
    const grid = document.getElementById('preview-grid');
    if (!grid) return;
    grid.innerHTML = '';
    updatePreviewParityLabel();

    // Handle paging visibility
    updatePaginationVisibility();

    const titleElement = document.getElementById('preview-title');
    const titleInput = document.getElementById('preview-title-input');
    if (titleElement) titleElement.innerHTML = parseMinecraftColors(mainMenuSettings.title);
    if (titleInput) titleInput.value = mainMenuSettings.title;

    const rowsInput = document.getElementById('mainmenu-rows-input');
    if (rowsInput) rowsInput.value = mainMenuSettings.rows;

    for (let i = 0; i < mainMenuSettings.rows * 9; i++) {
        const slot = document.createElement('div');
        slot.className = 'gui-slot';
        slot.dataset.slotIndex = i;

        // Drag and drop listeners
        slot.ondragover = handleDragOver;
        slot.ondragenter = handleDragEnter;
        slot.ondragleave = handleDragLeave;
        slot.ondragend = handleDragEnd;
        slot.ondrop = (e) => handleDrop(e, i, 'mainmenu');
        
        const shop = loadedGuiShops.find(s => s.slot === i);
        if (shop) {
            slot.draggable = true;
            slot.ondragstart = (e) => handleDragStart(e, i, 'mainmenu');
            slot.classList.add('filled');
            
            slot.innerHTML = `<div class="item-icon"><img src="${TEXTURE_API}${shop.material.toLowerCase()}.png" onerror="this.src='${TEXTURE_API}chest.png'"></div>`;
            
            slot.onclick = () => openMainMenuShopModal(loadedGuiShops.indexOf(shop));

            if (previewParityMode) {
                // Replace placeholders in preview
                const processedLore = (shop.lore || []).map(line =>
                    line.replace(/%available-times%/g, 'Available Times...')
                        .replace(/%version%/g, serverInfo.version || '1.0.0')
                        .replace(/%update-available%/g, '')
                );
                setupTooltip(slot, shop.name, processedLore);
            } else {
                setupTooltip(slot, shop.name, [
                    `Slot: ${shop.slot}`,
                    `Material: ${shop.material}`
                ]);
            }
        }
        
        grid.appendChild(slot);
    }
}

function updatePurchasePreview() {
    const grid = document.getElementById('preview-grid');
    if (!grid) return;
    grid.innerHTML = '';
    updatePreviewParityLabel();

    // Handle paging visibility
    updatePaginationVisibility();

    const settings = transactionSettings.purchase;
    const titleElement = document.getElementById('preview-title');
    const titleInput = document.getElementById('preview-title-input');
    if (titleElement) titleElement.innerHTML = parseMinecraftColors(settings.titlePrefix + 'Item');
    if (titleInput) titleInput.value = settings.titlePrefix;

    for (let i = 0; i < 54; i++) {
        const slot = document.createElement('div');
        slot.className = 'gui-slot';
        slot.dataset.slotIndex = i;

        // Drag and drop listeners
        slot.ondragover = handleDragOver;
        slot.ondragenter = handleDragEnter;
        slot.ondragleave = handleDragLeave;
        slot.ondragend = handleDragEnd;
        slot.ondrop = (e) => handleDrop(e, i, 'purchase');
        
        // Handle static buttons
        Object.entries(settings.buttons).forEach(([key, btn]) => {
            if (btn.slot === i) {
                slot.draggable = true;
                slot.ondragstart = (e) => handleDragStart(e, i, 'purchase');
                slot.classList.add('filled');

                slot.innerHTML = `<div class="item-icon"><img src="${TEXTURE_API}${btn.material.toLowerCase()}.png"></div>`;
                slot.onclick = () => openTransactionButtonModal('purchase', 'main', key);
                if (previewParityMode) {
                    setupTooltip(slot, btn.name, (btn.lore && btn.lore.length > 0) ? btn.lore : [`Slot: ${btn.slot}`, `Material: ${btn.material}`]);
                } else {
                    setupTooltip(slot, btn.name, [`Slot: ${btn.slot}`, `Material: ${btn.material}`]);
                }
            }
        });

        // Handle amount buttons
        ['add', 'remove', 'set'].forEach(group => {
            Object.entries(settings[group].buttons).forEach(([amount, btn]) => {
                if (btn.slot === i) {
                    slot.draggable = true;
                    slot.ondragstart = (e) => handleDragStart(e, i, 'purchase');
                    slot.classList.add('filled');

                    slot.innerHTML = `<div class="item-icon"><img src="${TEXTURE_API}${settings[group].material.toLowerCase()}.png"></div>`;
                    slot.innerHTML += `<div class="slot-amount">${amount}</div>`;
                    slot.onclick = () => openTransactionButtonModal('purchase', group, amount);
                    if (previewParityMode) {
                        setupTooltip(slot, btn.name, (btn.lore && btn.lore.length > 0) ? btn.lore : [`Slot: ${btn.slot}`, `Action: ${group.toUpperCase()} ${amount}`]);
                    } else {
                        setupTooltip(slot, btn.name, [`Slot: ${btn.slot}`, `Action: ${group.toUpperCase()} ${amount}`]);
                    }
                }
            });
        });

        // Display item
        if (i === settings.displaySlot) {
            slot.draggable = true;
            slot.ondragstart = (e) => handleDragStart(e, i, 'purchase');
            slot.classList.add('filled');
            slot.style.backgroundColor = 'rgba(255, 165, 0, 0.15)'; // Special color for display slot

            slot.innerHTML = `<div class="item-icon"><img src="${TEXTURE_API}${settings.displayMaterial.toLowerCase()}.png"></div>`;
            slot.onclick = () => openMainTransactionItemModal('purchase');
            if (previewParityMode) {
                setupTooltip(slot, "&eItem Preview", [
                    (guiSettings.itemLore.amountLine || '&eAmount: &7%amount%').replace('%amount%', '1'),
                    (guiSettings.itemLore.totalLine || '&eTotal: &7%total%').replace('%total%', '$0'),
                    '',
                    '&7Click to edit'
                ]);
            } else {
                setupTooltip(slot, "&eItem Preview", ["This is where the", "purchased item appears", "", "&7Click to edit"]);
            }
        }

        grid.appendChild(slot);
    }
}

function updateSellPreview() {
    const grid = document.getElementById('preview-grid');
    if (!grid) return;
    grid.innerHTML = '';
    updatePreviewParityLabel();

    // Handle paging visibility
    updatePaginationVisibility();

    const settings = transactionSettings.sell;
    const titleElement = document.getElementById('preview-title');
    const titleInput = document.getElementById('preview-title-input');
    if (titleElement) titleElement.innerHTML = parseMinecraftColors(settings.titlePrefix + 'Item');
    if (titleInput) titleInput.value = settings.titlePrefix;

    for (let i = 0; i < 54; i++) {
        const slot = document.createElement('div');
        slot.className = 'gui-slot';
        slot.dataset.slotIndex = i;

        // Drag and drop listeners
        slot.ondragover = handleDragOver;
        slot.ondragenter = handleDragEnter;
        slot.ondragleave = handleDragLeave;
        slot.ondragend = handleDragEnd;
        slot.ondrop = (e) => handleDrop(e, i, 'sell');
        
        Object.entries(settings.buttons).forEach(([key, btn]) => {
            if (btn.slot === i) {
                slot.draggable = true;
                slot.ondragstart = (e) => handleDragStart(e, i, 'sell');
                slot.classList.add('filled');

                slot.innerHTML = `<div class="item-icon"><img src="${TEXTURE_API}${btn.material.toLowerCase()}.png"></div>`;
                slot.onclick = () => openTransactionButtonModal('sell', 'main', key);
                if (previewParityMode) {
                    setupTooltip(slot, btn.name, (btn.lore && btn.lore.length > 0) ? btn.lore : [`Slot: ${btn.slot}`, `Material: ${btn.material}`]);
                } else {
                    setupTooltip(slot, btn.name, [`Slot: ${btn.slot}`, `Material: ${btn.material}`]);
                }
            }
        });

        ['add', 'remove', 'set'].forEach(group => {
            Object.entries(settings[group].buttons).forEach(([amount, btn]) => {
                if (btn.slot === i) {
                    slot.draggable = true;
                    slot.ondragstart = (e) => handleDragStart(e, i, 'sell');
                    slot.classList.add('filled');

                    slot.innerHTML = `<div class="item-icon"><img src="${TEXTURE_API}${settings[group].material.toLowerCase()}.png"></div>`;
                    slot.innerHTML += `<div class="slot-amount">${amount}</div>`;
                    slot.onclick = () => openTransactionButtonModal('sell', group, amount);
                    if (previewParityMode) {
                        setupTooltip(slot, btn.name, (btn.lore && btn.lore.length > 0) ? btn.lore : [`Slot: ${btn.slot}`, `Action: ${group.toUpperCase()} ${amount}`]);
                    } else {
                        setupTooltip(slot, btn.name, [`Slot: ${btn.slot}`, `Action: ${group.toUpperCase()} ${amount}`]);
                    }
                }
            });
        });

        if (i === settings.displaySlot) {
            slot.draggable = true;
            slot.ondragstart = (e) => handleDragStart(e, i, 'sell');
            slot.classList.add('filled');
            slot.style.backgroundColor = 'rgba(255, 165, 0, 0.15)'; // Special color for display slot

            slot.innerHTML = `<div class="item-icon"><img src="${TEXTURE_API}${settings.displayMaterial.toLowerCase()}.png"></div>`;
            slot.onclick = () => openMainTransactionItemModal('sell');
            if (previewParityMode) {
                setupTooltip(slot, "&eItem Preview", [
                    (guiSettings.itemLore.amountLine || '&eAmount: &7%amount%').replace('%amount%', '1'),
                    (guiSettings.itemLore.totalLine || '&eTotal: &7%total%').replace('%total%', '$0'),
                    '',
                    '&7Click to edit'
                ]);
            } else {
                setupTooltip(slot, "&eItem Preview", ["This is where the", "sold item appears", "", "&7Click to edit"]);
            }
        }

        grid.appendChild(slot);
    }
}

function renderPurchaseButtons() {
    const container = document.getElementById('purchase-buttons-list');
    if (!container) return;
    container.innerHTML = '';

    // Main buttons
    const mainGroup = document.createElement('div');
    mainGroup.className = 'settings-group card-base';
    mainGroup.style.marginBottom = '2rem';
    mainGroup.innerHTML = `
        <div class="flex justify-between items-center mb-24">
            <h3 class="m-0" style="font-size: 1.1rem; color: #fff;">Main Buttons</h3>
        </div>
        <div class="grid-list" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));"></div>
    `;
    const mainGrid = mainGroup.querySelector('.grid-list');

    // Add Main Item card
    const mainItemEl = document.createElement('div');
    mainItemEl.className = 'shop-item';
    mainItemEl.style.border = '1px solid var(--primary)';
    mainItemEl.style.background = 'rgba(102, 126, 234, 0.1)';
    mainItemEl.onclick = () => openMainTransactionItemModal('purchase');
    mainItemEl.innerHTML = `
        <div class="flex justify-between items-center mb-8">
            <div class="item-title" style="color: var(--primary-light);">MAIN ITEM</div>
            <div class="item-subtitle" style="background: rgba(0,0,0,0.3); padding: 2px 8px; border-radius: 6px;">#${transactionSettings.purchase.displaySlot !== undefined ? transactionSettings.purchase.displaySlot : 22}</div>
        </div>
        <div class="flex items-center gap-12 mb-8">
            <div class="item-icon" style="width: 24px; height: 24px;">
                <img src="${TEXTURE_API}${(transactionSettings.purchase.displayMaterial || 'BARRIER').toLowerCase()}.png">
            </div>
            <div class="item-subtitle" style="overflow: hidden; text-overflow: ellipsis; font-weight: 600;">${transactionSettings.purchase.displayMaterial || 'BARRIER'}</div>
        </div>
        <div class="item-subtitle" style="font-size: 0.75rem; opacity: 0.7;">Material: ${transactionSettings.purchase.displayMaterial || 'BARRIER'}</div>
    `;
    mainGrid.appendChild(mainItemEl);

    Object.entries(transactionSettings.purchase.buttons).forEach(([key, btn]) => {
        const el = document.createElement('div');
        el.className = 'shop-item';
        el.onclick = () => openTransactionButtonModal('purchase', 'main', key);
        
        let loreHtml = '';
        if (btn.lore && btn.lore.length > 0) {
            loreHtml = `<div class="item-lore-preview" style="margin-top: 8px; font-size: 0.75rem; opacity: 0.8; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px;">
                ${btn.lore.slice(0, 3).map(l => `<div>${parseMinecraftColors(l)}</div>`).join('')}
                ${btn.lore.length > 3 ? '<div>...</div>' : ''}
            </div>`;
        }

        el.innerHTML = `
            <div class="flex justify-between items-center mb-8">
                <div class="item-title">${key.toUpperCase()}</div>
                <div class="item-subtitle" style="background: rgba(0,0,0,0.3); padding: 2px 8px; border-radius: 6px;">#${btn.slot}</div>
            </div>
            <div class="flex items-center gap-12 mb-4">
                <div class="item-icon" style="width: 24px; height: 24px;">
                    <img src="${TEXTURE_API}${btn.material.toLowerCase()}.png">
                </div>
                <div class="item-subtitle" style="overflow: hidden; text-overflow: ellipsis; font-weight: 600;">${parseMinecraftColors(btn.name) || 'Default'}</div>
            </div>
            <div class="item-subtitle" style="font-size: 0.75rem; opacity: 0.7;">Material: ${btn.material}</div>
            ${loreHtml}
        `;
        mainGrid.appendChild(el);
    });
    container.appendChild(mainGroup);

    // Amount groups
    const addContainer = document.createElement('div');
    container.appendChild(addContainer);
    renderButtonGroup(addContainer, 'purchase', 'add', 'Add Amount Buttons', '+ Add');

    const removeContainer = document.createElement('div');
    container.appendChild(removeContainer);
    renderButtonGroup(removeContainer, 'purchase', 'remove', 'Remove Amount Buttons', '- Remove');

    const setContainer = document.createElement('div');
    container.appendChild(setContainer);
    renderButtonGroup(setContainer, 'purchase', 'set', 'Set Amount Buttons', '= Set');
}

function renderSellButtons() {
    const container = document.getElementById('sell-buttons-list');
    if (!container) return;
    container.innerHTML = '';

    // Main buttons
    const mainGroup = document.createElement('div');
    mainGroup.className = 'settings-group card-base';
    mainGroup.style.marginBottom = '2rem';
    mainGroup.innerHTML = `
        <div class="flex justify-between items-center mb-24">
            <h3 class="m-0" style="font-size: 1.1rem; color: #fff;">Main Buttons</h3>
        </div>
        <div class="grid-list" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));"></div>
    `;
    const mainGrid = mainGroup.querySelector('.grid-list');

    // Add Main Item card
    const mainItemEl = document.createElement('div');
    mainItemEl.className = 'shop-item';
    mainItemEl.style.border = '1px solid var(--primary)';
    mainItemEl.style.background = 'rgba(102, 126, 234, 0.1)';
    mainItemEl.onclick = () => openMainTransactionItemModal('sell');
    mainItemEl.innerHTML = `
        <div class="flex justify-between items-center mb-8">
            <div class="item-title" style="color: var(--primary-light);">MAIN ITEM</div>
            <div class="item-subtitle" style="background: rgba(0,0,0,0.3); padding: 2px 8px; border-radius: 6px;">#${transactionSettings.sell.displaySlot !== undefined ? transactionSettings.sell.displaySlot : 22}</div>
        </div>
        <div class="flex items-center gap-12 mb-8">
            <div class="item-icon" style="width: 24px; height: 24px;">
                <img src="${TEXTURE_API}${(transactionSettings.sell.displayMaterial || 'BARRIER').toLowerCase()}.png">
            </div>
            <div class="item-subtitle" style="overflow: hidden; text-overflow: ellipsis; font-weight: 600;">${transactionSettings.sell.displayMaterial || 'BARRIER'}</div>
        </div>
        <div class="item-subtitle" style="font-size: 0.75rem; opacity: 0.7;">Material: ${transactionSettings.sell.displayMaterial || 'BARRIER'}</div>
    `;
    mainGrid.appendChild(mainItemEl);

    Object.entries(transactionSettings.sell.buttons).forEach(([key, btn]) => {
        const el = document.createElement('div');
        el.className = 'shop-item';
        el.onclick = () => openTransactionButtonModal('sell', 'main', key);
        
        let loreHtml = '';
        if (btn.lore && btn.lore.length > 0) {
            loreHtml = `<div class="item-lore-preview" style="margin-top: 8px; font-size: 0.75rem; opacity: 0.8; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 4px;">
                ${btn.lore.slice(0, 3).map(l => `<div>${parseMinecraftColors(l)}</div>`).join('')}
                ${btn.lore.length > 3 ? '<div>...</div>' : ''}
            </div>`;
        }

        el.innerHTML = `
            <div class="flex justify-between items-center mb-8">
                <div class="item-title">${key.toUpperCase()}</div>
                <div class="item-subtitle" style="background: rgba(0,0,0,0.3); padding: 2px 8px; border-radius: 6px;">#${btn.slot}</div>
            </div>
            <div class="flex items-center gap-12 mb-4">
                <div class="item-icon" style="width: 24px; height: 24px;">
                    <img src="${TEXTURE_API}${btn.material.toLowerCase()}.png">
                </div>
                <div class="item-subtitle" style="overflow: hidden; text-overflow: ellipsis; font-weight: 600;">${parseMinecraftColors(btn.name) || 'Default'}</div>
            </div>
            <div class="item-subtitle" style="font-size: 0.75rem; opacity: 0.7;">Material: ${btn.material}</div>
            ${loreHtml}
        `;
        mainGrid.appendChild(el);
    });
    container.appendChild(mainGroup);

    // Amount groups
    const addContainer = document.createElement('div');
    container.appendChild(addContainer);
    renderButtonGroup(addContainer, 'sell', 'add', 'Add Amount Buttons', '+ Add');

    const removeContainer = document.createElement('div');
    container.appendChild(removeContainer);
    renderButtonGroup(removeContainer, 'sell', 'remove', 'Remove Amount Buttons', '- Remove');

    const setContainer = document.createElement('div');
    container.appendChild(setContainer);
    renderButtonGroup(setContainer, 'sell', 'set', 'Set Amount Buttons', '= Set');
}


function updateItem(id, field, value) {
    const item = items.find(i => i.id === id);
    if (item) {
        item[field] = value;
        renderItems();
        updateAll();
    }
}

function removeItem(id) {
    const index = items.findIndex(i => i.id === id);
    if (index !== -1) {
        const item = items[index];
        const beforeData = JSON.parse(JSON.stringify(item));
        items.splice(index, 1);
        renderItems();
        updateAll();
        
        addActivityEntry('deleted', 'shop-item', beforeData, null, {
            shopFile: currentShopFile
        });
    }
}

function removeMainMenuShop(index) {
    if (index >= 0 && index < loadedGuiShops.length) {
        const shop = loadedGuiShops[index];
        const beforeData = JSON.parse(JSON.stringify(shop));
        loadedGuiShops.splice(index, 1);
        renderMainMenuShops();
        updateGuiPreview();
        scheduleAutoSave();
        
        addActivityEntry('deleted', 'main-menu-button', beforeData, null);
    }
}

function formatDatabaseTimestamp(epochMillis) {
    const value = Number(epochMillis) || 0;
    if (value <= 0) return 'Never';
    try {
        return new Date(value).toLocaleString();
    } catch (e) {
        return String(value);
    }
}

function renderDatabaseEditor() {
    const generatedEl = document.getElementById('data-editor-generated');
    const summaryEl = document.getElementById('data-editor-summary');
    const sectionsEl = document.getElementById('data-editor-sections');
    if (!summaryEl || !sectionsEl) return;

    const data = databaseEditorData || { totals: {}, playerCounts: [], globalCounts: [], stockResets: [] };
    const totals = data.totals || {};
    if (generatedEl) {
        const generatedAt = data.generatedAt ? new Date(data.generatedAt).toLocaleString() : 'No data yet';
        generatedEl.textContent = `Updated: ${generatedAt}`;
    }

    summaryEl.innerHTML = `
        <div class="stock-card">
            <div class="stock-card-label">Player Limits</div>
            <div class="stock-card-value">${totals.playerCounts || 0}</div>
        </div>
        <div class="stock-card">
            <div class="stock-card-label">Global Stock Rows</div>
            <div class="stock-card-value">${totals.globalCounts || 0}</div>
        </div>
        <div class="stock-card">
            <div class="stock-card-label">Stock Reset Rows</div>
            <div class="stock-card-value">${totals.stockResets || 0}</div>
        </div>
    `;

    const playerRows = Array.isArray(data.playerCounts) ? data.playerCounts : [];
    const globalRows = Array.isArray(data.globalCounts) ? data.globalCounts : [];
    const stockRows = Array.isArray(data.stockResets) ? data.stockResets : [];

    sectionsEl.innerHTML = `
        <div class="settings-group card-base" style="margin-bottom: 14px;">
            <div class="flex justify-between items-center mb-12">
                <h3 class="m-0">Player Counts (player limits)</h3>
                <button class="btn btn-primary" style="padding: 8px 12px;" onclick="addPlayerCountRow()">ADD ROW</button>
            </div>
            ${renderDatabasePlayerTable(playerRows)}
        </div>
        <div class="settings-group card-base" style="margin-bottom: 14px;">
            <div class="flex justify-between items-center mb-12">
                <h3 class="m-0">Global Counts (shared stock)</h3>
                <button class="btn btn-primary" style="padding: 8px 12px;" onclick="addGlobalCountRow()">ADD ROW</button>
            </div>
            ${renderDatabaseGlobalTable(globalRows)}
        </div>
        <div class="settings-group card-base">
            <div class="flex justify-between items-center mb-12">
                <h3 class="m-0">Stock Resets (last run)</h3>
                <button class="btn btn-primary" style="padding: 8px 12px;" onclick="addStockResetRow()">ADD ROW</button>
            </div>
            ${renderDatabaseStockTable(stockRows)}
        </div>
    `;
}

function renderDatabasePlayerTable(rows) {
    if (!rows.length) return `<div class="stock-item-sub">No player count rows.</div>`;
    const body = rows.map((row, index) => `
        <div class="data-editor-row data-editor-player">
            <input id="player-uuid-${index}" class="input-base data-editor-input" value="${escapeHtml(row.uuid || '')}" placeholder="Player UUID">
            <input id="player-item-${index}" class="input-base data-editor-input" value="${escapeHtml(row.itemKey || '')}" placeholder="Item Key">
            <input id="player-count-${index}" class="input-base data-editor-input" type="number" min="0" value="${Number(row.count) || 0}">
            <div class="data-editor-actions">
                <button class="btn btn-secondary" onclick="savePlayerCountRow(${index})">SAVE</button>
                <button class="btn btn-danger" onclick="deletePlayerCountRow(${index})">DELETE</button>
            </div>
        </div>
    `).join('');
    return `<div class="data-editor-table">${body}</div>`;
}

function renderDatabaseGlobalTable(rows) {
    if (!rows.length) return `<div class="stock-item-sub">No global count rows.</div>`;
    const body = rows.map((row, index) => `
        <div class="data-editor-row data-editor-global">
            <input id="global-item-${index}" class="input-base data-editor-input" value="${escapeHtml(row.itemKey || '')}" placeholder="Item Key">
            <input id="global-count-${index}" class="input-base data-editor-input" type="number" min="0" value="${Number(row.count) || 0}">
            <div class="data-editor-actions">
                <button class="btn btn-secondary" onclick="saveGlobalCountRow(${index})">SAVE</button>
                <button class="btn btn-danger" onclick="deleteGlobalCountRow(${index})">DELETE</button>
            </div>
        </div>
    `).join('');
    return `<div class="data-editor-table">${body}</div>`;
}

function renderDatabaseStockTable(rows) {
    if (!rows.length) return `<div class="stock-item-sub">No stock reset rows.</div>`;
    const body = rows.map((row, index) => `
        <div class="data-editor-row data-editor-stock">
            <input id="stock-stored-${index}" class="input-base data-editor-input" value="${escapeHtml(row.storedResetId || '')}" placeholder="Stored Reset ID">
            <input id="stock-lastrun-${index}" class="input-base data-editor-input" type="number" min="0" value="${Number(row.lastRun) || 0}">
            <div class="stock-item-sub">${escapeHtml(row.resetId || '')}<br>${escapeHtml(formatDatabaseTimestamp(row.lastRun))}</div>
            <div class="data-editor-actions">
                <button class="btn btn-secondary" onclick="saveStockResetRow(${index})">SAVE</button>
                <button class="btn btn-danger" onclick="deleteStockResetRow(${index})">DELETE</button>
            </div>
        </div>
    `).join('');
    return `<div class="data-editor-table">${body}</div>`;
}

async function savePlayerCountRow(index) {
    const uuid = document.getElementById(`player-uuid-${index}`)?.value?.trim();
    const itemKey = document.getElementById(`player-item-${index}`)?.value?.trim();
    const count = Math.max(0, parseInt(document.getElementById(`player-count-${index}`)?.value || '0', 10) || 0);
    if (!uuid || !itemKey) {
        showAlert('Player UUID and Item Key are required.', 'warning');
        return;
    }
    try {
        await saveDatabaseEntry('player_counts', { uuid, itemKey, count });
        renderDatabaseEditor();
        showToast('Player count row saved', 'success');
    } catch (error) {
        showAlert(`Failed to save row: ${error.message}`, 'error');
    }
}

async function deletePlayerCountRow(index) {
    const uuid = document.getElementById(`player-uuid-${index}`)?.value?.trim();
    const itemKey = document.getElementById(`player-item-${index}`)?.value?.trim();
    if (!uuid || !itemKey) return;
    const confirmed = await showConfirm(`Delete player count row for ${uuid} / ${itemKey}?`);
    if (!confirmed) return;
    try {
        await deleteDatabaseEntry('player_counts', { uuid, itemKey });
        renderDatabaseEditor();
        showToast('Player count row deleted', 'success');
    } catch (error) {
        showAlert(`Failed to delete row: ${error.message}`, 'error');
    }
}

async function saveGlobalCountRow(index) {
    const itemKey = document.getElementById(`global-item-${index}`)?.value?.trim();
    const count = Math.max(0, parseInt(document.getElementById(`global-count-${index}`)?.value || '0', 10) || 0);
    if (!itemKey) {
        showAlert('Item Key is required.', 'warning');
        return;
    }
    try {
        await saveDatabaseEntry('global_counts', { itemKey, count });
        renderDatabaseEditor();
        showToast('Global count row saved', 'success');
    } catch (error) {
        showAlert(`Failed to save row: ${error.message}`, 'error');
    }
}

async function deleteGlobalCountRow(index) {
    const itemKey = document.getElementById(`global-item-${index}`)?.value?.trim();
    if (!itemKey) return;
    const confirmed = await showConfirm(`Delete global count row for ${itemKey}?`);
    if (!confirmed) return;
    try {
        await deleteDatabaseEntry('global_counts', { itemKey });
        renderDatabaseEditor();
        showToast('Global count row deleted', 'success');
    } catch (error) {
        showAlert(`Failed to delete row: ${error.message}`, 'error');
    }
}

async function saveStockResetRow(index) {
    const storedResetId = document.getElementById(`stock-stored-${index}`)?.value?.trim();
    const lastRun = Math.max(0, parseInt(document.getElementById(`stock-lastrun-${index}`)?.value || '0', 10) || 0);
    if (!storedResetId) {
        showAlert('Stored Reset ID is required.', 'warning');
        return;
    }
    try {
        await saveDatabaseEntry('stock_resets', { storedResetId, lastRun });
        renderDatabaseEditor();
        showToast('Stock reset row saved', 'success');
    } catch (error) {
        showAlert(`Failed to save row: ${error.message}`, 'error');
    }
}

async function deleteStockResetRow(index) {
    const storedResetId = document.getElementById(`stock-stored-${index}`)?.value?.trim();
    if (!storedResetId) return;
    const confirmed = await showConfirm(`Delete stock reset row ${storedResetId}?`);
    if (!confirmed) return;
    try {
        await deleteDatabaseEntry('stock_resets', { storedResetId });
        renderDatabaseEditor();
        showToast('Stock reset row deleted', 'success');
    } catch (error) {
        showAlert(`Failed to delete row: ${error.message}`, 'error');
    }
}

async function addPlayerCountRow() {
    const uuid = await showPrompt('Player UUID:', '', 'Add Player Count');
    if (!uuid) return;
    const itemKey = await showPrompt('Item Key:', '', 'Add Player Count');
    if (!itemKey) return;
    const countRaw = await showPrompt('Count:', '0', 'Add Player Count');
    if (countRaw === null) return;
    const count = Math.max(0, parseInt(countRaw, 10) || 0);
    try {
        await saveDatabaseEntry('player_counts', { uuid: uuid.trim(), itemKey: itemKey.trim(), count });
        renderDatabaseEditor();
        showToast('Player count row added', 'success');
    } catch (error) {
        showAlert(`Failed to add row: ${error.message}`, 'error');
    }
}

async function addGlobalCountRow() {
    const itemKey = await showPrompt('Item Key:', '', 'Add Global Count');
    if (!itemKey) return;
    const countRaw = await showPrompt('Count:', '0', 'Add Global Count');
    if (countRaw === null) return;
    const count = Math.max(0, parseInt(countRaw, 10) || 0);
    try {
        await saveDatabaseEntry('global_counts', { itemKey: itemKey.trim(), count });
        renderDatabaseEditor();
        showToast('Global count row added', 'success');
    } catch (error) {
        showAlert(`Failed to add row: ${error.message}`, 'error');
    }
}

async function addStockResetRow() {
    const storedResetId = await showPrompt('Stored Reset ID (usually base64 key):', '', 'Add Stock Reset');
    if (!storedResetId) return;
    const lastRunRaw = await showPrompt('Last Run Epoch Millis:', '0', 'Add Stock Reset');
    if (lastRunRaw === null) return;
    const lastRun = Math.max(0, parseInt(lastRunRaw, 10) || 0);
    try {
        await saveDatabaseEntry('stock_resets', { storedResetId: storedResetId.trim(), lastRun });
        renderDatabaseEditor();
        showToast('Stock reset row added', 'success');
    } catch (error) {
        showAlert(`Failed to add row: ${error.message}`, 'error');
    }
}
