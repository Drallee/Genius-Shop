// ===== UI RENDERING & PREVIEW =====

function switchTab(tabName) {
    currentTab = tabName;

    // Toggle tab content visibility
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Toggle preview section visibility
    const previewSection = document.querySelector('.minecraft-preview-section');
    if (previewSection) {
        previewSection.style.display = tabName === 'guisettings' ? 'none' : 'block';
    }
    
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
    } else if (tabName === 'guisettings') {
        renderGuiSettings();
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
    let maxSlot = items.length > 0 ? Math.max(...items.map(it => it.slot || 0)) : 0;
    const maxPage = Math.ceil((maxSlot + 1) / itemsPerPage) - 1;
    
    currentPreviewPage += direction;
    if (currentPreviewPage < 0) currentPreviewPage = 0;
    
    // Allow going beyond the current maximum if dragging an item to create new pages
    const allowedMax = draggedSlotIndex !== null ? Math.max(maxPage + 1, currentPreviewPage) : maxPage;
    if (currentPreviewPage > allowedMax) currentPreviewPage = allowedMax;
    
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

        const rows = (currentShopSettings && currentShopSettings.rows) ? currentShopSettings.rows : 3;
        const itemsPerPage = rows * 9;
        const page = Math.floor(item.slot / itemsPerPage) + 1;
        const slotOnPage = item.slot % itemsPerPage;

        itemEl.innerHTML = `
            <div class="item-header">
                <div class="item-icon">
                    <img src="${TEXTURE_API}${item.material.toLowerCase()}.png" onerror="this.src='${TEXTURE_API}stone.png'">
                </div>
                <div class="flex-1">
                    <div class="item-title">${parseMinecraftColors(item.name)}</div>
                    <div class="item-subtitle">
                        ${escapeHtml(item.material)} × ${item.amount}
                        <span style="margin-left: 8px; opacity: 0.6; font-size: 0.9em;">(Page ${page}, Slot ${slotOnPage})</span>
                    </div>
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

    const rows = currentShopSettings.rows || 3;
    const itemsPerPage = rows * 9;

    // Calculate total pages based on max slot
    let maxSlot = items.length > 0 ? Math.max(...items.map(it => it.slot || 0)) : 0;
    const totalPages = Math.ceil((maxSlot + 1) / itemsPerPage);
    
    const guiName = currentShopSettings.guiName;
    const titleElement = document.getElementById('preview-title');
    if (titleElement) titleElement.innerHTML = parseMinecraftColors(guiName);
    
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
            
            slot.innerHTML = `<div class="item-icon"><img src="${TEXTURE_API}${item.material.toLowerCase()}.png" onerror="this.src='${TEXTURE_API}stone.png'"></div>`;
            if (item.amount > 1) {
                slot.innerHTML += `<div class="slot-amount">${item.amount}</div>`;
            }

            if (item.enchantments && Object.keys(item.enchantments).length > 0) {
                slot.classList.add('enchanted');
            }
            
            slot.onclick = () => openShopItemModal(item.id);
            
            let extraHtml = '';
            
            // Add global GUI lore settings
            if (guiSettings.itemLore.showBuyPrice && item.price > 0) {
                const processed = guiSettings.itemLore.buyPriceLine.replace('%price%', '$' + item.price);
                extraHtml += `<div class="tooltip-line">${parseMinecraftColors(processed)}</div>`;
            }
            if (guiSettings.itemLore.showSellPrice && item.sellPrice > 0) {
                const processed = guiSettings.itemLore.sellPriceLine.replace('%sell-price%', '$' + item.sellPrice);
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

// ===== DRAG AND DROP HANDLERS =====

function handleDragStart(e, index, source) {
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
    e.stopPropagation();
    e.preventDefault();
    
    document.querySelectorAll('.gui-slot').forEach(slot => {
        slot.classList.remove('drag-over');
        slot.classList.remove('dragging');
    });

    if (draggedSlotIndex === null || draggedItemSource !== source) return;
    if (draggedSlotIndex === targetIndex) return;

    if (source === 'shop') {
        const rows = currentShopSettings.rows || 3;
        const itemsPerPage = rows * 9;
        const fromAbsoluteSlot = (draggedFromPage * itemsPerPage) + draggedSlotIndex;
        const toAbsoluteSlot = (currentPreviewPage * itemsPerPage) + targetIndex;

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
        }
    } else if (source === 'mainmenu') {
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
        }
    } else if (source === 'purchase' || source === 'sell') {
        const settings = transactionSettings[source];
        
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
        <div class="settings-group card-base">
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

        <div class="settings-group card-base">
            <h3 class="group-title">Item Lore & Price Display</h3>
            <div class="settings-grid">
                <div class="setting-item">
                    <label>Show Buy Price</label>
                    <input type="checkbox" id="gui-show-buy-price" ${guiSettings.itemLore.showBuyPrice ? 'checked' : ''} onchange="updateGuiSetting('itemLore', 'showBuyPrice', this.checked)">
                </div>
                <div class="setting-item">
                    <label>Buy Price Line</label>
                    <input type="text" value="${guiSettings.itemLore.buyPriceLine}" onchange="updateGuiSetting('itemLore', 'buyPriceLine', this.value)">
                </div>
                <div class="setting-item">
                    <label>Show Sell Price</label>
                    <input type="checkbox" id="gui-show-sell-price" ${guiSettings.itemLore.showSellPrice ? 'checked' : ''} onchange="updateGuiSetting('itemLore', 'showSellPrice', this.checked)">
                </div>
                <div class="setting-item">
                    <label>Sell Price Line</label>
                    <input type="text" value="${guiSettings.itemLore.sellPriceLine}" onchange="updateGuiSetting('itemLore', 'sellPriceLine', this.value)">
                </div>
                <div class="setting-item">
                    <label>Show Buy Hint</label>
                    <input type="checkbox" id="gui-show-buy-hint" ${guiSettings.itemLore.showBuyHint ? 'checked' : ''} onchange="updateGuiSetting('itemLore', 'showBuyHint', this.checked)">
                </div>
                <div class="setting-item">
                    <label>Buy Hint Line</label>
                    <input type="text" value="${guiSettings.itemLore.buyHintLine}" onchange="updateGuiSetting('itemLore', 'buyHintLine', this.value)">
                </div>
                <div class="setting-item">
                    <label>Show Sell Hint</label>
                    <input type="checkbox" id="gui-show-sell-hint" ${guiSettings.itemLore.showSellHint ? 'checked' : ''} onchange="updateGuiSetting('itemLore', 'showSellHint', this.checked)">
                </div>
                <div class="setting-item">
                    <label>Sell Hint Line</label>
                    <input type="text" value="${guiSettings.itemLore.sellHintLine}" onchange="updateGuiSetting('itemLore', 'sellHintLine', this.value)">
                </div>
                <div class="setting-item">
                    <label>Amount Line (Transaction Menu)</label>
                    <input type="text" value="${guiSettings.itemLore.amountLine}" onchange="updateGuiSetting('itemLore', 'amountLine', this.value)">
                </div>
                <div class="setting-item">
                    <label>Total Line (Transaction Menu)</label>
                    <input type="text" value="${guiSettings.itemLore.totalLine}" onchange="updateGuiSetting('itemLore', 'totalLine', this.value)">
                </div>
            </div>
        </div>
    `;
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
                setupTooltip(slot, btn.name, [`Slot: ${btn.slot}`, `Material: ${btn.material}`]);
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
                    setupTooltip(slot, btn.name, [`Slot: ${btn.slot}`, `Action: ${group.toUpperCase()} ${amount}`]);
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
                setupTooltip(slot, btn.name, [`Slot: ${btn.slot}`, `Material: ${btn.material}`]);
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
                    setupTooltip(slot, btn.name, [`Slot: ${btn.slot}`, `Action: ${group.toUpperCase()} ${amount}`]);
                }
            });
        });

        if (i === settings.displaySlot) {
            slot.draggable = true;
            slot.ondragstart = (e) => handleDragStart(e, i, 'sell');
            slot.classList.add('filled');
            slot.style.backgroundColor = 'rgba(255, 165, 0, 0.15)'; // Special color for display slot

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
