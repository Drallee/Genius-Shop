// ===== API INTERACTION =====

async function loadAllFiles() {
    try {
        console.log('[LOAD] Starting to load files');
        updateSaveStatus('Loading files...', '#ffaa00');

        const response = await fetch(`api/files?t=${Date.now()}`, {
            headers: {
                'X-Session-Token': sessionToken
            }
        });

        if (response.status === 401) {
            showAlert('Session expired. Please login again.', 'warning');
            logout();
            return;
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Load shop files and populate dropdown
        if (data.shops) {
            allShops = data.shops;
            const shopSelector = document.getElementById('shop-selector');
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

        // Update preview based on current active tab
        if (currentTab === 'mainmenu') {
            updateGuiPreview();
        } else if (currentTab === 'purchase') {
            updatePurchasePreview();
        } else if (currentTab === 'sell') {
            updateSellPreview();
        }

        updateSaveStatus('✓ Loaded', '#55ff55');
        setTimeout(() => updateSaveStatus(''), 2000);
        isLoadingFiles = false;
        unsavedChanges = [];
    } catch (error) {
        console.error('Failed to load files:', error);
        updateSaveStatus('✗ Load failed', '#ff5555');
        showAlert('Failed to connect to server: ' + error.message + '\n\nMake sure the API is enabled in config.yml and the port is open.');
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
    if (!isSilent) updateSaveStatus('Saving...', '#ffaa00');

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
            showAlert('Session expired. Please login again.', 'warning');
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
                updateSaveStatus('✓ Saved', '#55ff55');
                showToast('Configuration saved successfully', 'success');
                setTimeout(() => updateSaveStatus(''), 2000);
            }
        }
    } catch (error) {
        console.error('Failed to save shop:', error);
        if (!isSilent) {
            updateSaveStatus('✗ Save failed', '#ff5555');
            showAlert('Failed to save: ' + error.message);
        }
        throw error;
    } finally {
        isSaving = false;
    }
}

async function saveMainMenuYaml(isSilent = false) {
    if (isLoadingFiles) return;
    if (!isSilent) updateSaveStatus('Saving Main Menu...', '#ffaa00');

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
            if (shop.shopKey) yamlContent += `    shop-key: ${shop.shopKey}\n`;
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
            updateSaveStatus('✓ Saved', '#55ff55');
            showToast('Main Menu configuration saved', 'success');
            setTimeout(() => updateSaveStatus(''), 2000);
        }
        return true;
    } catch (error) {
        console.error('Failed to save main-menu.yml:', error);
        if (!isSilent) {
            updateSaveStatus('✗ Save failed', '#ff5555');
            showAlert('Failed to save main-menu.yml: ' + error.message);
        }
        throw error;
    }
}

async function savePurchaseMenuYaml(isSilent = false) {
    if (isLoadingFiles) return;
    if (!isSilent) updateSaveStatus('Saving Purchase Menu...', '#ffaa00');

    try {
        let yamlContent = `# Purchase menu configuration\n`;
        yamlContent += `# This file contains settings for the item purchase interface\n\n`;
        yamlContent += `title-prefix: '${transactionSettings.purchase.titlePrefix}'\n`;
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
            updateSaveStatus('✓ Saved', '#55ff55');
            showToast('Purchase Menu configuration saved', 'success');
            setTimeout(() => updateSaveStatus(''), 2000);
        }
        return true;
    } catch (error) {
        console.error('Failed to save purchase-menu.yml:', error);
        if (!isSilent) {
            updateSaveStatus('✗ Save failed', '#ff5555');
            showAlert('Failed to save purchase-menu.yml: ' + error.message);
        }
        throw error;
    }
}

