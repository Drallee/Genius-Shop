// ===== CORE STATE & UTILITIES =====

let items = [];
let itemIdCounter = 0;
let loadedGuiShops = []; // Store all shops from gui.yml
let originalGuiYaml = ''; // Store original gui.yml to preserve structure
let isLoadingFiles = true; // Flag to prevent saving during initial load

// Activity log storage
let activityLog = [];
const ACTIVITY_LOG_KEY = 'shop-activity-log';
let currentViewedEntry = null; // Track the entry being viewed for rollback
let activeSaveMode = 'tab'; // 'tab' or 'publish'
let unsavedChanges = []; // Track changes since last save

// API Configuration - dynamically determine based on how page was accessed
const API_URL = `${window.location.protocol}//${window.location.host}`;
let sessionToken = localStorage.getItem('sessionToken');
let username = localStorage.getItem('username');
let currentUsername = username; // For activity log

let currentShopFile = 'blocks.yml'; // Current shop being edited
let currentTab = 'mainmenu'; // Track current active tab
let allShops = {}; // Store all loaded shops
let autoSaveTimeout = null;
let isSaving = false;
let currentPreviewPage = 0; // Current page being previewed
let itemSearchQuery = ''; // Filter for items list

// Drag and drop state
let draggedSlotIndex = null;
let draggedItemSource = null; // 'shop' or 'mainmenu'
let draggedFromPage = null;
let pageFlipTimeout = null;

// Current Shop Metadata State
let currentShopSettings = {
    guiName: '&8Shop',
    rows: 3,
    permission: '',
    availableTimes: ''
};

let guiSettings = {
    backButton: { name: '&9Back', lore: [] },
    prevButton: { name: '&e<- Previous', lore: [] },
    nextButton: { name: '&eNext ->', lore: [] },
    itemLore: {
        showBuyPrice: true,
        buyPriceLine: '&6Buy Price: &a%price%',
        showSellPrice: true,
        sellPriceLine: '&cSell Price: &a%sell-price%',
        showBuyHint: true,
        buyHintLine: '&eLeft-click to buy',
        showSellHint: true,
        sellHintLine: '&aRight-click to sell',
        amountLine: '&eAmount: &7%amount%',
        totalLine: '&eTotal: &7%total%'
    }
};

let mainMenuSettings = {
    title: '&8Shop Menu',
    rows: 3
};

// Modal state
let currentModalData = null;

// Minecraft texture API base URL
const TEXTURE_API = 'https://mc.nerothe.com/img/1.21.8/minecraft_';

// Initialize animations toggle from localStorage
const animationsEnabled = localStorage.getItem('animationsEnabled') !== 'false'; // default true
const autoSaveEnabled = localStorage.getItem('autoSaveEnabled') !== 'false'; // default true

// Transaction settings
let transactionSettings = {
    purchase: {
        displayMaterial: 'BOOK',
        titlePrefix: '&8Buying ',
        displaySlot: 22,
        maxAmount: 2304,
        lore: {
            amount: '&eAmount: &7',
            total: '&eTotal: &7',
            spawner: '&7Spawner: &e'
        },
        buttons: {
            confirm: { material: 'LIME_STAINED_GLASS', name: '&aCONFIRM PURCHASE', slot: 39 },
            cancel: { material: 'RED_STAINED_GLASS', name: '&cCancel', slot: 41 },
            back: { material: 'ENDER_CHEST', name: '&9Back', slot: 40 }
        },
        add: {
            material: 'LIME_STAINED_GLASS_PANE',
            buttons: {
                '1': { name: '&aAdd 1', slot: 24 },
                '10': { name: '&aAdd 10', slot: 25 }
            }
        },
        remove: {
            material: 'RED_STAINED_GLASS_PANE',
            buttons: {
                '1': { name: '&cRemove 1', slot: 20 },
                '10': { name: '&cRemove 10', slot: 19 }
            }
        },
        set: {
            material: 'YELLOW_STAINED_GLASS_PANE',
            buttons: {
                '64': { name: '&aSet to 64', slot: 26 },
                '1': { name: '&cSet to 1', slot: 18 }
            }
        }
    },
    sell: {
        displayMaterial: 'BOOK',
        titlePrefix: '&8Selling ',
        displaySlot: 22,
        maxAmount: 2304,
        lore: {
            amount: '&eAmount: &7',
            total: '&eTotal: &7'
        },
        buttons: {
            confirm: { material: 'LIME_STAINED_GLASS', name: '&aCONFIRM SELL', slot: 48 },
            sellAll: { material: 'GOLD_BLOCK', name: '&6SELL ALL', slot: 40 },
            cancel: { material: 'RED_STAINED_GLASS', name: '&cCancel', slot: 50 },
            back: { material: 'ENDER_CHEST', name: '&9Back', slot: 49 }
        },
        add: {
            material: 'LIME_STAINED_GLASS_PANE',
            buttons: {
                '1': { name: '&aAdd 1', slot: 24 },
                '10': { name: '&aAdd 10', slot: 25 }
            }
        },
        remove: {
            material: 'RED_STAINED_GLASS_PANE',
            buttons: {
                '1': { name: '&cRemove 1', slot: 20 },
                '10': { name: '&cRemove 10', slot: 19 }
            }
        },
        set: {
            material: 'YELLOW_STAINED_GLASS_PANE',
            buttons: {
                '64': { name: '&aSet to 64', slot: 26 },
                '1': { name: '&cSet to 1', slot: 18 }
            }
        }
    }
};

