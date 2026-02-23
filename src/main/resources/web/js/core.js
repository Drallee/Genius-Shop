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
let serverInfo = {
    version: 'unknown',
    smartSpawnerEnabled: false,
    entityTypes: []
};
let priceFormatSettings = {
    mode: 'plain',
    grouped: {
        thousandsSeparator: '.',
        decimalSeparator: ',',
        maxDecimals: 2
    }
};
let autoSaveTimeout = null;
let isSaving = false;
let currentPreviewPage = 0; // Current page being previewed
let itemSearchQuery = ''; // Filter for items list
let currentSort = 'slot'; // Default sort by slot

// Drag and drop state
let draggedSlotIndex = null;
let draggedItemSource = null; // 'shop' or 'mainmenu'
let draggedFromPage = null;
let pageFlipTimeout = null;

// Current Shop Metadata State
function createDefaultStockResetRule() {
    return {
        enabled: false,
        type: 'daily',
        time: '00:00',
        interval: 1,
        dayOfWeek: 'MONDAY',
        dayOfMonth: 1,
        month: 1,
        monthDay: '',
        date: '',
        timezone: ''
    };
}

let currentShopSettings = {
    guiName: '&8Shop',
    rows: 3,
    permission: '',
    availableTimes: '',
    sellAddsToStock: false,
    allowSellStockOverflow: false,
    stockResetRule: createDefaultStockResetRule()
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
        totalLine: '&eTotal: &7%total%',
        spawnerTypeLine: '&7Spawner Type: &e%type%',
        spawnerItemLine: '&7Spawner Item: &e%item%',
        potionTypeLine: '&7Potion Type: &d%type%',
        globalLimitLine: '&7Stock: &e%global-limit%',
        playerLimitLine: '&7Your limit: &e%player-limit%',
        stockResetTimerLine: '&7%stock-reset-timer%',
        globalLimitValueFormat: '%current%/%limit%',
        playerLimitValueFormat: '%current%/%limit%',
        stockResetTimerValueFormat: 'Stock resets in %time%',
        loreFormat: [
            "%price-line%",
            "",
            "%custom-lore%",
            "%spawner-type-line%",
            "%spawner-item-line%",
            "%potion-type-line%",
            "%global-limit%",
            "%player-limit%",
            "%stock-reset-timer%",
            "",
            "%hint-line%"
        ]
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

// Safety fallbacks in case ui.js fails to load or parse.
if (typeof window.renderSkeletons !== 'function') {
    window.renderSkeletons = function() {
        const container = document.getElementById('items-container') || document.getElementById('mainmenu-shops-container');
        if (container) {
            container.innerHTML = '<div class="skeleton skeleton-item"></div><div class="skeleton skeleton-item"></div>';
        }
    };
}

if (typeof window.initCustomSelects !== 'function') {
    window.initCustomSelects = function() {};
}

const DEFAULT_TRANSLATIONS = {
    "web-editor": {
        "title": "Genius Shop - Configuration Editor",
        "hero-title": "GENIUS SHOP EDITOR",
        "hero-subtitle": "Configure your shop with live Minecraft preview",
        "beta-badge": "BETA - Some features may be working and some might be missing",
        "bug-report": "Report bugs or missing features",
        "auto-save": "Auto-save",
        "animations": "Animations",
        "history": "HISTORY",
        "reload": "RELOAD",
        "save-tab": "SAVE TAB",
        "publish-all": "PUBLISH ALL",
        "logout": "LOGOUT",
        "rows": "Rows:",
        "permission": "Permission:",
        "available-times": "Times:",
        "display-material": "Material:",
        "display-slot": "Slot:",
        "max-amount": "Max:",
        "spawner-lore": "Spawner Lore:",
        "tabs": {
            "main-menu": "MAIN MENU",
            "shop": "SHOP",
            "purchase": "PURCHASE",
            "sell": "SELL",
            "gui-settings": "GUI SETTINGS"
        },
        "preview-loading": "Loading...",
        "prev": "PREV",
        "next": "NEXT",
        "page-indicator": "Page %page%/%total%",
        "main-menu": {
            "title": "MAIN MENU EDITOR",
            "buttons-count": "%count% buttons",
            "settings": "SETTINGS",
            "add-button": "ADD BUTTON"
        },
        "shop": {
            "current-file": "CURRENT SHOP FILE",
            "loading": "Loading shops...",
            "create-new": "CREATE NEW SHOP",
            "title": "SHOP CONTENT",
            "items-count": "%count% items",
            "sort-label": "Sort by:",
            "sort": {
                "slot-asc": "Slot (Low to High)",
                "slot-desc": "Slot (High to Low)",
                "name-asc": "Name (A to Z)",
                "name-desc": "Name (Z to A)",
                "material-asc": "Material (A to Z)",
                "material-desc": "Material (Z to A)",
                "price-asc": "Buy Price (Low to High)",
                "price-desc": "Buy Price (High to Low)",
                "sell-price-asc": "Sell Price (Low to High)",
                "sell-price-desc": "Sell Price (High to Low)",
                "id-asc": "ID (Low to High)",
                "id-desc": "ID (High to Low)"
            },
            "search-placeholder": "Search by name or material...",
            "add-item": "ADD ITEM",
            "delete-file": "Delete Shop File"
        },
        "purchase": {
            "title": "PURCHASE CONFIGURATION",
            "menu-settings": "MENU SETTINGS"
        },
        "sell": {
            "title": "SELL CONFIGURATION",
            "menu-settings": "MENU SETTINGS"
        },
        "gui-settings": {
            "title": "GUI GLOBAL SETTINGS",
            "lore-format-title": "Shop Item Lore Format",
            "lore-format-label": "Lore Format"
        },
        "tips": {
            "title": "QUICK TIPS",
            "tip1": "Click items in preview to edit properties",
            "tip2": "Real Minecraft textures displayed",
            "tip3": "Auto-save keeps your changes safe",
            "tip4": "Use SYNC to reload from server",
            "tip5": "Create multiple shop files"
        },
        "modals": {
            "edit-item": "Edit Item",
            "edit-main-item": "Edit Main Item",
            "edit-button": "Edit Menu Button",
            "delete": "Delete",
            "cancel": "Cancel",
            "save": "Save",
            "confirm-title": "Confirm Action",
            "confirm-button": "Confirm",
            "alert-title": "Message",
            "error-title": "Error",
            "success-title": "Success",
            "warning-title": "Warning",
            "prompt-title": "Enter Value",
            "save-confirm-title": "Confirm Save",
            "activity-detail-title": "Change Details",
            "rollback": "ROLLBACK",
            "rollback-success": "Action rolled back successfully",
            "refresh": "REFRESH",
            "clear": "CLEAR ALL",
            "history-log": "HISTORY LOG",
            "about-history-title": "ABOUT HISTORY LOG",
            "about-history-text": "Track all changes made by users. Click any entry to view detailed before/after comparison.",
            "no-activity": "No Activity Yet",
            "session-expired": "Session expired. Please login again.",
            "item-updated": "Item updated",
            "item-removed": "Item removed",
            "remove-confirm": "Are you sure you want to remove this %item%?",
            "remove-file-confirm": "Are you sure you want to PERMANENTLY DELETE %file% from the server? This cannot be undone!",
            "reload-confirm": "Are you sure you want to reload all configurations from the server? Any unsaved changes will be lost.",
            "logout-confirm": "Are you sure you want to logout?",
            "shop-created": "New shop created",
            "shop-removed": "Shop file removed",
            "file-saved": "File saved successfully",
            "save-error": "Failed to save file",
            "publish-success": "All changes published successfully",
            "publish-error": "Failed to publish changes",
            "reload-success": "Configuration reloaded from server",
            "reload-error": "Failed to reload configuration",
            "loaded": "Loaded",
            "load-failed": "Load failed",
            "saving": "Saving...",
            "saved": "Saved",
            "save-failed": "Save failed",
            "delete-error": "Failed to delete",
            "connect-error": "Failed to connect to server",
            "api-hint": "Make sure the API is enabled in config.yml and the port is open.",
            "rollback-failed": "Rollback failed",
            "copied": "Copied to clipboard!",
            "shop-exists": "A shop with this name already exists!",
            "enter-filename": "Enter new shop filename (e.g. tools.yml):",
            "publishing": "Publishing...",
            "published": "Published",
            "fields": {
                "material": "Material",
                "material-hint": "Minecraft material name (e.g. DIAMOND_SWORD)",
                "display-name": "Display Name",
                "display-name-hint": "Supports & color codes",
                "slot": "Slot",
                "slot-hint": "Position in the GUI (absolute index)",
                "buy-price": "Buy Price",
                "buy-price-hint": "0 = cannot buy",
                "sell-price": "Sell Price",
                "sell-price-hint": "0 = cannot sell",
                "amount": "Amount",
                "lore": "Lore (one per line)",
                "enchantments": "Enchantments",
                "enchantments-hint": "Format: ENCHANTMENT:LEVEL (e.g. SHARPNESS:5)",
                "spawner-type": "Spawner Type",
                "spawner-type-hint": "Entity type for the spawner",
                "potion-type": "Potion Type",
                "potion-type-hint": "Base potion effect",
                "potion-level": "Potion Level",
                "potion-level-hint": "0 = default, 1+ = custom amplifier",
                "hide-attributes": "Hide Attributes",
                "hide-additional": "Hide Additional Info",
                "require-name": "Require Name",
                "require-name-hint": "Exact name match required for selling",
                "require-lore": "Require Lore",
                "require-lore-hint": "Exact lore match required for selling",
                "unstable-tnt": "Unstable TNT",
                "limit": "Limit",
                "player-limit": "Player Limit",
                "player-limit-hint": "Total amount a player can buy/sell (0 = unlimited)",
                "global-limit": "Global Limit",
                "global-limit-hint": "Total amount available globally (restocks when sold)",
                "add-limit": "Add Limit...",
                "remove-limit": "Remove",
                "select-limit": "-- Select to add --",
                "dynamic-pricing": "Dynamic Pricing",
                "min-price": "Min Price",
                "min-price-hint": "Minimum dynamic price",
                "max-price": "Max Price",
                "max-price-hint": "Maximum dynamic price",
                "price-change": "Price Change",
                "price-change-hint": "Price change per item bought/sold"
            },
            "new-item-name": "&eNew Item",
            "new-item-lore": "&7Added via web editor",
            "new-shop-name": "&eNew Shop",
            "click-to-open": "&7Click to open",
            "buying-title": "&8Buying ",
            "selling-title": "&8Selling ",
            "confirm-purchase": "&aCONFIRM PURCHASE",
            "confirm-sell": "&aCONFIRM SELL",
            "sell-all": "&6SELL ALL"
        },
        "item": {
            "item-location": "Page %page%, Slot %slot%"
        },
        "footer": {
            "description": "A powerful configuration editor for Minecraft shop plugins with live preview",
            "github": "Star on GitHub",
            "issues": "Report Issues",
            "made-with": "Made with love by Dralle for the Minecraft community",
            "copyright": "(c) 2025 Genius Shop - Open Source Project"
        }
    }
};

let translations = DEFAULT_TRANSLATIONS;
let currentLanguage = localStorage.getItem('preferredLanguage');

async function loadTranslations() {
    try {
        const langParam = currentLanguage ? `?lang=${currentLanguage}` : '';
        const response = await fetch(`${API_URL}/api/language${langParam}`);
        if (response.ok) {
            const data = await response.json();
            translations = data;
            
            // If the server returned a different language than we expected (e.g. fallback)
            if (data.language && !currentLanguage) {
                currentLanguage = data.language;
                localStorage.setItem('preferredLanguage', currentLanguage);
            }
            
            applyTranslations();
        }
    } catch (error) {
        console.error('Failed to load translations:', error);
    } finally {
        // Always try to load the list of available languages
        loadLanguages();
    }
}

async function loadLanguages() {
    try {
        const response = await fetch(`${API_URL}/api/languages`);
        if (response.ok) {
            const languages = await response.json();
            const selectors = [document.getElementById('language-selector')];
            
            selectors.forEach(selector => {
                if (!selector) return;
                selector.innerHTML = '';
                languages.forEach(lang => {
                    const option = document.createElement('option');
                    option.value = lang;
                    // Prettier names for defaults
                    const names = {
                        'en_US': 'English (US)',
                        'en_GB': 'English (UK)',
                        'ru_RU': 'Russian',
                        'de_DE': 'Deutsch',
                        'fr_FR': 'French',
                        'tr_TR': 'Turkish',
                        'ro_RO': 'Romanian',
                        'es_MX': 'Spanish (MX)',
                        'es_ES': 'Spanish (ES)',
                        'es_AR': 'Spanish (AR)',
                        'pt_BR': 'Portuguese (BR)',
                        'pt_PT': 'Portuguese (PT)',
                        'vi_VN': 'Vietnamese',
                        'nl_NL': 'Nederlands',
                        'fi_FI': 'Suomi',
                        'pl_PL': 'Polski',
                        'da_DK': 'Dansk'
                    };
                    option.textContent = names[lang] || lang;
                    selector.appendChild(option);
                });
                if (currentLanguage) {
                    selector.value = currentLanguage;
                }
                selector.dispatchEvent(new Event('refresh'));
            });
        }
    } catch (error) {
        console.error('Failed to load languages list:', error);
    }
}

async function changeEditorLanguage(lang) {
    localStorage.setItem('preferredLanguage', lang);
    currentLanguage = lang;
    
    // Update all selectors to match
    const selectors = [document.getElementById('language-selector')];
    selectors.forEach(s => { if(s) s.value = lang; });
    
    await loadTranslations();
    // Immediately repaint current tab/preview so title never stays as translated "Loading...".
    if (typeof switchTab === 'function') {
        switchTab(currentTab || 'mainmenu');
    } else {
        if (currentTab === 'mainmenu' && typeof updateGuiPreview === 'function') updateGuiPreview();
        if (currentTab === 'shop' && typeof updatePreview === 'function') updatePreview();
        if (currentTab === 'purchase' && typeof updatePurchasePreview === 'function') updatePurchasePreview();
        if (currentTab === 'sell' && typeof updateSellPreview === 'function') updateSellPreview();
    }
    showToast(t('web-editor.modals.reload-success', 'Configuration reloaded from server'), 'success');
}

function t(key, replacements = {}) {
    if (!translations) return key;
    
    // Try full path
    let text = key.split('.').reduce((obj, k) => obj && obj[k], translations);
    
    // If not found and key starts with web-editor., try looking inside web-editor object
    if ((text === undefined || text === null) && key.startsWith('web-editor.')) {
        const subKey = key.substring('web-editor.'.length);
        text = subKey.split('.').reduce((obj, k) => obj && obj[k], translations);
    }
    
    // If still not found and translations has web-editor key, try looking there
    if ((text === undefined || text === null) && translations['web-editor']) {
        text = key.split('.').reduce((obj, k) => obj && obj[k], translations['web-editor']);
    }

    // FALLBACK TO DEFAULT_TRANSLATIONS
    if (text === undefined || text === null) {
        text = key.split('.').reduce((obj, k) => obj && obj[k], DEFAULT_TRANSLATIONS);
        
        if ((text === undefined || text === null) && key.startsWith('web-editor.')) {
            const subKey = key.substring('web-editor.'.length);
            text = subKey.split('.').reduce((obj, k) => obj && obj[k], DEFAULT_TRANSLATIONS);
        }
        
        if ((text === undefined || text === null) && DEFAULT_TRANSLATIONS['web-editor']) {
            text = key.split('.').reduce((obj, k) => obj && obj[k], DEFAULT_TRANSLATIONS['web-editor']);
        }
    }
    
    if (text === undefined || text === null) {
        if (typeof replacements === 'string') return replacements;
        return key;
    }
    
    if (typeof text !== 'string') return key;

    if (typeof replacements === 'object' && replacements !== null) {
        for (const [placeholder, value] of Object.entries(replacements)) {
            text = text.replace(new RegExp(`%${placeholder}%`, 'g'), value);
        }
    }
    return text;
}

function applyFontAwesomeIcons() {
    const setIcon = (selector, classes) => {
        document.querySelectorAll(selector).forEach(el => {
            el.innerHTML = `<i class="${classes}" aria-hidden="true"></i>`;
        });
    };

    const normalize = (text) => {
        if (!text) return '';
        return text.replace(/^[^A-Za-z0-9&]+/, '').trim();
    };

    const setTextWithIcon = (selector, classes) => {
        document.querySelectorAll(selector).forEach(el => {
            const text = normalize(el.textContent);
            if (text.length > 0) {
                el.innerHTML = `<i class="${classes}" aria-hidden="true"></i> ${text}`;
            }
        });
    };

    setIcon('.edit-icon', 'fa-solid fa-pen');
    setIcon('.edit-icon-small', 'fa-solid fa-pen');
    setIcon('.modal-close', 'fa-solid fa-xmark');
    setIcon('button[onclick="logout()"] .btn-icon', 'fa-solid fa-right-from-bracket');
    setIcon('button[onclick="addMainMenuShop()"] .btn-icon', 'fa-solid fa-plus');
    setIcon('button[onclick="addItem()"] .btn-icon', 'fa-solid fa-plus');
    setIcon('button[onclick="openActivityLogModal()"] .btn-icon', 'fa-solid fa-clock-rotate-left');
    setIcon('button[onclick="reloadCurrentConfig()"] .btn-icon', 'fa-solid fa-rotate');
    setIcon('button[onclick="manualSave()"] .btn-icon', 'fa-solid fa-floppy-disk');
    setIcon('button[onclick="publishChanges()"] .btn-icon', 'fa-solid fa-rocket');
    setIcon('.search-icon', 'fa-solid fa-magnifying-glass');
    setIcon('#tips-toggle-icon', 'fa-solid fa-chevron-down');
    setIcon('#alert-modal-icon', 'fa-solid fa-circle-info');
    setIcon('#prompt-modal-icon', 'fa-solid fa-pen-to-square');
    setIcon('#modal-delete-btn span:first-child', 'fa-solid fa-trash');
    setIcon('#activity-log-empty div:first-child', 'fa-solid fa-clock-rotate-left');
    setIcon('#activity-log-modal .info-box .flex.items-center.gap-8.mb-8 span:first-child', 'fa-solid fa-circle-info');
    setIcon('button[onclick="confirmSave()"] span:first-child', 'fa-solid fa-floppy-disk');
    setIcon('#page-navigation button:first-child span:first-child', 'fa-solid fa-chevron-left');
    setIcon('#page-navigation button:last-child span:last-child', 'fa-solid fa-chevron-right');
    setIcon('.info-box .flex.justify-between.items-center.mb-12 h3 span:first-child', 'fa-solid fa-lightbulb');
    setIcon('#confirm-modal .modal-title > span:first-child', 'fa-solid fa-triangle-exclamation');
    setIcon('#save-confirmation-modal .modal-title > span:first-child', 'fa-solid fa-floppy-disk');
    setIcon('#activity-detail-modal .modal-title > span:first-child', 'fa-solid fa-clock-rotate-left');
    setIcon('button[onclick="openShopSettingsModal()"] i, button[onclick="openShopSettingsModal()"]', 'fa-solid fa-gear');
    setIcon('button[onclick="createNewShop()"] i, button[onclick="createNewShop()"]', 'fa-solid fa-file-circle-plus');

    setTextWithIcon('[data-i18n="web-editor.hero-title"]', 'fa-solid fa-shop');
    setTextWithIcon('[data-i18n="web-editor.beta-badge"]', 'fa-solid fa-triangle-exclamation');
    setTextWithIcon('[data-i18n="web-editor.modals.rollback"]', 'fa-solid fa-backward-fast');
    setTextWithIcon('[data-i18n="web-editor.modals.history-log"]', 'fa-solid fa-clock-rotate-left');
    setTextWithIcon('[data-i18n="web-editor.modals.refresh"]', 'fa-solid fa-rotate');
    setTextWithIcon('[data-i18n="web-editor.modals.clear"]', 'fa-solid fa-trash');
    setTextWithIcon('[data-i18n="web-editor.tips.tip1"]', 'fa-solid fa-wand-magic-sparkles');
    setTextWithIcon('[data-i18n="web-editor.tips.tip2"]', 'fa-solid fa-palette');
    setTextWithIcon('[data-i18n="web-editor.tips.tip3"]', 'fa-solid fa-floppy-disk');
    setTextWithIcon('[data-i18n="web-editor.tips.tip4"]', 'fa-solid fa-rotate');
    setTextWithIcon('[data-i18n="web-editor.tips.tip5"]', 'fa-solid fa-file-lines');
    setTextWithIcon('[data-i18n="web-editor.footer.github"]', 'fa-brands fa-github');
    setTextWithIcon('[data-i18n="web-editor.footer.issues"]', 'fa-solid fa-bug');

    const madeWith = document.querySelector('[data-i18n="web-editor.footer.made-with"]');
    if (madeWith) {
        const suffix = normalize(madeWith.textContent).replace(/^Made with\s*/i, '').trim();
        madeWith.innerHTML = `Made with <i class="fa-solid fa-heart" style="color:#ef4444;" aria-hidden="true"></i> ${suffix || 'by Dralle for the Minecraft community'}`;
    }

    const copyright = document.querySelector('[data-i18n="web-editor.footer.copyright"]');
    if (copyright) {
        copyright.innerHTML = '&copy; 2025 Genius Shop - Open Source Project';
    }

    document.querySelectorAll('footer div[style*="display: flex"] > span').forEach(el => {
        el.innerHTML = '&bull;';
    });
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n], [data-i18n-title]').forEach(el => {
        // Keep preview title bound to config values, not translation placeholders.
        if (el.id === 'preview-title') return;

        const key = el.getAttribute('data-i18n') || el.getAttribute('data-i18n-title');
        const translated = t(key);
        if (translated !== key) {
            if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'password' || el.type === 'search')) {
                el.placeholder = translated;
            } else if (el.hasAttribute('data-i18n-title')) {
                el.setAttribute('title', translated);
            } else {
                el.innerHTML = translated;
            }
        }
    });
    
    // Update page title
    const pageTitle = t('web-editor.title');
    if (pageTitle !== 'web-editor.title') {
        document.title = pageTitle;
    }

    applyFontAwesomeIcons();
}

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

// Apply defaults immediately
applyTranslations();

// Start loading translations immediately
loadTranslations();

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

function normalizeActivityData(value) {
    if (Array.isArray(value)) {
        return value.map(normalizeActivityData);
    }
    if (value && typeof value === 'object') {
        const normalized = {};
        Object.keys(value).sort().forEach(key => {
            normalized[key] = normalizeActivityData(value[key]);
        });
        return normalized;
    }
    return value;
}

function isSameActivityData(a, b) {
    try {
        return JSON.stringify(normalizeActivityData(a)) === JSON.stringify(normalizeActivityData(b));
    } catch (e) {
        return JSON.stringify(a) === JSON.stringify(b);
    }
}

function addActivityEntry(action, target, beforeData, afterData, details = {}) {
    // Do not log "updated" events if no effective data change happened.
    if (action === 'updated' && isSameActivityData(beforeData, afterData)) {
        return;
    }

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