async function saveSellMenuYaml(isSilent = false) {
    if (isLoadingFiles) return;
    if (!isSilent) updateSaveStatus('Saving Sell Menu...', '#ffaa00');

    try {
        let yamlContent = `# Sell menu configuration\n`;
        yamlContent += `# This file contains settings for the item sell interface\n\n`;
        yamlContent += `title-prefix: '${transactionSettings.sell.titlePrefix}'\n`;
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
            updateSaveStatus('✓ Saved', '#55ff55');
            showToast('Sell Menu configuration saved', 'success');
            setTimeout(() => updateSaveStatus(''), 2000);
        }
        return true;
    } catch (error) {
        console.error('Failed to save sell-menu.yml:', error);
        if (!isSilent) {
            updateSaveStatus('✗ Save failed', '#ff5555');
            showAlert('Failed to save sell-menu.yml: ' + error.message);
        }
        throw error;
    }
}

async function reloadCurrentConfig() {
    const confirmed = await showConfirm('Are you sure you want to reload all configurations from the server? Any unsaved changes will be lost.');
    if (confirmed) {
        await loadAllFiles();
    }
}

async function logout() {
    const confirmed = await showConfirm('Are you sure you want to logout?');
    if (confirmed) {
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('username');
        window.location.href = 'login.html';
    }
}

async function confirmSave() {
    closeSaveConfirmationModal();
    
    if (activeSaveMode === 'publish') {
        updateSaveStatus('Publishing...', '#ffaa00');
        try {
            // Save all first
            await saveCurrentShop(true);
            await saveMainMenuYaml(true);
            await savePurchaseMenuYaml(true);
            await saveSellMenuYaml(true);
            
            unsavedChanges = [];
            showToast('All changes published and plugin reloaded!', 'success', 'Published');
            updateSaveStatus('✓ Published', '#55ff55');
            setTimeout(() => updateSaveStatus(''), 2000);
        } catch (error) {
            console.error('Publish failed:', error);
            showAlert('Publish failed: ' + error.message, 'error');
            updateSaveStatus('✗ Publish failed', '#ff5555');
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
    }
}

async function publishChanges() {
    openSaveConfirmationModal('publish');
}

async function createNewShop() {
    const name = await showPrompt('Enter new shop filename (e.g. tools.yml):', 'new-shop.yml', 'Create New Shop');
    if (name) {
        const filename = name.endsWith('.yml') ? name : name + '.yml';
        if (allShops[filename]) {
            showAlert('A shop with this name already exists!', 'error');
            return;
        }

        const initialYaml = `gui-name: '&8New Shop'\nrows: 3\nitems: []`;
        allShops[filename] = initialYaml;
        
        // Add to dropdown
        const shopSelector = document.getElementById('shop-selector');
        const option = document.createElement('option');
        option.value = filename;
        option.textContent = filename;
        shopSelector.appendChild(option);
        
        currentShopFile = filename;
        shopSelector.value = filename;
        
        loadShopFromData(filename);
        await saveCurrentShop();
        showToast(`Created new shop: ${filename}`, 'success');
    }
}

async function removeShopFile() {
    const confirmed = await showConfirm(`Are you sure you want to PERMANENTLY DELETE ${currentShopFile} from the server? This cannot be undone!`);
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
            showToast(`Deleted ${currentShopFile}`, 'success');
            await loadAllFiles();
        } catch (error) {
            console.error('Failed to delete shop:', error);
            showAlert('Failed to delete: ' + error.message, 'error');
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
            document.body.innerHTML = `<div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #000; color: #fff; font-family: Inter, sans-serif; flex-direction: column; gap: 20px;"><div style="font-size: 24px; color: #ff5555;">❌ Login Failed</div><div style="font-size: 14px; color: #888;">${data.message || 'Invalid or expired token'}</div><button onclick="window.location.href='login.html'" style="padding: 10px 20px; background: #333; border: 1px solid #444; color: #fff; border-radius: 5px; cursor: pointer; margin-top: 10px;">Go to Login Page</button></div>`;
        }
    } catch (error) {
        console.error('Auto-login error:', error);
        document.body.innerHTML = `<div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #000; color: #fff; font-family: Inter, sans-serif; flex-direction: column; gap: 20px;"><div style="font-size: 24px; color: #ff5555;">❌ Connection Error</div><div style="font-size: 14px; color: #888;">Could not connect to the API server</div></div>`;
    }
}