// Utilities
function updateSaveStatus(message, color = '#aaa') {
    const status = document.getElementById('save-status');
    if (status) {
        status.textContent = message;
        status.style.color = color;
    }
}

function loadActivityLog() {
    try {
        const saved = localStorage.getItem(ACTIVITY_LOG_KEY);
        if (saved) {
            activityLog = JSON.parse(saved);
        }
    } catch (e) {
        console.error('Failed to load activity log:', e);
        activityLog = [];
    }
}

function saveActivityLog() {
    try {
        localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(activityLog));
    } catch (e) {
        console.error('Failed to save activity log:', e);
    }
}

function clearActivityLog() {
    activityLog = [];
    saveActivityLog();
    refreshActivityLog();
    showToast('Activity log cleared', 'success');
}

function addActivityEntry(action, target, beforeData, afterData, details = {}) {
    const entry = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        username: currentUsername || 'Unknown',
        action: action, // 'created', 'updated', 'deleted'
        target: target, // 'shop-item', 'main-menu-button', 'purchase-menu', 'sell-menu', 'shop-file'
        beforeData: beforeData,
        afterData: afterData,
        details: details
    };
    activityLog.unshift(entry); // Add to beginning

    // Keep only last 100 entries
    if (activityLog.length > 100) {
        activityLog = activityLog.slice(0, 100);
    }

    saveActivityLog();

    // Track as unsaved change
    unsavedChanges.push({
        action: action,
        target: target,
        description: getActivitySummary(entry),
        details: details
    });
}

