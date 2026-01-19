// ===== UI RENDERING & PREVIEW =====

function switchTab(tabName) {
    currentTab = tabName;

    // Toggle tab content visibility
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    const activeTab = document.getElementById(`${tabName}-tab`);
    if (activeTab) activeTab.classList.add('active');

    // Toggle tab button states
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
        
        // Match by normalized text content
        const normalizedBtnText = tab.textContent.trim().toLowerCase().replace(/\s/g, '');
        if (normalizedBtnText === tabName) {
            tab.classList.add('active');
        }
    });

    // Handle tab specific logic
    if (tabName === 'mainmenu') {
        updateGuiPreview();
    } else if (tabName === 'shop') {
        updatePreview();
    } else if (tabName === 'purchase') {
        updatePurchasePreview();
    } else if (tabName === 'sell') {
        updateSellPreview();
    }
}

function updateAll() {
    updatePreview();
    updateExport();
    scheduleAutoSave();
}

function toggleQuickTips() {
    const list = document.getElementById('quick-tips-list');
    const icon = document.getElementById('tips-toggle-icon');
    if (list && icon) {
        const isHidden = list.style.display === 'none';
        list.style.display = isHidden ? 'block' : 'none';
        icon.textContent = isHidden ? '▼' : '▲';
    }
}

function switchShop(filename) {
    if (filename === currentShopFile) return;
    loadShopFromData(filename);
}

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
    const maxPage = Math.ceil(items.length / itemsPerPage) - 1;
    
    currentPreviewPage += direction;
    if (currentPreviewPage < 0) currentPreviewPage = 0;
    if (currentPreviewPage > maxPage) currentPreviewPage = maxPage;
    
    updatePreview();
}

