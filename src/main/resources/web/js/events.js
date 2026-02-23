// ===== EVENT LISTENERS & HANDLERS =====

document.addEventListener('DOMContentLoaded', async function() {
    console.log('[SHOP EDITOR] DOM Content Loaded');

    // Setup animations toggle
    const animationsToggle = document.getElementById('animations-toggle');
    if (animationsToggle) {
        animationsToggle.checked = animationsEnabled;
        if (!animationsEnabled) {
            document.body.classList.add('no-animations');
        }
        animationsToggle.addEventListener('change', toggleAnimations);
    }

    // Setup auto-save toggle
    const autoSaveToggle = document.getElementById('auto-save-toggle');
    if (autoSaveToggle) {
        autoSaveToggle.checked = autoSaveEnabled;
        autoSaveToggle.addEventListener('change', toggleAutoSave);
    }

    // Check for auto-login token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const autoLoginToken = urlParams.get('token');

    if (autoLoginToken) {
        handleAutoLogin(autoLoginToken);
        return;
    }

    // Check if logged in
    if (!sessionToken) {
        window.location.href = 'login.html';
        return;
    }

    // Initial load
    await loadActivityLog();
    await loadAllFiles();
    if (typeof updateQuickTips === 'function') {
        updateQuickTips(currentTab || 'mainmenu');
    }
    if (typeof initCustomSelects === 'function') {
        initCustomSelects();
    }

    // Setup user info display
    const userInfo = document.getElementById('user-info');
    if (userInfo) {
        userInfo.innerHTML = `
            <img src="https://mc-heads.net/avatar/${username}/24" alt="${username}" class="user-avatar" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
            <span style="display: none;">👤</span>
            <span class="status-dot"></span>
            <span>${username}</span>
            <span style="margin-left: 8px; font-size: 0.8em; opacity: 0.7;">▼</span>
        `;
    }

    // Setup event listeners for inputs
    setupInputListeners();
    setupKeyboardShortcuts();
});

function setupInputListeners() {
    // Input search
    const itemSearch = document.getElementById('item-search');
    if (itemSearch) {
        itemSearch.addEventListener('input', debounce(handleItemSearch, 300));
    }
}

function addItem() {
    // Find first free slot
    const occupiedSlots = new Set(items.map(it => it.slot));
    let slot = 0;
    while (occupiedSlots.has(slot)) slot++;

    const newItem = {
        id: itemIdCounter++,
        material: 'STONE',
        name: t('web-editor.new-item-name', '&eNew Item'),
        itemKey: '',
        variantKey: '',
        headTexture: '',
        headOwner: '',
        itemStack: '',
        price: 100,
        sellPrice: 50,
        buyPricePerItem: true,
        sellPricePerItem: true,
        campaignEnabled: false,
        campaign: '',
        campaignName: '',
        campaignStart: '',
        campaignEnd: '',
        campaignTimezone: '',
        campaignBuyMultiplier: 1,
        campaignSellMultiplier: 1,
        amount: 1,
        lore: [t('web-editor.new-item-lore', '&7Added via web editor')],
        enchantments: {},
        hideAttributes: false,
        hideAdditional: false,
        requireName: false,
        requireLore: false,
        unstableTnt: false,
        dynamicPricing: false,
        minPrice: 0,
        maxPrice: 0,
        priceChange: 0,
        buyPriceFormula: '',
        sellPriceFormula: '',
        spawnerType: null,
        spawnerItem: null,
        potionType: null,
        potionLevel: 0,
        commands: [],
        runAs: 'console',
        minPlayerLevel: 0,
        maxPlayerLevel: 0,
        requiredGamemode: '',
        allowedWorlds: [],
        deniedWorlds: [],
        stockResetRule: createDefaultStockResetRule(),
        showStock: false,
        showStockResetTimer: false,
        runCommandOnly: true,
        permission: '',
        slot: slot
    };
    items.push(newItem);
    renderItems();
    updateAll();
    
    addActivityEntry('created', 'shop-item', null, JSON.parse(JSON.stringify(newItem)), {
        shopFile: currentShopFile
    });
}

function addMainMenuShop() {
    const key = 'new_shop_' + Date.now().toString().slice(-4);
    const newShop = {
        key: key,
        slot: loadedGuiShops.length > 0 ? Math.max(...loadedGuiShops.map(s => s.slot)) + 1 : 0,
        material: 'CHEST',
        name: t('web-editor.new-shop-name', '&eNew Shop'),
        lore: [t('web-editor.click-to-open', '&7Click to open')],
        action: 'shop-key',
        shopKey: 'misc',
        commands: [],
        runAs: 'player',
        permission: '',
        hideAttributes: false,
        hideAdditional: false
    };
    loadedGuiShops.push(newShop);
    renderMainMenuShops();
    updateGuiPreview();
    scheduleAutoSave();

    addActivityEntry('created', 'main-menu-button', null, JSON.parse(JSON.stringify(newShop)));
}

function scheduleAutoSave() {
    return window.scheduleEditorAutoSave();
}

function isTypingTarget(target) {
    if (!target) return false;
    const tag = (target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    return !!target.closest?.('[contenteditable="true"], .modal, .CodeMirror');
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', async (e) => {
        if (!sessionToken || isTypingTarget(e.target)) return;

        const key = (e.key || '').toLowerCase();
        const mod = e.ctrlKey || e.metaKey;

        if (mod && key === 's' && !e.shiftKey) {
            e.preventDefault();
            if (window.EditorTelemetry) window.EditorTelemetry.track('shortcut_used', { shortcut: 'save_tab' }, true);
            openSaveConfirmationModal('tab');
            return;
        }

        if (mod && key === 's' && e.shiftKey) {
            e.preventDefault();
            if (window.EditorTelemetry) window.EditorTelemetry.track('shortcut_used', { shortcut: 'publish_all' }, true);
            openSaveConfirmationModal('publish');
            return;
        }

        if (mod && key === 'f') {
            e.preventDefault();
            if (window.EditorTelemetry) window.EditorTelemetry.track('shortcut_used', { shortcut: 'focus_search' }, true);
            const itemSearch = document.getElementById('item-search');
            if (itemSearch) {
                itemSearch.focus();
                itemSearch.select?.();
            }
            return;
        }

        if (key === 'escape') {
            const activityDetail = document.getElementById('activity-detail-modal');
            const activityLog = document.getElementById('activity-log-modal');
            const saveConfirm = document.getElementById('save-confirmation-modal');
            if (activityDetail && activityDetail.style.display === 'flex') return closeActivityDetailModal();
            if (activityLog && activityLog.style.display === 'flex') return closeActivityLogModal();
            if (saveConfirm && saveConfirm.style.display === 'flex') return closeSaveConfirmationModal();
        }
    });
}

function manualSave() {
    openSaveConfirmationModal();
}

function updateTransactionSettings() {
    if (currentTab === 'purchase') {
        renderPurchaseButtons();
        updatePurchasePreview();
    } else if (currentTab === 'sell') {
        renderSellButtons();
        updateSellPreview();
    }
}