function getActivitySummary(entry) {
    if (!entry || !entry.action) return 'Unknown Action';

    const targetNames = {
        'shop-item': 'Shop Item',
        'main-menu-button': 'Main Menu Button',
        'purchase-menu-button': 'Purchase Button',
        'sell-menu-button': 'Sell Button',
        'purchase-menu-settings': 'Purchase Menu Settings',
        'sell-menu-settings': 'Sell Menu Settings',
        'main-menu-settings': 'Main Menu Settings',
        'shop-settings': 'Shop Settings',
        'gui-settings': 'GUI Settings'
    };

    const stripColors = (text) => {
        if (!text) return '';
        return text.toString().replace(/&[0-9a-fk-or]/gi, '').replace(/&#[0-9a-fA-F]{6}/gi, '');
    };

    const getDisplayName = (data) => {
        if (!data) return '';
        return data.name || data.material || data.key || data.title || data.guiName || '';
    };

    if (entry.details && entry.details.isSwap && Array.isArray(entry.afterData)) {
        const name1 = stripColors(getDisplayName(entry.afterData[0]));
        const name2 = stripColors(getDisplayName(entry.afterData[1]));
        const rollbackSuffix = entry.details.isRollback ? ' (Rollback)' : '';
        return `Swapped ${name1} and ${name2}${rollbackSuffix}`;
    }
    
    let name = '';
    if (entry.afterData) {
        if (Array.isArray(entry.afterData)) {
            name = entry.afterData.length + ' items';
        } else {
            name = getDisplayName(entry.afterData);
        }
    } else if (entry.beforeData) {
        if (Array.isArray(entry.beforeData)) {
            name = entry.beforeData.length + ' items';
        } else {
            name = getDisplayName(entry.beforeData);
        }
    }

    name = stripColors(name);

    const actionText = entry.action.charAt(0).toUpperCase() + entry.action.slice(1);
    const targetText = targetNames[entry.target] || entry.target;
    const rollbackSuffix = entry.details && entry.details.isRollback ? ' (Rollback)' : '';

    return `${actionText} ${targetText} ${name}${rollbackSuffix}`.trim();
}

function toggleAnimations() {
    const toggle = document.getElementById('animations-toggle');
    const enabled = toggle.checked;

    if (enabled) {
        document.body.classList.remove('no-animations');
        localStorage.setItem('animationsEnabled', 'true');
    } else {
        document.body.classList.add('no-animations');
        localStorage.setItem('animationsEnabled', 'false');
    }
}

function toggleAutoSave() {
    const toggle = document.getElementById('auto-save-toggle');
    const enabled = toggle.checked;
    localStorage.setItem('autoSaveEnabled', enabled ? 'true' : 'false');
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
}

function updateButtonGroupMaterial(type, group, material) {
    if (transactionSettings[type] && transactionSettings[type][group]) {
        const beforeData = { material: transactionSettings[type][group].material };
        transactionSettings[type][group].material = material;
        
        addActivityEntry('updated', `${type}-menu-settings`, beforeData, { material: material }, {
            type: type,
            group: group
        });

        if (type === 'purchase') {
            updatePurchasePreview();
            renderPurchaseButtons();
            scheduleAutoSave();
        } else {
            updateSellPreview();
            renderSellButtons();
            scheduleAutoSave();
        }
    }
}

function updateGroupButton(type, group, amount, field, value) {
    if (transactionSettings[type] && transactionSettings[type][group] && transactionSettings[type][group].buttons[amount]) {
        const beforeData = JSON.parse(JSON.stringify(transactionSettings[type][group].buttons[amount]));
        transactionSettings[type][group].buttons[amount][field] = value;
        
        addActivityEntry('updated', `${type}-menu-button`, beforeData, JSON.parse(JSON.stringify(transactionSettings[type][group].buttons[amount])), {
            type: type,
            group: group,
            key: amount
        });

        if (type === 'purchase') {
            updatePurchasePreview();
            renderPurchaseButtons();
            scheduleAutoSave();
        } else {
            updateSellPreview();
            renderSellButtons();
            scheduleAutoSave();
        }
    }
}

function isMainMenuSlotOccupied(slot, excludeIndex = null) {
    return loadedGuiShops.some((shop, index) => index !== excludeIndex && shop.slot === slot);
}

function isSlotOccupied(type, slot, excludeGroup = null, excludeAmount = null) {
    const settings = transactionSettings[type];
    
    // Check static buttons
    for (const [key, btn] of Object.entries(settings.buttons)) {
        if (btn.slot === slot) return true;
    }

    // Check amount buttons
    for (const group of ['add', 'remove', 'set']) {
        for (const [amount, btn] of Object.entries(settings[group].buttons)) {
            if (group === excludeGroup && amount === excludeAmount) continue;
            if (btn.slot === slot) return true;
        }
    }

    // Check display slot
    if (settings.displaySlot === slot) return true;

    return false;
}

function addCustomButton(type, group) {
    showPrompt(`Enter amount for new ${group} button:`, '100', 'Add Custom Button').then(amount => {
        if (amount && !isNaN(amount)) {
            if (transactionSettings[type][group].buttons[amount]) {
                showAlert('A button with this amount already exists!', 'error');
                return;
            }

            // Find first free slot
            let slot = 0;
            while (isSlotOccupied(type, slot) && slot < 54) slot++;

            if (slot >= 54) {
                showAlert('No free slots available!', 'error');
                return;
            }

            const newBtn = {
                name: `&a${group.charAt(0).toUpperCase() + group.slice(1)} ${amount}`,
                slot: slot
            };
            transactionSettings[type][group].buttons[amount] = newBtn;

            addActivityEntry('created', `${type}-menu-button`, null, JSON.parse(JSON.stringify(newBtn)), {
                type: type,
                group: group,
                key: amount
            });

            if (type === 'purchase') {
                updatePurchasePreview();
                renderPurchaseButtons();
                scheduleAutoSave();
            } else {
                updateSellPreview();
                renderSellButtons();
                scheduleAutoSave();
            }
        }
    });
}

function removeCustomButton(type, group, amount) {
    showConfirm(`Are you sure you want to remove the ${amount} button?`).then(confirmed => {
        if (confirmed) {
            const beforeData = JSON.parse(JSON.stringify(transactionSettings[type][group].buttons[amount]));
            delete transactionSettings[type][group].buttons[amount];
            
            addActivityEntry('deleted', `${type}-menu-button`, beforeData, null, {
                type: type,
                group: group,
                key: amount
            });

            if (type === 'purchase') {
                updatePurchasePreview();
                renderPurchaseButtons();
                scheduleAutoSave();
            } else {
                updateSellPreview();
                renderSellButtons();
                scheduleAutoSave();
            }
        }
    });
}
