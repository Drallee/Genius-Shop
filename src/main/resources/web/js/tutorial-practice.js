(function(global) {
    'use strict';
    const clone = value => JSON.parse(JSON.stringify(value));
    let practiceFile = 'tutorial-practice.yml';
    const sample = 'gui-name: Practice shop\nrows: 3\nitems:\n  - material: STONE\n    name: Practice stone\n    price: 1\n    amount: 1\n    slot: 0\n  - material: DIRT\n    name: Practice dirt\n    price: 2\n    amount: 1\n    slot: 1\n';
    let snapshot = null;
    let pendingWrites = 0;
    const originalFetch = global.fetch;

    // One network boundary protects every editor write path, not just autosave.
    global.fetch = function(input, options = {}) {
        const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url,
            `${location.protocol}//${location.host}`);
        const method = (options.method || input.method || 'GET').toUpperCase();
        const apiIndex = url.pathname.indexOf('/api/');
        const api = url.origin === `${location.protocol}//${location.host}` && apiIndex >= 0;
        const apiPath = url.pathname.slice(apiIndex);
        const safeRead = method === 'GET' && (['/api/files', '/api/language', '/api/languages',
            '/api/stock-analytics', '/api/database', '/api/activity-log'].includes(apiPath) || apiPath.startsWith('/api/file/'));
        if (snapshot && api && !safeRead) return Promise.reject(new Error('Practice only: live server writes are blocked. Exit the tutorial before saving.'));
        const writing = api && method !== 'GET' && method !== 'HEAD';
        if (writing) pendingWrites++;
        return Promise.resolve().then(() => originalFetch.call(global, input, options)).then(response => {
            if (writing) {
                // Wait for the response body as well, before allowing practice to replace models.
                const body = response.clone ? response.clone().arrayBuffer() : Promise.resolve();
                body.catch(() => {}).finally(() => { pendingWrites--; });
            }
            return response;
        }, error => { if (writing) pendingWrites--; throw error; });
    };

    function begin() {
        if (snapshot) return true;
        if (currentModalData || isSaving || pendingWrites) return false;
        if (Array.from(document.querySelectorAll('.modal-overlay')).some(element =>
            getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden')) return false;
        let suffix = 1;
        practiceFile = 'tutorial-practice.yml';
        while (allShops[practiceFile] || currentShopFile === practiceFile) practiceFile = `tutorial-practice-${suffix++}.yml`;
        const selector = document.getElementById('shop-file-selector');
        snapshot = { items, currentShopSettings, currentShopFile, currentPreviewPage, itemIdCounter,
            allShops, loadedGuiShops, mainMenuSettings, transactionSettings, guiSettings, globalCampaigns,
            customCommands, commandsFileRaw, customItemsConfig, customItemsFileRaw, commandCatalog,
            economySafetySettings, priceFormatSettings, activityLog, unsavedChanges,
            campaignHubDirtyShopFiles, campaignHubSelectedKey, campaignHubItemShopFile,
            itemSearchQuery, currentSort, selectorHtml: selector?.innerHTML, selectorValue: selector?.value,
            toasts: Array.from(document.getElementById('toast-container')?.children || []) };
        allShops = { [practiceFile]: sample };
        currentShopFile = practiceFile;
        currentPreviewPage = 0;
        itemSearchQuery = '';
        currentSort = 'slot-asc';
        parseShopYaml(sample);
        mainMenuSettings = { ...clone(mainMenuSettings), title: 'Practice menu', rows: 3 };
        loadedGuiShops = [{ key: 'practice-shop', slot: 0, material: 'CHEST', name: 'Practice shop',
            lore: [], action: 'shop-key', shopKey: practiceFile.replace(/\.yml$/, ''), commands: [], runAs: 'player', permission: '' }];
        transactionSettings = clone(transactionSettings);
        transactionSettings.purchase.rows = 3;
        transactionSettings.sell.maxAmount = 64;
        guiSettings = clone(guiSettings);
        guiSettings.backButton.name = 'Back';
        globalCampaigns = [];
        customCommands = [];
        customItemsConfig = { items: {} };
        customItemsFileRaw = 'items: {}\n';
        commandsFileRaw = 'commands: {}\n';
        commandCatalog = clone(commandCatalog);
        economySafetySettings = clone(economySafetySettings);
        priceFormatSettings = clone(priceFormatSettings);
        campaignHubDirtyShopFiles = new Set();
        campaignHubSelectedKey = '';
        campaignHubItemShopFile = practiceFile;
        activityLog = [];
        setUnsavedChanges([]);
        if (selector) {
            selector.replaceChildren(new Option('Choose a practice shop', ''), new Option('Practice shop', practiceFile));
            selector.value = '';
            selector.dispatchEvent(new Event('refresh'));
        }
        renderItems();
        renderMainMenuShops();
        return true;
    }

    function end() {
        if (!snapshot) return;
        const saved = snapshot;
        items = saved.items; currentShopSettings = saved.currentShopSettings;
        currentShopFile = saved.currentShopFile; currentPreviewPage = saved.currentPreviewPage;
        itemIdCounter = saved.itemIdCounter; allShops = saved.allShops;
        loadedGuiShops = saved.loadedGuiShops; mainMenuSettings = saved.mainMenuSettings;
        transactionSettings = saved.transactionSettings; guiSettings = saved.guiSettings;
        globalCampaigns = saved.globalCampaigns; customCommands = saved.customCommands;
        commandsFileRaw = saved.commandsFileRaw; customItemsConfig = saved.customItemsConfig;
        customItemsFileRaw = saved.customItemsFileRaw; commandCatalog = saved.commandCatalog;
        economySafetySettings = saved.economySafetySettings; priceFormatSettings = saved.priceFormatSettings;
        activityLog = saved.activityLog; setUnsavedChanges(saved.unsavedChanges);
        campaignHubDirtyShopFiles = saved.campaignHubDirtyShopFiles;
        campaignHubSelectedKey = saved.campaignHubSelectedKey; campaignHubItemShopFile = saved.campaignHubItemShopFile;
        itemSearchQuery = saved.itemSearchQuery; currentSort = saved.currentSort;
        const selector = document.getElementById('shop-file-selector');
        if (selector) {
            selector.innerHTML = saved.selectorHtml;
            selector.value = saved.selectorValue;
            selector.dispatchEvent(new Event('refresh'));
        }
        renderItems(); renderMainMenuShops(); renderCampaignsTab(); renderCommandsTab();
        renderCustomItemsTab(); renderGuiSettings(); updateExport();
        for (const toast of Array.from(document.getElementById('toast-container')?.children || [])) {
            if (!saved.toasts.includes(toast)) toast.remove();
        }
        snapshot = null;
    }

    const value = id => document.getElementById(id)?.value || '';
    const checked = id => !!document.getElementById(id)?.checked;
    const saveButton = '#edit-modal button[onclick="saveEditModal()"]';
    const modalOpen = () => !!currentModalData && document.getElementById('edit-modal').style.display !== 'none';
    function task(id) {
        const initialItems = items.length;
        const initialCommands = customCommands.length;
        const initialCustomItems = Object.keys(customItemsConfig.items).length;
        const definitions = {
            'menu-title': { allow: ['#preview .gui-title-container'], done: () => mainMenuSettings.title === 'Practice menu title' },
            'shop-select': { allow: ['.shop-file-selector-wrapper'], done: () => value('shop-file-selector') === practiceFile },
            'shop-open': { allow: ['#preview-grid .gui-slot[data-slot-index="0"]'], done: modalOpen },
            material: { allow: ['#modal-material'], done: () => value('modal-material').toUpperCase() === 'DIAMOND' },
            price: { allow: ['#modal-price'], done: () => Number(value('modal-price')) === 25 },
            lore: { allow: ['#group-modal-enableLore', '#group-modal-lore'], target: () => checked('modal-enableLore') ? '#modal-lore' : '#group-modal-enableLore label',
                done: () => checked('modal-enableLore') && value('modal-lore').trim() === 'Practice item' },
            dynamic: { allow: ['#group-modal-dynamicPricing'], done: () => checked('modal-dynamicPricing') },
            permission: { allow: ['#modal-permission'], done: () => value('modal-permission') === 'tutorial.practice' },
            'item-commands': { allow: ['#group-modal-enableCommands', '#group-modal-commands'],
                target: () => checked('modal-enableCommands') ? '#modal-commands' : '#group-modal-enableCommands label',
                done: () => checked('modal-enableCommands') && value('modal-commands').trim() === 'say Practice %player%' },
            'item-save': { allow: [saveButton], done: () => !modalOpen() && items[0].material === 'DIAMOND' && items[0].price === 25 },
            drag: { allow: ['#preview-grid .gui-slot', '#modal-slot', saveButton],
                target: () => modalOpen() ? (Number(value('modal-slot')) !== 0 ? saveButton : '#modal-slot') : '#preview-grid .gui-slot.filled',
                done: () => !modalOpen() && items[0].slot !== 0 },
            'item-add': { allow: ['#shop-tab button[onclick="addItem()"]'], done: () => items.length > initialItems },
            'purchase-rows': { allow: ['#purchase-settings-preview .stealth-edit-container:first-child'], done: () => transactionSettings.purchase.rows === 4 },
            'sell-maximum': { allow: ['#sell-settings-preview .stealth-edit-container:nth-child(2)'], done: () => transactionSettings.sell.maxAmount === 128 },
            'campaign-open': { allow: ['#campaigns-tab button[onclick="addCampaignTemplate()"]'], done: modalOpen },
            'campaign-key': { allow: ['#modal-campaign-key'], done: () => value('modal-campaign-key') === 'practice-sale' },
            'campaign-multiplier': { allow: ['#modal-campaign-buy'], done: () => Number(value('modal-campaign-buy')) === 0.9 },
            'campaign-save': { allow: [saveButton], done: () => !modalOpen() && globalCampaigns.some(campaign => campaign.key === 'practice-sale' && campaign.buyMultiplier === 0.9) },
            'command-add': { allow: ['#commands-tab button[onclick="addCustomCommand()"]'], done: () => customCommands.length > initialCommands },
            'command-name': { allow: ['[data-command-field="name"]'], done: () => customCommands.some(command => command.name === 'practice-shop') },
            'customitem-add': { allow: ['#customitems-tab button[onclick="addCustomItem()"]'], done: () => Object.keys(customItemsConfig.items).length > initialCustomItems },
            'gui-open': { allow: ['#gui-settings-container [onclick="openGuiButtonModal(\'backButton\', \'Back Button\')"]'], done: modalOpen },
            'gui-name': { allow: ['#modal-name'], done: () => value('modal-name') === 'Practice back' },
            'gui-save': { allow: [saveButton], done: () => !modalOpen() && guiSettings.backButton.name === 'Practice back' }
        };
        return definitions[id];
    }

    global.EditorTutorialPractice = { begin, end, task, isActive: () => !!snapshot };
})(window);
