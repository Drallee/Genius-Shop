// ===== EVENT LISTENERS & HANDLERS =====

document.addEventListener('DOMContentLoaded', async function() {
    console.log('[SHOP EDITOR] DOM Content Loaded');

    // Setup animations toggle
    const animationsToggle = document.getElementById('animations-toggle');
    const animationsToggleMobile = document.getElementById('animations-toggle-mobile');
    if (animationsToggle) {
        animationsToggle.checked = animationsEnabled;
        if (animationsToggleMobile) animationsToggleMobile.checked = animationsEnabled;
        if (!animationsEnabled) {
            document.body.classList.add('no-animations');
        }
        animationsToggle.addEventListener('change', toggleAnimations);
    }

    // Setup auto-save toggle
    const autoSaveToggle = document.getElementById('auto-save-toggle');
    const autoSaveToggleMobile = document.getElementById('auto-save-toggle-mobile');
    if (autoSaveToggle) {
        autoSaveToggle.checked = autoSaveEnabled;
        if (autoSaveToggleMobile) autoSaveToggleMobile.checked = autoSaveEnabled;
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

    // Setup user info display
    const userInfo = document.getElementById('user-info');
    if (userInfo) {
        userInfo.className = 'user-badge';
        userInfo.innerHTML = `
            <img src="https://mc-heads.net/avatar/${username}/24" alt="${username}" class="user-avatar" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
            <span style="display: none;">👤</span>
            <span class="status-dot"></span>
            <span>${username}</span>
        `;
    }

    // Setup event listeners for inputs
    setupInputListeners();
    setupMobileSync();
});

function setupInputListeners() {
    // Input search
    const itemSearch = document.getElementById('item-search');
    if (itemSearch) {
        itemSearch.addEventListener('input', debounce(handleItemSearch, 300));
    }
}

function addItem() {
    const newItem = {
        id: itemIdCounter++,
        material: 'STONE',
        name: '&eNew Item',
        price: 100,
        sellPrice: 50,
        amount: 1,
        lore: ['&7Added via web editor'],
        enchantments: {},
        hideAttributes: false,
        hideAdditional: false,
        requireName: false,
        requireLore: false,
        unstableTnt: false
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
        name: '&eNew Shop',
        lore: ['&7Click to open'],
        shopKey: 'misc',
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

// Mobile menu and toggle sync logic
function setupMobileSync() {
    const animationsToggle = document.getElementById('animations-toggle');
    const animationsToggleMobile = document.getElementById('animations-toggle-mobile');
    const autoSaveToggle = document.getElementById('auto-save-toggle');
    const autoSaveToggleMobile = document.getElementById('auto-save-toggle-mobile');

    if (animationsToggle && animationsToggleMobile) {
        animationsToggle.addEventListener('change', () => {
            animationsToggleMobile.checked = animationsToggle.checked;
        });
        animationsToggleMobile.addEventListener('change', () => {
            animationsToggle.checked = animationsToggleMobile.checked;
            toggleAnimations();
        });
    }

    if (autoSaveToggle && autoSaveToggleMobile) {
        autoSaveToggle.addEventListener('change', () => {
            autoSaveToggleMobile.checked = autoSaveToggle.checked;
        });
        autoSaveToggleMobile.addEventListener('change', () => {
            autoSaveToggle.checked = autoSaveToggleMobile.checked;
            toggleAutoSave();
        });
    }
}
