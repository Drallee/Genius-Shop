// ===== API INTERACTION =====

async function loadAllFiles() {
    try {
        isLoadingFiles = true;
        console.log('[LOAD] Starting to load files');
        showToast(t('web-editor.shop.loading'), 'info');
        if (typeof renderSkeletons === 'function') {
            renderSkeletons();
        } else {
            // Fallback skeleton while UI helpers are unavailable.
            const container = document.getElementById('items-container') || document.getElementById('mainmenu-shops-container');
            if (container) {
                container.innerHTML = '<div class="skeleton skeleton-item"></div><div class="skeleton skeleton-item"></div>';
            }
        }

        const response = await fetch(`api/files?t=${Date.now()}`, {
            headers: {
                'X-Session-Token': sessionToken
            }
        });

        if (response.status === 401) {
            showAlert(t('web-editor.modals.session-expired', 'Session expired. Please login again.'), 'warning');
            logout();
            return;
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Load server info
        if (data.serverInfo) {
            serverInfo = data.serverInfo;
            console.log('[LOAD] Server info:', serverInfo);
        }

        // Load shop files and populate dropdown
        if (data.shops) {
            allShops = data.shops;
            const shopSelector = document.getElementById('shop-file-selector');
            if (shopSelector) {
                shopSelector.innerHTML = '';
                const shopFiles = Object.keys(allShops).sort();
                shopFiles.forEach(filename => {
                    const option = document.createElement('option');
                    option.value = filename;
                    
                    option.textContent = filename;
                    
                    shopSelector.appendChild(option);
                });

                if (shopFiles.length > 0) {
                    if (allShops[currentShopFile]) {
                        shopSelector.value = currentShopFile;
                    } else {
                        currentShopFile = shopFiles[0];
                        shopSelector.value = currentShopFile;
                    }
                    loadShopFromData(currentShopFile);
                }
                shopSelector.dispatchEvent(new Event('refresh'));
            }
        }

        if (data.mainMenu) {
            parseMainMenuYaml(data.mainMenu);
            renderMainMenuShops();
        }

        if (data.purchaseMenu) {
            parsePurchaseMenuYaml(data.purchaseMenu);
            renderPurchaseButtons();
        }

        if (data.sellMenu) {
            parseSellMenuYaml(data.sellMenu);
            renderSellButtons();
        }

        if (data.guiSettings) {
            parseGuiSettingsYaml(data.guiSettings);
        }
        if (data.priceFormat) {
            parsePriceFormatPayload(data.priceFormat);
        }

        // Update preview based on current active tab
        const previewSection = document.querySelector('.minecraft-preview-section');
        if (previewSection) {
            previewSection.style.display = (currentTab === 'guisettings') ? 'none' : 'block';
        }

        if (currentTab === 'mainmenu') {
            updateGuiPreview();
        } else if (currentTab === 'purchase') {
            updatePurchasePreview();
        } else if (currentTab === 'sell') {
            updateSellPreview();
        } else if (currentTab === 'guisettings') {
            renderGuiSettings();
        }

        showToast(t('web-editor.modals.loaded'), 'success');
        isLoadingFiles = false;
        unsavedChanges = [];
    } catch (error) {
        console.error('Failed to load files:', error);
        showToast(t('web-editor.modals.load-failed'), 'error');
        showAlert(t('web-editor.modals.connect-error', 'Failed to connect to server') + ': ' + error.message + '\n\n' + t('web-editor.modals.api-hint', 'Make sure the API is enabled in config.yml and the port is open.'));
        isLoadingFiles = false;
    }
}

function loadShopFromData(filename) {
    if (!allShops[filename]) return;
    currentShopFile = filename;
    currentPreviewPage = 0;
    parseShopYaml(allShops[filename]);
    renderItems();
    updateAll();
}

async function saveCurrentShop(isSilent = false) {
    if (isSaving) return;

    const yamlContent = document.getElementById('export-output').textContent;

    if (allShops[currentShopFile] === yamlContent) {
        return;
    }

    isSaving = true;
    if (!isSilent) showToast(t('web-editor.modals.saving'), 'info');

    try {
        const response = await fetch(`api/file/shops/${currentShopFile}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': sessionToken
            },
            body: JSON.stringify({ content: yamlContent })
        });

        if (response.status === 401) {
            showAlert(t('web-editor.modals.session-expired', 'Session expired. Please login again.'), 'warning');
            logout();
            return;
        }

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (data.success) {
            allShops[currentShopFile] = yamlContent;
            if (!isSilent) {
                unsavedChanges = unsavedChanges.filter(c => {
                    if (c.target === 'shop-item' || c.target === 'shop-settings') {
                        return c.details && c.details.shopFile !== currentShopFile;
                    }
                    return true;
                });
                showToast(t('web-editor.modals.file-saved'), 'success');
            }
        }
    } catch (error) {
        console.error('Failed to save shop:', error);
        if (!isSilent) {
            showToast(t('web-editor.modals.save-failed'), 'error');
            showAlert(t('web-editor.modals.save-error', 'Failed to save file') + ': ' + error.message);
        }
        throw error;
    } finally {
        isSaving = false;
    }
}

async function saveMainMenuYaml(isSilent = false) {
    if (isLoadingFiles) return;
    if (!isSilent) showToast(t('web-editor.modals.saving'), 'info');

    try {
        let yamlContent = `# Main shop menu configuration\n`;
        yamlContent += `# This file contains the main menu that players see when opening /shop\n\n`;
        yamlContent += `title: '${mainMenuSettings.title}'\n`;
        yamlContent += `rows: ${mainMenuSettings.rows}\n\n`;
        yamlContent += `# Shop buttons\n`;
        yamlContent += `items:\n`;

        loadedGuiShops.forEach(shop => {
            yamlContent += `  ${shop.key}:\n`;
            yamlContent += `    slot: ${shop.slot}\n`;
            yamlContent += `    material: ${shop.material}\n`;
            yamlContent += `    name: '${shop.name}'\n`;
            if (shop.lore && shop.lore.length > 0) {
                yamlContent += `    lore:\n`;
                shop.lore.forEach(line => {
                    yamlContent += `      - '${line}'\n`;
                });
            }
            let action = (shop.action || '').toString().trim().toLowerCase();
            if (!action) {
                if (shop.shopKey) {
                    action = 'shop-key';
                } else if (Array.isArray(shop.commands) && shop.commands.length > 0) {
                    action = 'command';
                } else {
                    action = 'no-action';
                }
            }
            if (action) yamlContent += `    action: ${action}\n`;

            if (action === 'shop' || action === 'shop-key') {
                if (shop.shopKey) yamlContent += `    shop-key: ${shop.shopKey}\n`;
            } else if (action === 'command' || action === 'command-close') {
                const commands = Array.isArray(shop.commands) ? shop.commands.filter(line => line && line.trim()) : [];
                if (commands.length > 0) {
                    yamlContent += `    commands:\n`;
                    commands.forEach(line => {
                        yamlContent += `      - '${line}'\n`;
                    });
                }
                const runAs = (shop.runAs || 'player').toString().trim().toLowerCase();
                yamlContent += `    run-as: ${runAs === 'console' ? 'console' : 'player'}\n`;
            }

            if (shop.permission) yamlContent += `    permission: ${shop.permission}\n`;
            if (shop.hideAttributes) yamlContent += `    hide-attributes: true\n`;
            if (shop.hideAdditional) yamlContent += `    hide-additional: true\n`;
        });

        const response = await fetch(`api/file/menus/main-menu.yml`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': sessionToken
            },
            body: JSON.stringify({ content: yamlContent })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        if (!isSilent) {
            unsavedChanges = unsavedChanges.filter(c => c.target !== 'main-menu-button' && c.target !== 'main-menu-settings');
            showToast(t('web-editor.modals.file-saved'), 'success');
        }
        return true;
    } catch (error) {
        console.error('Failed to save main-menu.yml:', error);
        if (!isSilent) {
            showToast(t('web-editor.modals.save-failed'), 'error');
            showAlert(t('web-editor.modals.save-error', 'Failed to save file') + ': ' + error.message);
        }
        throw error;
    }
}

async function savePurchaseMenuYaml(isSilent = false) {
    if (isLoadingFiles) return;
    if (!isSilent) showToast(t('web-editor.modals.saving'), 'info');

    try {
        let yamlContent = `# Purchase menu configuration\n`;
        yamlContent += `# This file contains settings for the item purchase interface\n\n`;
        yamlContent += `title-prefix: '${transactionSettings.purchase.titlePrefix}'\n`;
        yamlContent += `rows: ${transactionSettings.purchase.rows || 6}\n`;
        yamlContent += `display-material: ${transactionSettings.purchase.displayMaterial}\n`;
        yamlContent += `display-slot: ${transactionSettings.purchase.displaySlot}\n`;
        yamlContent += `max-amount: ${transactionSettings.purchase.maxAmount}\n\n`;

        yamlContent += `# Display item lore placeholders\n`;
        yamlContent += `lore:\n`;
        yamlContent += `  amount: '${transactionSettings.purchase.lore.amount}'\n`;
        yamlContent += `  total: '${transactionSettings.purchase.lore.total}'\n`;
        yamlContent += `  spawner: '${transactionSettings.purchase.lore.spawner}'\n\n`;

        yamlContent += `# Action buttons\n`;
        yamlContent += `buttons:\n`;
        
        const p = transactionSettings.purchase;
        ['confirm', 'cancel', 'back'].forEach(key => {
            const btn = p.buttons[key];
            yamlContent += `  ${key}:\n`;
            yamlContent += `    material: ${btn.material}\n`;
            yamlContent += `    name: '${btn.name}'\n`;
            yamlContent += `    slot: ${btn.slot}\n`;
        });

        ['add', 'remove', 'set'].forEach(group => {
            yamlContent += `  ${group}:\n`;
            yamlContent += `    material: ${p[group].material}\n`;
            Object.entries(p[group].buttons).forEach(([key, btn]) => {
                yamlContent += `    '${key}':\n`;
                yamlContent += `      name: '${btn.name}'\n`;
                yamlContent += `      slot: ${btn.slot}\n`;
            });
        });

        const response = await fetch(`api/file/menus/purchase-menu.yml`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': sessionToken
            },
            body: JSON.stringify({ content: yamlContent })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        if (!isSilent) {
            unsavedChanges = unsavedChanges.filter(c => c.target !== 'purchase-menu-button' && c.target !== 'purchase-menu-settings');
            showToast(t('web-editor.modals.file-saved'), 'success');
        }
        return true;
    } catch (error) {
        console.error('Failed to save purchase-menu.yml:', error);
        if (!isSilent) {
            showToast(t('web-editor.modals.save-failed'), 'error');
            showAlert(t('web-editor.modals.save-error', 'Failed to save file') + ': ' + error.message);
        }
        throw error;
    }
}

async function saveSellMenuYaml(isSilent = false) {
    if (isLoadingFiles) return;
    if (!isSilent) showToast(t('web-editor.modals.saving'), 'info');

    try {
        let yamlContent = `# Sell menu configuration\n`;
        yamlContent += `# This file contains settings for the item sell interface\n\n`;
        yamlContent += `title-prefix: '${transactionSettings.sell.titlePrefix}'\n`;
        yamlContent += `rows: ${transactionSettings.sell.rows || 6}\n`;
        yamlContent += `display-material: ${transactionSettings.sell.displayMaterial}\n`;
        yamlContent += `display-slot: ${transactionSettings.sell.displaySlot}\n`;
        yamlContent += `max-amount: ${transactionSettings.sell.maxAmount}\n\n`;

        yamlContent += `# Display item lore placeholders\n`;
        yamlContent += `lore:\n`;
        yamlContent += `  amount: '${transactionSettings.sell.lore.amount}'\n`;
        yamlContent += `  total: '${transactionSettings.sell.lore.total}'\n\n`;

        yamlContent += `# Action buttons\n`;
        yamlContent += `buttons:\n`;
        
        const s = transactionSettings.sell;
        ['confirm', 'cancel', 'back', 'sellAll'].forEach(key => {
            const btn = s.buttons[key];
            if (!btn) return;
            yamlContent += `  ${key}:\n`;
            yamlContent += `    material: ${btn.material}\n`;
            yamlContent += `    name: '${btn.name}'\n`;
            yamlContent += `    slot: ${btn.slot}\n`;
        });

        ['add', 'remove', 'set'].forEach(group => {
            yamlContent += `  ${group}:\n`;
            yamlContent += `    material: ${s[group].material}\n`;
            Object.entries(s[group].buttons).forEach(([key, btn]) => {
                yamlContent += `    '${key}':\n`;
                yamlContent += `      name: '${btn.name}'\n`;
                yamlContent += `      slot: ${btn.slot}\n`;
            });
        });

        const response = await fetch(`api/file/menus/sell-menu.yml`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': sessionToken
            },
            body: JSON.stringify({ content: yamlContent })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        if (!isSilent) {
            unsavedChanges = unsavedChanges.filter(c => c.target !== 'sell-menu-button' && c.target !== 'sell-menu-settings');
            showToast(t('web-editor.modals.file-saved'), 'success');
        }
        return true;
    } catch (error) {
        console.error('Failed to save sell-menu.yml:', error);
        if (!isSilent) {
            showToast(t('web-editor.modals.save-failed'), 'error');
            showAlert(t('web-editor.modals.save-error', 'Failed to save file') + ': ' + error.message);
        }
        throw error;
    }
}

async function saveGuiSettingsYaml(isSilent = false) {
    if (isLoadingFiles) return;
    if (!isSilent) showToast(t('web-editor.modals.saving'), 'info');

    try {
        const yamlContent = generateGuiSettingsYaml();

        const response = await fetch(`api/file/menus/gui-settings.yml`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': sessionToken
            },
            body: JSON.stringify({ content: yamlContent })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        if (!isSilent) {
            unsavedChanges = unsavedChanges.filter(c => c.target !== 'gui-settings');
            showToast(t('web-editor.modals.file-saved'), 'success');
        }
        return true;
    } catch (error) {
        console.error('Failed to save gui-settings.yml:', error);
        if (!isSilent) {
            showToast(t('web-editor.modals.save-failed'), 'error');
            showAlert(t('web-editor.modals.save-error', 'Failed to save file') + ': ' + error.message);
        }
        throw error;
    }
}

async function reloadCurrentConfig() {
    const confirmed = await showConfirm(t('web-editor.modals.reload-confirm', 'Are you sure you want to reload all configurations from the server? Any unsaved changes will be lost.'));
    if (confirmed) {
        await loadAllFiles();
    }
}

async function logout() {
    const confirmed = await showConfirm(t('web-editor.modals.logout-confirm', 'Are you sure you want to logout?'));
    if (confirmed) {
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('username');
        window.location.href = 'login.html';
    }
}

async function confirmSave() {
    closeSaveConfirmationModal();
    
    if (activeSaveMode === 'publish') {
        showToast(t('web-editor.modals.publishing', 'Publishing...'), 'info');
        try {
            // Save all first
            await saveCurrentShop(true);
            await saveMainMenuYaml(true);
            await savePurchaseMenuYaml(true);
            await saveSellMenuYaml(true);
            await saveGuiSettingsYaml(true);
            
            unsavedChanges = [];
            showToast(t('web-editor.modals.publish-success'), 'success', t('web-editor.modals.published', 'Published'));
        } catch (error) {
            console.error('Publish failed:', error);
            showAlert(t('web-editor.modals.publish-error') + ': ' + error.message, 'error');
            showToast(t('web-editor.modals.publish-error'), 'error');
        }
        return;
    }

    if (currentTab === 'shop') {
        await saveCurrentShop();
    } else if (currentTab === 'mainmenu') {
        await saveMainMenuYaml();
    } else if (currentTab === 'purchase') {
        await savePurchaseMenuYaml();
    } else if (currentTab === 'sell') {
        await saveSellMenuYaml();
    } else if (currentTab === 'guisettings') {
        await saveGuiSettingsYaml();
    }
}

async function publishChanges() {
    openSaveConfirmationModal('publish');
}

async function createNewShop() {
    const name = await showPrompt(t('web-editor.modals.enter-filename', 'Enter new shop filename (e.g. tools.yml):'), 'new-shop.yml', t('web-editor.shop.create-new'));
    if (name) {
        const filename = name.endsWith('.yml') ? name : name + '.yml';
        if (allShops[filename]) {
            showAlert(t('web-editor.modals.shop-exists', 'A shop with this name already exists!'), 'error');
            return;
        }

        const initialYaml = `gui-name: '&8New Shop'\nrows: 3\nitems: []`;
        allShops[filename] = initialYaml;
        
        // Add to dropdown
        const shopSelector = document.getElementById('shop-file-selector');
        if (shopSelector) {
            const option = document.createElement('option');
            option.value = filename;
            option.textContent = filename;
            shopSelector.appendChild(option);
            shopSelector.value = filename;
            shopSelector.dispatchEvent(new Event('refresh'));
        }
        
        currentShopFile = filename;
        
        loadShopFromData(filename);
        await saveCurrentShop();
        showToast(t('web-editor.modals.shop-created'), 'success');
    }
}

async function removeShopFile() {
    const confirmed = await showConfirm(t('web-editor.modals.remove-file-confirm', {file: currentShopFile}));
    if (confirmed) {
        try {
            const response = await fetch(`api/file/shops/${currentShopFile}`, {
                method: 'DELETE',
                headers: {
                    'X-Session-Token': sessionToken
                }
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            delete allShops[currentShopFile];
            showToast(t('web-editor.modals.shop-removed'), 'success');
            await loadAllFiles();
        } catch (error) {
            console.error('Failed to delete shop:', error);
            showAlert(t('web-editor.modals.delete-error', 'Failed to delete') + ': ' + error.message, 'error');
        }
    }
}

async function handleAutoLogin(token) {
    try {
        const response = await fetch(`api/autologin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('sessionToken', data.sessionToken);
            localStorage.setItem('username', data.username);
            sessionToken = data.sessionToken;
            username = data.username;
            currentUsername = data.username;
            
            window.history.replaceState({}, document.title, window.location.pathname);
            window.location.reload();
        } else {
            document.body.innerHTML = `<div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #000; color: #fff; font-family: Inter, sans-serif; flex-direction: column; gap: 20px;"><div style="font-size: 24px; color: #ff5555;">Login Failed</div><div style="font-size: 14px; color: #888;">${data.message || 'Invalid or expired token'}</div><button onclick="window.location.href='login.html'" style="padding: 10px 20px; background: #333; border: 1px solid #444; color: #fff; border-radius: 5px; cursor: pointer; margin-top: 10px;">Go to Login Page</button></div>`;
        }
    } catch (error) {
        console.error('Auto-login error:', error);
        document.body.innerHTML = `<div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #000; color: #fff; font-family: Inter, sans-serif; flex-direction: column; gap: 20px;"><div style="font-size: 24px; color: #ff5555;">Connection Error</div><div style="font-size: 14px; color: #888;">Could not connect to the API server</div></div>`;
    }
}


