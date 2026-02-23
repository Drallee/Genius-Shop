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
    loadActivityLog();
    await loadAllFiles();
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
        headTexture: '',
        headOwner: '',
        price: 100,
        sellPrice: 50,
        amount: 1,
        lore: [t('web-editor.new-item-lore', '&7Added via web editor')],
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
    if (isLoadingFiles) return;
    if (localStorage.getItem('autoSaveEnabled') === 'false') return;

    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        if (currentTab === 'shop') {
            saveCurrentShop();
        } else if (currentTab === 'mainmenu') {
            saveMainMenuYaml();
        } else if (currentTab === 'purchase') {
            savePurchaseMenuYaml();
        } else if (currentTab === 'sell') {
            saveSellMenuYaml();
        } else if (currentTab === 'guisettings') {
            saveGuiSettingsYaml();
        }
    }, 2000);
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

