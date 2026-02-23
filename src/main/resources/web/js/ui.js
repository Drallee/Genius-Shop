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

function switchTab(tabName) {
    currentTab = tabName;

    // Toggle tab content visibility
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Toggle preview section visibility
    const previewSection = document.querySelector('.minecraft-preview-section');
    if (previewSection) {
        previewSection.style.display = (tabName === 'guisettings') ? 'none' : 'block';
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
    updateExport();
    updatePreviewSettingsBar();
    scheduleAutoSave();
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
        if (item.limit > 0) tagsHtml += `<span class="item-tag active">Player Limit: ${item.limit}</span>`;
        if (item.globalLimit > 0) tagsHtml += `<span class="item-tag active" style="background: rgba(255, 160, 0, 0.15); color: #ffa000; border-color: rgba(255, 160, 0, 0.3);">Global Limit: ${item.globalLimit}</span>`;
        if (item.permission) tagsHtml += `<span class="item-tag active" title="${escapeHtml(item.permission)}">Permission</span>`;
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
                    ${item.price > 0 ? `<div class="item-price-tag" style="color: var(--success);">$${formatDisplayPrice(item.price)}</div>` : ''}
                    ${item.sellPrice > 0 ? `<div class="item-price-tag" style="color: var(--danger);">$${formatDisplayPrice(item.sellPrice)}</div>` : ''}
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
            
            let extraHtml = '';
            
            // Add global GUI lore settings
            if (guiSettings.itemLore.showBuyPrice && item.price > 0) {
                const processed = guiSettings.itemLore.buyPriceLine.replace('%price%', '$' + formatDisplayPrice(item.price));
                extraHtml += `<div class="tooltip-line">${parseMinecraftColors(processed)}</div>`;
            }
            if (guiSettings.itemLore.showSellPrice && item.sellPrice > 0) {
                const processed = guiSettings.itemLore.sellPriceLine.replace('%sell-price%', '$' + formatDisplayPrice(item.sellPrice));
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

            // Replace placeholders in preview
            const processedLore = (shop.lore || []).map(line => 
                line.replace(/%available-times%/g, 'Available Times...')
                    .replace(/%version%/g, serverInfo.version || '1.0.0')
                    .replace(/%update-available%/g, '')
            );

            setupTooltip(slot, shop.name, processedLore);
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
            slot.onclick = () => openMainTransactionItemModal('purchase');
            setupTooltip(slot, "&eItem Preview", ["This is where the", "purchased item appears", "", "&7Click to edit"]);
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
            slot.onclick = () => openMainTransactionItemModal('sell');
            setupTooltip(slot, "&eItem Preview", ["This is where the", "sold item appears", "", "&7Click to edit"]);
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