function renderButtonGroup(container, type, group, title, namePrefix) {
    if (!container) return;
    const groupData = transactionSettings[type][group];
    
    let html = `
        <div class="settings-group card-base" style="margin-bottom: 2rem;">
            <div class="flex justify-between items-center mb-24">
                <h3 class="m-0" style="font-size: 1.1rem; color: #fff;">${title}</h3>
                <div class="count-badge">
                    ${Object.keys(groupData.buttons).length} buttons
                </div>
            </div>
            <div class="grid-list" style="grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));">
    `;

    Object.entries(groupData.buttons).sort((a,b) => parseInt(a[0]) - parseInt(b[0])).forEach(([amount, btn]) => {
        html += `
            <div class="shop-item" onclick="openTransactionButtonModal('${type}', '${group}', '${amount}')">
                <div class="flex justify-between items-center mb-8">
                    <div class="item-title">${namePrefix} ${amount}</div>
                    <div class="item-subtitle" style="background: rgba(0,0,0,0.3); padding: 2px 8px; border-radius: 6px;">#${btn.slot}</div>
                </div>
                <div class="item-subtitle" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${parseMinecraftColors(btn.name) || 'Default Name'}
                </div>
            </div>
        `;
    });

    html += `
            </div>
            <button class="btn-base btn-primary w-full mt-40" onclick="addCustomButton('${type}', '${group}')">
                <span>➕ ADD CUSTOM AMOUNT</span>
            </button>
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
    navigator.clipboard.writeText(text).then(() => {
        showAlert('Copied to clipboard!', 'success');
    });
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

function renderItems() {
    const container = document.getElementById('items-container');
    if (!container) {
        if (document.getElementById('items-count-display')) {
            document.getElementById('items-count-display').textContent = items.length;
        }
        return;
    }
    container.innerHTML = '';

    const filteredItems = items.filter(item => {
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
        if (item.spawnerType) tagsHtml += `<span class="item-tag spawner">Spawner: ${escapeHtml(item.spawnerType)}</span>`;
        if (item.potionType) tagsHtml += `<span class="item-tag potion">Potion: ${escapeHtml(item.potionType)}</span>`;
        if (item.dynamicPricing) tagsHtml += `<span class="item-tag dynamic">Dynamic</span>`;
        if (item.limit > 0) tagsHtml += `<span class="item-tag active">Limit: ${item.limit}</span>`;
        if (item.permission) tagsHtml += `<span class="item-tag active" title="${escapeHtml(item.permission)}">Permission</span>`;
        if (item.unstableTnt) tagsHtml += `<span class="item-tag active">Unstable TNT</span>`;
        if (item.requireName) tagsHtml += `<span class="item-tag active">Req Name</span>`;
        if (item.requireLore) tagsHtml += `<span class="item-tag active">Req Lore</span>`;
        if (item.hideAttributes) tagsHtml += `<span class="item-tag">Hide Attr</span>`;
        if (item.hideAdditional) tagsHtml += `<span class="item-tag">Hide Addon</span>`;
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

        itemEl.innerHTML = `
            <div class="item-header">
                <div class="item-icon">
                    <img src="${TEXTURE_API}${item.material.toLowerCase()}.png" onerror="this.src='${TEXTURE_API}stone.png'">
                </div>
                <div class="flex-1">
                    <div class="item-title">${parseMinecraftColors(item.name)}</div>
                    <div class="item-subtitle">${escapeHtml(item.material)} × ${item.amount}</div>
                    ${tagsHtml}
                </div>
                <div class="flex flex-col gap-8 items-end">
                    ${item.price > 0 ? `<div class="item-price-tag" style="color: var(--success);">$${item.price}</div>` : ''}
                    ${item.sellPrice > 0 ? `<div class="item-price-tag" style="color: var(--danger);">$${item.sellPrice}</div>` : ''}
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
                <div style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.2;">🔍</div>
                <div class="text-muted">No items match your search</div>
            </div>
        `;
    }

    document.getElementById('items-count-display').textContent = items.length;
}

function updatePaginationVisibility() {
    const pageNav = document.getElementById('page-navigation');
    if (!pageNav) return;

    if (currentTab === 'shop') {
        const rows = (currentShopSettings && currentShopSettings.rows) ? currentShopSettings.rows : 3;
        const itemsPerPage = rows * 9;
        const totalPages = Math.ceil(items.length / itemsPerPage);
        
        if (items.length > itemsPerPage) {
            pageNav.style.display = 'block';
            const indicator = document.getElementById('page-indicator');
            if (indicator) indicator.textContent = `Page ${currentPreviewPage + 1}/${totalPages || 1}`;
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

    const rows = currentShopSettings.rows || 3;
    const itemsPerPage = rows * 9;
    const guiName = currentShopSettings.guiName;
    const titleElement = document.getElementById('preview-title');
    if (titleElement) titleElement.innerHTML = parseMinecraftColors(guiName);
    
    // Handle paging visibility
    updatePaginationVisibility();

    for (let i = 0; i < rows * 9; i++) {
        const slot = document.createElement('div');
        slot.className = 'gui-slot';
        
        const itemIndex = (currentPreviewPage * itemsPerPage) + i;
        const item = items[itemIndex];

        if (item) {
            slot.innerHTML = `<div class="item-icon"><img src="${TEXTURE_API}${item.material.toLowerCase()}.png" onerror="this.src='${TEXTURE_API}stone.png'"></div>`;
            if (item.amount > 1) {
                slot.innerHTML += `<div class="slot-amount">${item.amount}</div>`;
            }

            if (item.enchantments && Object.keys(item.enchantments).length > 0) {
                slot.classList.add('enchanted');
            }
            
            slot.onclick = () => openShopItemModal(item.id);
            
            let extraHtml = '';
            if (item.price > 0) extraHtml += `<div class="tooltip-line" style="color: #ffa500;">Buy Price: $${item.price}</div>`;
            if (item.sellPrice > 0) extraHtml += `<div class="tooltip-line" style="color: #ff5555;">Sell Price: $${item.sellPrice}</div>`;
            
            setupTooltip(slot, item.name, item.lore || [], extraHtml);
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
                html += `<div class="tooltip-line">${parseMinecraftColors(line)}</div>`;
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
        
        let tagsHtml = '<div class="item-tags">';
        if (shop.shopKey) tagsHtml += `<span class="item-tag active">Shop: ${escapeHtml(shop.shopKey)}</span>`;
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

    // Handle paging visibility
    updatePaginationVisibility();

    const titleElement = document.getElementById('preview-title');
    if (titleElement) titleElement.innerHTML = parseMinecraftColors(mainMenuSettings.title);

    for (let i = 0; i < mainMenuSettings.rows * 9; i++) {
        const slot = document.createElement('div');
        slot.className = 'gui-slot';
        
        const shop = loadedGuiShops.find(s => s.slot === i);
        if (shop) {
            slot.innerHTML = `<div class="item-icon"><img src="${TEXTURE_API}${shop.material.toLowerCase()}.png" onerror="this.src='${TEXTURE_API}chest.png'"></div>`;
            
            slot.onclick = () => openMainMenuShopModal(loadedGuiShops.indexOf(shop));

            setupTooltip(slot, shop.name, shop.lore || []);
        }
        
        grid.appendChild(slot);
    }
}

function updatePurchasePreview() {
    const grid = document.getElementById('preview-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // Handle paging visibility
    updatePaginationVisibility();

    const settings = transactionSettings.purchase;
    const titleElement = document.getElementById('preview-title');
    if (titleElement) titleElement.innerHTML = parseMinecraftColors(settings.titlePrefix + 'Item');

    for (let i = 0; i < 54; i++) {
        const slot = document.createElement('div');
        slot.className = 'gui-slot';
        
        // Handle static buttons
        Object.entries(settings.buttons).forEach(([key, btn]) => {
            if (btn.slot === i) {
                slot.innerHTML = `<div class="item-icon"><img src="${TEXTURE_API}${btn.material.toLowerCase()}.png"></div>`;
                slot.onclick = () => openTransactionButtonModal('purchase', 'main', key);
                setupTooltip(slot, btn.name, [`Slot: ${btn.slot}`, `Material: ${btn.material}`]);
            }
        });

        // Handle amount buttons
        ['add', 'remove', 'set'].forEach(group => {
            Object.entries(settings[group].buttons).forEach(([amount, btn]) => {
                if (btn.slot === i) {
                    slot.innerHTML = `<div class="item-icon"><img src="${TEXTURE_API}${settings[group].material.toLowerCase()}.png"></div>`;
                    slot.innerHTML += `<div class="slot-amount">${amount}</div>`;
                    slot.onclick = () => openTransactionButtonModal('purchase', group, amount);
                    setupTooltip(slot, btn.name, [`Slot: ${btn.slot}`, `Action: ${group.toUpperCase()} ${amount}`]);
                }
            });
        });

        // Display item
        if (i === settings.displaySlot) {
            slot.innerHTML = `<div class="item-icon"><img src="${TEXTURE_API}${settings.displayMaterial.toLowerCase()}.png"></div>`;
            setupTooltip(slot, "&eItem Preview", ["This is where the", "purchased item appears"]);
        }

        grid.appendChild(slot);
    }
}

function updateSellPreview() {
    const grid = document.getElementById('preview-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // Handle paging visibility
    updatePaginationVisibility();

    const settings = transactionSettings.sell;
    const titleElement = document.getElementById('preview-title');
    if (titleElement) titleElement.innerHTML = parseMinecraftColors(settings.titlePrefix + 'Item');

    for (let i = 0; i < 54; i++) {
        const slot = document.createElement('div');
        slot.className = 'gui-slot';
        
        Object.entries(settings.buttons).forEach(([key, btn]) => {
            if (btn.slot === i) {
                slot.innerHTML = `<div class="item-icon"><img src="${TEXTURE_API}${btn.material.toLowerCase()}.png"></div>`;
                slot.onclick = () => openTransactionButtonModal('sell', 'main', key);
                setupTooltip(slot, btn.name, [`Slot: ${btn.slot}`, `Material: ${btn.material}`]);
            }
        });

        ['add', 'remove', 'set'].forEach(group => {
            Object.entries(settings[group].buttons).forEach(([amount, btn]) => {
                if (btn.slot === i) {
                    slot.innerHTML = `<div class="item-icon"><img src="${TEXTURE_API}${settings[group].material.toLowerCase()}.png"></div>`;
                    slot.innerHTML += `<div class="slot-amount">${amount}</div>`;
                    slot.onclick = () => openTransactionButtonModal('sell', group, amount);
                    setupTooltip(slot, btn.name, [`Slot: ${btn.slot}`, `Action: ${group.toUpperCase()} ${amount}`]);
                }
            });
        });

        if (i === settings.displaySlot) {
            slot.innerHTML = `<div class="item-icon"><img src="${TEXTURE_API}${settings.displayMaterial.toLowerCase()}.png"></div>`;
            setupTooltip(slot, "&eItem Preview", ["This is where the", "sold item appears"]);
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

    Object.entries(transactionSettings.purchase.buttons).forEach(([key, btn]) => {
        const el = document.createElement('div');
        el.className = 'shop-item';
        el.onclick = () => openTransactionButtonModal('purchase', 'main', key);
        el.innerHTML = `
            <div class="flex justify-between items-center mb-8">
                <div class="item-title">${key.toUpperCase()}</div>
                <div class="item-subtitle" style="background: rgba(0,0,0,0.3); padding: 2px 8px; border-radius: 6px;">#${btn.slot}</div>
            </div>
            <div class="flex items-center gap-12">
                <div class="item-icon" style="width: 24px; height: 24px;">
                    <img src="${TEXTURE_API}${btn.material.toLowerCase()}.png">
                </div>
                <div class="item-subtitle" style="overflow: hidden; text-overflow: ellipsis;">${parseMinecraftColors(btn.name) || 'Default'}</div>
            </div>
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

    Object.entries(transactionSettings.sell.buttons).forEach(([key, btn]) => {
        const el = document.createElement('div');
        el.className = 'shop-item';
        el.onclick = () => openTransactionButtonModal('sell', 'main', key);
        el.innerHTML = `
            <div class="flex justify-between items-center mb-8">
                <div class="item-title">${key.toUpperCase()}</div>
                <div class="item-subtitle" style="background: rgba(0,0,0,0.3); padding: 2px 8px; border-radius: 6px;">#${btn.slot}</div>
            </div>
            <div class="flex items-center gap-12">
                <div class="item-icon" style="width: 24px; height: 24px;">
                    <img src="${TEXTURE_API}${btn.material.toLowerCase()}.png">
                </div>
                <div class="item-subtitle" style="overflow: hidden; text-overflow: ellipsis;">${parseMinecraftColors(btn.name) || 'Default'}</div>
            </div>
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

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const backdrop = document.getElementById('mobile-menu-backdrop');
    if (menu.classList.contains('active')) {
        menu.classList.remove('active');
        backdrop.classList.remove('active');
    } else {
        menu.classList.add('active');
        backdrop.classList.add('active');
    }
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
