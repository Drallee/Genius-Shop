// ===== MODAL HANDLING =====

// Custom alert function
function showToast(message, type = 'info', title = null) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    if (!title) {
        title = type.charAt(0).toUpperCase() + type.slice(1);
    }

    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || 'ℹ️'}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => {
            toast.remove();
        }, 400);
    }, 4000);
}

function showAlert(message, type = 'info') {
    const modal = document.getElementById('alert-modal');
    const icon = document.getElementById('alert-modal-icon');
    const titleText = document.getElementById('alert-modal-title-text');
    const content = document.getElementById('alert-modal-content');

    // Set icon and title based on type
    if (type === 'error') {
        icon.textContent = '❌';
        titleText.textContent = t('web-editor.modals.error-title', 'Error');
        modal.querySelector('.modal-box').style.borderColor = 'rgba(255, 107, 107, 0.3)';
    } else if (type === 'success') {
        icon.textContent = '✅';
        titleText.textContent = t('web-editor.modals.success-title', 'Success');
        modal.querySelector('.modal-box').style.borderColor = 'rgba(0, 230, 118, 0.3)';
    } else if (type === 'warning') {
        icon.textContent = '⚠️';
        titleText.textContent = t('web-editor.modals.warning-title', 'Warning');
        modal.querySelector('.modal-box').style.borderColor = 'rgba(255, 215, 0, 0.3)';
    } else {
        icon.textContent = 'ℹ️';
        titleText.textContent = t('web-editor.modals.alert-title', 'Message');
        modal.querySelector('.modal-box').style.borderColor = 'rgba(120, 119, 198, 0.3)';
    }

    content.textContent = message;

    const animationsDisabled = document.body.classList.contains('no-animations');
    modal.style.display = 'flex';

    const modalBox = modal.querySelector('.modal-box');
    if (modalBox && !animationsDisabled) {
        modalBox.style.animation = 'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
    } else if (modalBox) {
        modalBox.style.animation = 'none';
    }
}

function closeAlertModal() {
    const modal = document.getElementById('alert-modal');
    const animationsDisabled = document.body.classList.contains('no-animations');

    const modalBox = modal.querySelector('.modal-box');
    if (modalBox && !animationsDisabled) {
        modalBox.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    } else {
        modal.style.display = 'none';
    }
}

// Custom confirm function
let confirmCallback = null;

function showConfirm(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const content = document.getElementById('confirm-modal-content');

        content.textContent = message;
        confirmCallback = resolve;

        const animationsDisabled = document.body.classList.contains('no-animations');
        modal.style.display = 'flex';

        const modalBox = modal.querySelector('.modal-box');
        if (modalBox && !animationsDisabled) {
            modalBox.style.animation = 'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
        } else if (modalBox) {
            modalBox.style.animation = 'none';
        }
    });
}

function closeConfirmModal(result) {
    const modal = document.getElementById('confirm-modal');
    const animationsDisabled = document.body.classList.contains('no-animations');

    const modalBox = modal.querySelector('.modal-box');
    if (modalBox && !animationsDisabled) {
        modalBox.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            modal.style.display = 'none';
            if (confirmCallback) {
                confirmCallback(result);
                confirmCallback = null;
            }
        }, 300);
    } else {
        modal.style.display = 'none';
        if (confirmCallback) {
            confirmCallback(result);
            confirmCallback = null;
        }
    }
}

// Custom prompt function
let promptCallback = null;
function showPrompt(message, defaultValue = '', title = 'Enter Value') {
    return new Promise((resolve) => {
        const modal = document.getElementById('prompt-modal');
        const titleText = document.getElementById('prompt-modal-title-text');
        const content = document.getElementById('prompt-modal-content');
        const input = document.getElementById('prompt-modal-input');

        titleText.textContent = title;
        content.textContent = message;
        input.value = defaultValue;
        promptCallback = resolve;

        const animationsDisabled = document.body.classList.contains('no-animations');
        modal.style.display = 'flex';

        const modalBox = modal.querySelector('.modal-box');
        if (modalBox && !animationsDisabled) {
            modalBox.style.animation = 'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
        } else if (modalBox) {
            modalBox.style.animation = 'none';
        }

        // Focus input and select text
        setTimeout(() => {
            input.focus();
            input.select();
        }, 100);

        // Handle Enter key
        input.onkeypress = (e) => {
            if (e.key === 'Enter') {
                submitPromptModal();
            }
        };

        // Handle Escape key
        input.onkeydown = (e) => {
            if (e.key === 'Escape') {
                closePromptModal(null);
            }
        };
    });
}

function closePromptModal(result) {
    const modal = document.getElementById('prompt-modal');
    const input = document.getElementById('prompt-modal-input');
    const animationsDisabled = document.body.classList.contains('no-animations');

    // Clear event handlers
    input.onkeypress = null;
    input.onkeydown = null;

    const modalBox = modal.querySelector('.modal-box');
    if (modalBox && !animationsDisabled) {
        modalBox.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            modal.style.display = 'none';
            if (promptCallback) {
                promptCallback(result);
                promptCallback = null;
            }
        }, 300);
    } else {
        modal.style.display = 'none';
        if (promptCallback) {
            promptCallback(result);
            promptCallback = null;
        }
    }
}

function submitPromptModal() {
    const input = document.getElementById('prompt-modal-input');
    closePromptModal(input.value);
}

function openSaveConfirmationModal(mode = 'tab') {
    activeSaveMode = mode;
    const modal = document.getElementById('save-confirmation-modal');
    const content = document.getElementById('save-confirmation-content');
    
    // Update modal header and button based on mode
    const modalTitleIcon = modal.querySelector('.modal-header .modal-title span:first-child');
    const modalTitleText = modal.querySelector('.modal-header .modal-title span:last-child');
    const confirmBtn = modal.querySelector('.modal-footer .btn-success');

    if (mode === 'publish') {
        if (modalTitleIcon) modalTitleIcon.textContent = '🚀';
        if (modalTitleText) modalTitleText.textContent = 'Confirm Publish';
        if (confirmBtn) confirmBtn.innerHTML = '<span>🚀 PUBLISH ALL CHANGES</span>';
    } else {
        if (modalTitleIcon) modalTitleIcon.textContent = '💾';
        if (modalTitleText) modalTitleText.textContent = 'Confirm Save';
        if (confirmBtn) confirmBtn.innerHTML = '<span>💾 SAVE CURRENT TAB</span>';
    }

    // Helper to determine if a change belongs to the current tab
    const isChangeForCurrentTab = (change) => {
        if (currentTab === 'shop') {
            return (change.target === 'shop-item' || change.target === 'shop-settings') && 
                   (!change.details || change.details.shopFile === currentShopFile);
        }
        if (currentTab === 'mainmenu') {
            return change.target === 'main-menu-button' || change.target === 'main-menu-settings';
        }
        if (currentTab === 'purchase') {
            return change.target === 'purchase-menu-button' || change.target === 'purchase-menu-settings';
        }
        if (currentTab === 'sell') {
            return change.target === 'sell-menu-button' || change.target === 'sell-menu-settings';
        }
        return false;
    };

    // Helper to render a change item
    const renderChangeItem = (change, isDimmed = false) => {
        const icon = change.action === 'created' ? '➕' : change.action === 'updated' ? '✏️' : '🗑️';
        const color = change.action === 'created' ? 'rgba(0, 230, 118, 0.15)' : change.action === 'updated' ? 'rgba(255, 215, 0, 0.15)' : 'rgba(255, 107, 107, 0.15)';
        const borderColor = change.action === 'created' ? 'rgba(0, 230, 118, 0.25)' : change.action === 'updated' ? 'rgba(255, 215, 0, 0.25)' : 'rgba(255, 107, 107, 0.25)';

        return `
            <div style="background: ${color}; border: 1px solid ${borderColor}; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; display: flex; align-items: center; gap: 12px; ${isDimmed ? 'opacity: 0.6; filter: grayscale(0.3);' : ''}">
                <span style="font-size: 1.2em; flex-shrink: 0;">${icon}</span>
                <div style="flex: 1; min-width: 0;">
                    <div style="color: rgba(220, 230, 245, 0.95); font-size: 0.85em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(change.description)}">
                        ${escapeHtml(change.description)}
                    </div>
                </div>
            </div>
        `;
    };

    let html = '';

    if (mode === 'publish') {
        if (unsavedChanges.length > 0) {
            html += `
                <div style="margin-bottom: 24px;">
                    <div style="display: flex; align-items: center; gap: 8px; color: #00e676; margin-bottom: 12px; padding-left: 4px;">
                        <span style="font-size: 1.1em;">🚀</span>
                        <span style="font-size: 0.85em; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Publishing All Changes (${unsavedChanges.length})</span>
                    </div>
                    <div style="max-height: 350px; overflow-y: auto; padding-right: 6px; background: rgba(0,0,0,0.15); padding: 12px; border-radius: 14px; border: 1px solid rgba(0, 230, 118, 0.2);">
                        ${unsavedChanges.map(change => renderChangeItem(change)).join('')}
                    </div>
                </div>
                <div style="background: rgba(0, 230, 118, 0.05); border: 1px solid rgba(0, 230, 118, 0.15); border-radius: 12px; padding: 14px; margin-top: 20px; display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 1.2em;">🛰️</span>
                    <span style="font-size: 0.85em; color: rgba(255,255,255,0.8);">All configurations will be saved and the plugin will be reloaded on the server.</span>
                </div>
            `;
        } else {
            html = `
                <div style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 3em; margin-bottom: 16px; opacity: 0.7;">🚀</div>
                    <p style="color: rgba(220, 230, 245, 0.95); margin: 0; font-size: 1.1em;">
                        Publish <strong>all configurations</strong> to the server?
                    </p>
                    <p style="color: rgba(180, 190, 210, 0.7); margin: 12px 0 0 0; font-size: 0.9em;">
                        No tracked changes detected, but you can still force a full publish and reload.
                    </p>
                </div>
            `;
        }
    } else {
        const savingNow = unsavedChanges.filter(isChangeForCurrentTab);
        const savingLater = unsavedChanges.filter(c => !isChangeForCurrentTab(c));

        if (unsavedChanges.length > 0) {
            // Saving Now Section
            if (savingNow.length > 0) {
                html += `
                    <div style="margin-bottom: 24px;">
                        <div style="display: flex; align-items: center; gap: 8px; color: #55ff55; margin-bottom: 12px; padding-left: 4px;">
                            <span style="font-size: 1.1em;">💾</span>
                            <span style="font-size: 0.85em; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Saving to this tab (${savingNow.length})</span>
                        </div>
                        <div style="max-height: 240px; overflow-y: auto; padding-right: 6px; background: rgba(0,0,0,0.15); padding: 12px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.05);">
                            ${savingNow.map(change => renderChangeItem(change)).join('')}
                        </div>
                    </div>
                `;
            }

            // Saving Later Section
            if (savingLater.length > 0) {
                html += `
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; color: rgba(255, 215, 0, 0.7); margin-bottom: 12px; padding-left: 4px;">
                            <span style="font-size: 1.1em;">⏳</span>
                            <span style="font-size: 0.85em; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Not saving yet (other tabs: ${savingLater.length})</span>
                        </div>
                        <div style="max-height: 180px; overflow-y: auto; padding-right: 6px; background: rgba(0,0,0,0.1); padding: 12px; border-radius: 14px; border: 1px dashed rgba(255,255,255,0.1);">
                            ${savingLater.map(change => renderChangeItem(change, true)).join('')}
                        </div>
                    </div>
                `;
            }

            if (savingNow.length === 0 && savingLater.length > 0) {
                html += `
                    <div style="background: rgba(255, 107, 107, 0.1); border: 1px solid rgba(255, 107, 107, 0.2); border-radius: 12px; padding: 16px; margin-top: 20px; text-align: center;">
                        <div style="color: #ff6b6b; font-size: 0.9em; font-weight: 600;">
                            ⚠️ This tab has no unsaved changes. 
                        </div>
                        <div style="color: rgba(255,255,255,0.5); font-size: 0.8em; margin-top: 4px;">
                            Changes in other tabs will remain until you save them.
                        </div>
                    </div>
                `;
            } else {
                 html += `
                    <div style="background: rgba(85, 255, 85, 0.05); border: 1px solid rgba(85, 255, 85, 0.15); border-radius: 12px; padding: 14px; margin-top: 20px; display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 1.2em;">💡</span>
                        <span style="font-size: 0.85em; color: rgba(255,255,255,0.8);">Only the current tab's configuration will be updated on the server.</span>
                    </div>
                `;
            }
        } else {
            html = `
                <div style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 3em; margin-bottom: 16px; opacity: 0.7;">💾</div>
                    <p style="color: rgba(220, 230, 245, 0.95); margin: 0; font-size: 1.1em;">
                        Save <strong>current tab only</strong> to the server?
                    </p>
                    <p style="color: rgba(180, 190, 210, 0.7); margin: 12px 0 0 0; font-size: 0.9em;">
                        No tracked changes detected, but you can still force a save.
                    </p>
                </div>
            `;
        }
    }

    content.innerHTML = html;

    const animationsDisabled = document.body.classList.contains('no-animations');
    modal.style.display = 'flex';

    const modalBox = modal.querySelector('.modal-box');
    if (modalBox && !animationsDisabled) {
        modalBox.style.animation = 'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
    } else if (modalBox) {
        modalBox.style.animation = 'none';
    }
}

function closeSaveConfirmationModal() {
    const modal = document.getElementById('save-confirmation-modal');
    const animationsDisabled = document.body.classList.contains('no-animations');

    const modalBox = modal.querySelector('.modal-box');
    if (modalBox && !animationsDisabled) {
        modalBox.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    } else {
        modal.style.display = 'none';
    }
}

function openEditModal(data) {
    currentModalData = data;
    const modal = document.getElementById('edit-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    const deleteBtn = document.getElementById('modal-delete-btn');

    modalTitle.textContent = data.title || 'Edit Item';

    // Generate content from fields array or use provided content
    if (data.fields && Array.isArray(data.fields)) {
        let html = '';
        data.fields.forEach(field => {
            html += '<div class="form-group">';

            if (field.type === 'checkbox') {
                html += `<label class="flex items-center gap-8 cursor-pointer">`;
                html += `<input type="checkbox" id="${field.id}" ${field.value ? 'checked' : ''}>`;
                html += `<span>${escapeHtml(field.label)}</span>`;
                html += `</label>`;
            } else if (field.type === 'select') {
                html += `<label class="section-label">${escapeHtml(field.label)}</label>`;
                html += `<select id="${field.id}" class="select-base">`;
                if (field.options) {
                    field.options.forEach(opt => {
                        const val = typeof opt === 'string' ? opt : opt.value;
                        const lab = typeof opt === 'string' ? opt : opt.label;
                        html += `<option value="${escapeHtml(val)}" ${val === field.value ? 'selected' : ''}>${escapeHtml(lab)}</option>`;
                    });
                }
                html += `</select>`;
            } else {
                html += `<label class="section-label">${escapeHtml(field.label)}</label>`;

                if (field.type === 'textarea') {
                    html += `<textarea id="${field.id}" class="textarea-base" placeholder="${escapeHtml(field.placeholder || '')}">${escapeHtml(field.value || '')}</textarea>`;
                } else if (field.type === 'number') {
                    html += `<input type="number" id="${field.id}" class="input-base" value="${escapeHtml(field.value || '')}" min="${field.min || ''}" max="${field.max || ''}" placeholder="${escapeHtml(field.placeholder || '')}">`;
                } else {
                    html += `<input type="text" id="${field.id}" class="input-base" value="${escapeHtml(field.value || '')}" placeholder="${escapeHtml(field.placeholder || '')}">`;
                }
            }

            if (field.hint) {
                html += `<small class="input-hint">${escapeHtml(field.hint)}</small>`;
            }
            html += '</div>';
        });
        modalContent.innerHTML = html;
    } else {
        modalContent.innerHTML = data.content;
    }

    // Show/hide delete button
    if (data.onDelete) {
        deleteBtn.style.display = 'block';
    } else {
        deleteBtn.style.display = 'none';
    }

    // Prevent background scrolling
    document.body.style.overflow = 'hidden';

    modal.style.display = 'flex';

    // Add bounce-in animation to modal content (only if animations enabled)
    const modalBox = modal.querySelector('.modal-box');
    const animationsDisabled = document.body.classList.contains('no-animations');

    if (modalBox && !animationsDisabled) {
        modalBox.style.animation = 'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
    } else if (modalBox) {
        modalBox.style.animation = 'none';
    }
}

function closeEditModal() {
    const modal = document.getElementById('edit-modal');
    const modalBox = modal.querySelector('.modal-box');
    const animationsDisabled = document.body.classList.contains('no-animations');

    // Add fade-out animation (only if animations enabled)
    if (modalBox && !animationsDisabled) {
        modalBox.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            modal.style.display = 'none';
            currentModalData = null;
        }, 300);
    } else {
        modal.style.display = 'none';
        currentModalData = null;
    }

    // Restore background scrolling
    document.body.style.overflow = '';
}

function saveEditModal() {
    if (!currentModalData || !currentModalData.onSave) {
        closeEditModal();
        return;
    }

    // If using fields array, collect data and pass to onSave
    if (currentModalData.fields && Array.isArray(currentModalData.fields)) {
        const data = {};
        currentModalData.fields.forEach(field => {
            const element = document.getElementById(field.id);
            if (element) {
                if (field.type === 'checkbox') {
                    data[field.id] = element.checked;
                } else {
                    data[field.id] = element.value;
                }
            }
        });
        currentModalData.onSave(data);
    } else {
        currentModalData.onSave();
    }

    closeEditModal();
}

function deleteFromModal() {
    if (!currentModalData || !currentModalData.onDelete) {
        return;
    }
    currentModalData.onDelete();
    closeEditModal();
}

function openShopItemModal(itemId) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const fields = [
        { id: 'modal-material', label: t('web-editor.modals.fields.material'), value: item.material, hint: t('web-editor.modals.fields.material-hint') },
        { id: 'modal-name', label: t('web-editor.modals.fields.display-name'), value: item.name, hint: t('web-editor.modals.fields.display-name-hint') },
        { id: 'modal-slot', label: t('web-editor.modals.fields.slot'), type: 'number', value: item.slot, min: 0, hint: t('web-editor.modals.fields.slot-hint') },
        { id: 'modal-price', label: t('web-editor.modals.fields.buy-price'), type: 'number', value: item.price, hint: t('web-editor.modals.fields.buy-price-hint') },
        { id: 'modal-sellPrice', label: t('web-editor.modals.fields.sell-price'), type: 'number', value: item.sellPrice || 0, hint: t('web-editor.modals.fields.sell-price-hint') },
        { id: 'modal-amount', label: t('web-editor.modals.fields.amount'), type: 'number', value: item.amount, min: 1, max: 64 },
        { id: 'modal-lore', label: t('web-editor.modals.fields.lore'), type: 'textarea', value: (item.lore || []).join('\n') },
        { id: 'modal-enchantments', label: t('web-editor.modals.fields.enchantments'), type: 'textarea', value: Object.entries(item.enchantments || {}).map(([k, v]) => `${k}:${v}`).join('\n'), hint: t('web-editor.modals.fields.enchantments-hint') }
    ];

    // Spawner specific
    if (item.material === 'SPAWNER' || item.spawnerType) {
        fields.push({ id: 'modal-spawnerType', label: t('web-editor.modals.fields.spawner-type'), value: item.spawnerType || 'ZOMBIE', hint: t('web-editor.modals.fields.spawner-type-hint') });
    }

    // Potion specific
    if (item.material.includes('POTION') || item.potionType) {
        fields.push({ id: 'modal-potionType', label: t('web-editor.modals.fields.potion-type'), value: item.potionType || 'SWIFTNESS', hint: t('web-editor.modals.fields.potion-type-hint') });
        fields.push({ id: 'modal-potionLevel', label: t('web-editor.modals.fields.potion-level'), type: 'number', value: item.potionLevel || 0, min: 0, max: 255, hint: t('web-editor.modals.fields.potion-level-hint') });
    }

    fields.push({ id: 'modal-hideAttributes', label: t('web-editor.modals.fields.hide-attributes'), type: 'checkbox', value: item.hideAttributes });
    fields.push({ id: 'modal-hideAdditional', label: t('web-editor.modals.fields.hide-additional'), type: 'checkbox', value: item.hideAdditional });
    fields.push({ id: 'modal-requireName', label: t('web-editor.modals.fields.require-name'), type: 'checkbox', value: item.requireName, hint: t('web-editor.modals.fields.require-name-hint') });
    fields.push({ id: 'modal-requireLore', label: t('web-editor.modals.fields.require-lore'), type: 'checkbox', value: item.requireLore, hint: t('web-editor.modals.fields.require-lore-hint') });
    fields.push({ id: 'modal-unstableTnt', label: t('web-editor.modals.fields.unstable-tnt'), type: 'checkbox', value: item.unstableTnt });

    fields.push({ id: 'modal-limit', label: t('web-editor.modals.fields.player-limit'), type: 'number', value: item.limit || 0, hint: t('web-editor.modals.fields.player-limit-hint') });
    fields.push({ id: 'modal-dynamicPricing', label: t('web-editor.modals.fields.dynamic-pricing'), type: 'checkbox', value: item.dynamicPricing });
    fields.push({ id: 'modal-minPrice', label: t('web-editor.modals.fields.min-price'), type: 'number', value: item.minPrice || 0, hint: t('web-editor.modals.fields.min-price-hint') });
    fields.push({ id: 'modal-maxPrice', label: t('web-editor.modals.fields.max-price'), type: 'number', value: item.maxPrice || 0, hint: t('web-editor.modals.fields.max-price-hint') });
    fields.push({ id: 'modal-priceChange', label: t('web-editor.modals.fields.price-change'), type: 'number', value: item.priceChange || 0, step: '0.01', hint: t('web-editor.modals.fields.price-change-hint') });

    openEditModal({
        title: `${t('web-editor.modals.edit-item')}: ${item.material}`,
        fields: fields,
        onSave: (data) => {
            const beforeData = JSON.parse(JSON.stringify(item));

            item.material = data['modal-material'].toUpperCase();
            item.name = data['modal-name'];
            item.price = parseFloat(data['modal-price']) || 0;
            item.sellPrice = parseFloat(data['modal-sellPrice']) || 0;
            item.amount = parseInt(data['modal-amount']) || 1;
            item.lore = data['modal-lore'].split('\n');
            item.slot = parseInt(data['modal-slot']) || 0;

            const enchantments = {};
            if (data['modal-enchantments'].trim()) {
                data['modal-enchantments'].split('\n').forEach(line => {
                    const trimmedLine = line.trim();
                    const lastColonIndex = trimmedLine.lastIndexOf(':');
                    if (lastColonIndex !== -1) {
                        const enchKey = trimmedLine.substring(0, lastColonIndex).trim();
                        const enchLevel = parseInt(trimmedLine.substring(lastColonIndex + 1).trim()) || 1;
                        enchantments[enchKey] = enchLevel;
                    }
                });
            }
            item.enchantments = enchantments;

            if (data['modal-spawnerType']) item.spawnerType = data['modal-spawnerType'].toUpperCase();
            if (data['modal-potionType']) item.potionType = data['modal-potionType'].toUpperCase();
            if (data['modal-potionLevel'] !== undefined) item.potionLevel = parseInt(data['modal-potionLevel']);

            item.hideAttributes = data['modal-hideAttributes'];
            item.hideAdditional = data['modal-hideAdditional'];
            item.requireName = data['modal-requireName'];
            item.requireLore = data['modal-requireLore'];
            item.unstableTnt = data['modal-unstableTnt'];

            item.limit = parseInt(data['modal-limit']) || 0;
            item.dynamicPricing = data['modal-dynamicPricing'];
            item.minPrice = parseFloat(data['modal-minPrice']) || 0;
            item.maxPrice = parseFloat(data['modal-maxPrice']) || 0;
            item.priceChange = parseFloat(data['modal-priceChange']) || 0;

            addActivityEntry('updated', 'shop-item', beforeData, JSON.parse(JSON.stringify(item)), {
                shopFile: currentShopFile
            });

            renderItems();
            updateAll();
            showToast(t('web-editor.modals.item-updated'), 'success');
        },
        onDelete: () => {
            showConfirm(t('web-editor.modals.remove-confirm', {item: item.material})).then(confirmed => {
                if (confirmed) {
                    removeItem(item.id);
                    showToast(t('web-editor.modals.item-removed'), 'warning');
                }
            });
        }
    });
}

function openMainMenuShopModal(index) {
    const shop = loadedGuiShops[index];
    if (!shop) return;

    const shopOptions = [
        { value: 'none', label: '-- no action --' }
    ];
    Object.keys(allShops).sort().forEach(filename => {
        const nameWithoutYml = filename.replace('.yml', '');
        shopOptions.push({ value: nameWithoutYml, label: filename });
    });

    openEditModal({
        title: `Edit Menu Button: ${shop.key}`,
        fields: [
            { id: 'modal-key', label: 'Unique Key (Internal)', value: shop.key, hint: 'Changing this will rename the button in the YAML file' },
            { id: 'modal-material', label: 'Material', value: shop.material },
            { id: 'modal-name', label: 'Display Name', value: shop.name },
            { id: 'modal-slot', label: 'Slot (0-53)', type: 'number', value: shop.slot, min: 0, max: 53 },
            { 
                id: 'modal-shopKey', 
                label: 'Linked Shop File', 
                type: 'select', 
                value: shop.shopKey || 'none', 
                options: shopOptions,
                hint: 'Choose which shop opens when this button is clicked' 
            },
            { id: 'modal-permission', label: 'Required Permission', value: shop.permission, hint: 'Leave empty for no permission' },
            { id: 'modal-lore', label: 'Lore (one per line)', type: 'textarea', value: shop.lore.join('\n') },
            { id: 'modal-hideAttributes', label: 'Hide Attributes', type: 'checkbox', value: shop.hideAttributes },
            { id: 'modal-hideAdditional', label: 'Hide Additional Info', type: 'checkbox', value: shop.hideAdditional }
        ],
        onSave: (data) => {
            const beforeData = JSON.parse(JSON.stringify(shop));
            
            shop.key = data['modal-key'];
            shop.material = data['modal-material'];
            shop.name = data['modal-name'];
            shop.slot = parseInt(data['modal-slot']);
            shop.shopKey = data['modal-shopKey'] === 'none' ? '' : data['modal-shopKey'];
            shop.permission = data['modal-permission'];
            shop.lore = data['modal-lore'].split('\n');
            shop.hideAttributes = data['modal-hideAttributes'];
            shop.hideAdditional = data['modal-hideAdditional'];

            addActivityEntry('updated', 'main-menu-button', beforeData, JSON.parse(JSON.stringify(shop)));
            
            renderMainMenuShops();
            updateGuiPreview();
            scheduleAutoSave();
        },
        onDelete: () => removeMainMenuShop(index)
    });
}

function openTransactionButtonModal(type, group, key) {
    const settings = transactionSettings[type];
    let button;
    let title;

    if (group === 'main') {
        button = settings.buttons[key];
        title = `Edit ${type.charAt(0).toUpperCase() + type.slice(1)} ${key.charAt(0).toUpperCase() + key.slice(1)} Button`;
    } else {
        button = settings[group].buttons[key];
        title = `Edit ${group.charAt(0).toUpperCase() + group.slice(1)} ${key} Button`;
    }

    if (!button) return;

    const fields = [
        { id: 'modal-name', label: 'Display Name', value: button.name },
        { id: 'modal-slot', label: 'Slot (0-53)', type: 'number', value: button.slot, min: 0, max: 53 }
    ];

    if (group === 'main') {
        fields.unshift({ id: 'modal-material', label: 'Material', value: button.material });
    }

    openEditModal({
        title: title,
        fields: fields,
        onSave: (data) => {
            const beforeData = JSON.parse(JSON.stringify(button));
            
            if (group === 'main') {
                button.material = data['modal-material'];
            }
            button.name = data['modal-name'];
            button.slot = parseInt(data['modal-slot']);

            addActivityEntry('updated', `${type}-menu-button`, beforeData, JSON.parse(JSON.stringify(button)), {
                type: type,
                group: group,
                key: key
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
        },
        onDelete: (group !== 'main') ? () => {
            removeCustomButton(type, group, key);
        } : null
    });
}

function openActivityLogModal() {
    const modal = document.getElementById('activity-log-modal');
    refreshActivityLog();

    const animationsDisabled = document.body.classList.contains('no-animations');
    modal.style.display = 'flex';

    const modalBox = modal.querySelector('.modal-box');
    if (modalBox && !animationsDisabled) {
        modalBox.style.animation = 'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
    } else if (modalBox) {
        modalBox.style.animation = 'none';
    }
}

function closeActivityLogModal() {
    const modal = document.getElementById('activity-log-modal');
    const animationsDisabled = document.body.classList.contains('no-animations');

    const modalBox = modal.querySelector('.modal-box');
    if (modalBox && !animationsDisabled) {
        modalBox.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    } else {
        modal.style.display = 'none';
    }
}

function openActivityDetailModal(entryId) {
    const entry = activityLog.find(e => e.id === entryId);
    if (!entry) return;

    currentViewedEntry = entry;
    const modal = document.getElementById('activity-detail-modal');
    const title = document.getElementById('activity-detail-title');
    const content = document.getElementById('activity-detail-content');
    const rollbackBtn = document.getElementById('rollback-btn');

    title.textContent = `Change Details: ${entry.action.toUpperCase()} ${entry.target}`;

    // Generate diff view
    let html = `
        <div style="background: rgba(0, 0, 0, 0.2); border-radius: 12px; padding: 16px; margin-bottom: 20px; border: 1px solid rgba(102, 126, 234, 0.2);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <div style="color: rgba(200, 210, 225, 0.7); font-size: 0.85em;">Action: <strong style="color: #fff;">${entry.action.toUpperCase()}</strong></div>
                <div style="color: rgba(200, 210, 225, 0.7); font-size: 0.85em;">Target: <strong style="color: #fff;">${entry.target}</strong></div>
                <div style="color: rgba(200, 210, 225, 0.7); font-size: 0.85em;">Time: <strong style="color: #fff;">${new Date(entry.timestamp).toLocaleString()}</strong></div>
            </div>
        </div>
    `;

    if (entry.action === 'deleted') {
        html += `
            <div style="margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                    <span style="font-size: 1.2em;">🗑️</span>
                    <h3 style="margin: 0; color: rgba(255, 107, 107, 0.9); font-size: 1em; font-weight: 700;">DELETED DATA</h3>
                </div>
                <div style="background: rgba(255, 107, 107, 0.1); border: 1px solid rgba(255, 107, 107, 0.3); border-radius: 10px; padding: 14px;">
                    <pre style="margin: 0; color: rgba(220, 230, 245, 0.85); font-size: 0.85em; white-space: pre-wrap; word-wrap: break-word; font-family: 'Courier New', monospace;">${escapeHtml(JSON.stringify(entry.beforeData, null, 2))}</pre>
                </div>
            </div>
        `;
    } else if (entry.action === 'created') {
        html += `
            <div style="margin-bottom: 20px;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                    <span style="font-size: 1.2em;">➕</span>
                    <h3 style="margin: 0; color: rgba(0, 230, 118, 0.9); font-size: 1em; font-weight: 700;">CREATED DATA</h3>
                </div>
                <div style="background: rgba(0, 230, 118, 0.1); border: 1px solid rgba(0, 230, 118, 0.3); border-radius: 10px; padding: 14px;">
                    <pre style="margin: 0; color: rgba(220, 230, 245, 0.85); font-size: 0.85em; white-space: pre-wrap; word-wrap: break-word; font-family: 'Courier New', monospace;">${escapeHtml(JSON.stringify(entry.afterData, null, 2))}</pre>
                </div>
            </div>
        `;
    } else {
        html += `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                <div>
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                        <span style="font-size: 1.2em;">📋</span>
                        <h3 style="margin: 0; color: rgba(255, 107, 107, 0.9); font-size: 1em; font-weight: 700;">BEFORE</h3>
                    </div>
                    <div style="background: rgba(255, 107, 107, 0.1); border: 1px solid rgba(255, 107, 107, 0.3); border-radius: 10px; padding: 14px; height: 400px; overflow-y: auto;">
                        <pre style="margin: 0; color: rgba(220, 230, 245, 0.85); font-size: 0.85em; white-space: pre-wrap; word-wrap: break-word; font-family: 'Courier New', monospace;">${escapeHtml(JSON.stringify(entry.beforeData, null, 2))}</pre>
                    </div>
                </div>

                <div>
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                        <span style="font-size: 1.2em;">📋</span>
                        <h3 style="margin: 0; color: rgba(0, 230, 118, 0.9); font-size: 1em; font-weight: 700;">AFTER</h3>
                    </div>
                    <div style="background: rgba(0, 230, 118, 0.1); border: 1px solid rgba(0, 230, 118, 0.3); border-radius: 10px; padding: 14px; height: 400px; overflow-y: auto;">
                        <pre style="margin: 0; color: rgba(220, 230, 245, 0.85); font-size: 0.85em; white-space: pre-wrap; word-wrap: break-word; font-family: 'Courier New', monospace;">${escapeHtml(JSON.stringify(entry.afterData, null, 2))}</pre>
                    </div>
                </div>
            </div>

            <div style="background: rgba(255, 215, 0, 0.1); border: 1px solid rgba(255, 215, 0, 0.3); border-radius: 10px; padding: 14px;">
                <div style="font-weight: 700; margin-bottom: 8px; color: rgba(255, 215, 0, 0.9); font-size: 0.9em;">📊 CHANGES DETECTED</div>
                ${generateChangeSummary(entry.beforeData, entry.afterData)}
            </div>
        `;
    }

    content.innerHTML = html;

    // Rollback is now fully supported
    rollbackBtn.style.display = 'flex';

    const animationsDisabled = document.body.classList.contains('no-animations');
    modal.style.display = 'flex';

    const modalBox = modal.querySelector('.modal-box');
    if (modalBox && !animationsDisabled) {
        modalBox.style.animation = 'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
    } else if (modalBox) {
        modalBox.style.animation = 'none';
    }
}

function generateChangeSummary(before, after) {
    if (JSON.stringify(before) === JSON.stringify(after)) return '';

    if (Array.isArray(before) && Array.isArray(after)) {
        let html = '';
        for (let i = 0; i < Math.max(before.length, after.length); i++) {
            const b = before[i];
            const a = after[i];
            if (JSON.stringify(b) !== JSON.stringify(a)) {
                const name = (a && (a.name || a.material)) || (b && (b.name || b.material)) || `Index ${i}`;
                const cleanName = name.toString().replace(/&[0-9a-fk-or]/gi, '').replace(/&#[0-9a-fA-F]{6}/gi, '');
                html += `
                    <div style="margin-top: 12px; border-top: 1px solid rgba(255, 215, 0, 0.2); padding-top: 8px;">
                        <div style="font-weight: 700; color: #fff; margin-bottom: 4px; font-size: 0.9em;">${cleanName}</div>
                        <div style="padding-left: 12px;">${generateChangeSummary(b, a)}</div>
                    </div>
                `;
            }
        }
        return html;
    }

    const changes = [];
    const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

    allKeys.forEach(key => {
        const beforeVal = before?.[key];
        const afterVal = after?.[key];

        if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
            let beforeText, afterText;

            if (beforeVal !== null && typeof beforeVal === 'object') {
                beforeText = Array.isArray(beforeVal) ? `Array(${beforeVal.length})` : 'Object';
            } else {
                beforeText = escapeHtml(JSON.stringify(beforeVal));
            }

            if (afterVal !== null && typeof afterVal === 'object') {
                afterText = Array.isArray(afterVal) ? `Array(${afterVal.length})` : 'Object';
            } else {
                afterText = escapeHtml(JSON.stringify(afterVal));
            }

            // If both are simple objects/arrays, we could show a bit more
            if (typeof beforeVal === 'object' && typeof afterVal === 'object') {
                const bStr = JSON.stringify(beforeVal);
                const aStr = JSON.stringify(afterVal);
                if (bStr.length < 40 && aStr.length < 40) {
                    beforeText = escapeHtml(bStr);
                    afterText = escapeHtml(aStr);
                }
            }

            changes.push(`
                <div style="padding: 4px 0; border-bottom: 1px solid rgba(255, 215, 0, 0.05); display: grid; grid-template-columns: 100px 1fr 1fr; gap: 12px; align-items: start;">
                    <div style="font-weight: 600; color: rgba(220, 230, 245, 0.6); font-size: 0.8em;">${key}:</div>
                    <div style="color: rgba(255, 107, 107, 0.7); font-size: 0.8em; word-break: break-word;">
                        <span style="text-decoration: line-through; opacity: 0.5;">${beforeText}</span>
                    </div>
                    <div style="color: rgba(0, 230, 118, 0.8); font-size: 0.8em; word-break: break-word;">
                        ${afterText}
                    </div>
                </div>
            `);
        }
    });

    return changes.length > 0 ? changes.join('') : '<div style="color: rgba(180, 190, 210, 0.7); font-size: 0.8em;">No specific property changes</div>';
}

function closeActivityDetailModal() {
    const modal = document.getElementById('activity-detail-modal');
    const animationsDisabled = document.body.classList.contains('no-animations');

    const modalBox = modal.querySelector('.modal-box');
    if (modalBox && !animationsDisabled) {
        modalBox.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            modal.style.display = 'none';
            currentViewedEntry = null;
        }, 300);
    } else {
        modal.style.display = 'none';
        currentViewedEntry = null;
    }
}

function openShopSettings() {
    openEditModal({
        title: 'Shop Settings',
        fields: [
            { id: 'gui-name', label: 'GUI Name', value: currentShopSettings.guiName },
            { id: 'rows', label: 'Rows (1-6)', type: 'number', value: currentShopSettings.rows, min: 1, max: 6 },
            { id: 'permission', label: 'Permission', value: currentShopSettings.permission },
            { id: 'available-times', label: 'Available Times (one per line)', type: 'textarea', value: currentShopSettings.availableTimes }
        ],
        onSave: (data) => {
            const beforeData = JSON.parse(JSON.stringify(currentShopSettings));
            currentShopSettings.guiName = data['gui-name'];
            currentShopSettings.rows = parseInt(data['rows']);
            currentShopSettings.permission = data['permission'];
            currentShopSettings.availableTimes = data['available-times'];
            
            addActivityEntry('updated', 'shop-settings', beforeData, JSON.parse(JSON.stringify(currentShopSettings)), {
                shopFile: currentShopFile
            });

            updateAll();
            scheduleAutoSave();
        }
    });
}

function openMainMenuSettings() {
    openEditModal({
        title: 'Main Menu Settings',
        fields: [
            { id: 'mainmenu-title', label: 'Menu Title', value: mainMenuSettings.title },
            { id: 'mainmenu-rows', label: 'Rows (1-6)', type: 'number', value: mainMenuSettings.rows, min: 1, max: 6 }
        ],
        onSave: (data) => {
            const beforeData = JSON.parse(JSON.stringify(mainMenuSettings));
            mainMenuSettings.title = data['mainmenu-title'];
            mainMenuSettings.rows = parseInt(data['mainmenu-rows']);

            addActivityEntry('updated', 'main-menu-settings', beforeData, JSON.parse(JSON.stringify(mainMenuSettings)));

            updateGuiPreview();
            scheduleAutoSave();
        }
    });
}

function openPurchaseSettings() {
    const p = transactionSettings.purchase;
    openEditModal({
        title: 'Purchase Menu Settings',
        fields: [
            { id: 'purchase-title-prefix', label: 'Title Prefix', value: p.titlePrefix },
            { id: 'purchase-display-material', label: 'Display Material', value: p.displayMaterial },
            { id: 'purchase-display-slot', label: 'Display Slot', type: 'number', value: p.displaySlot, min: 0, max: 53 },
            { id: 'purchase-max-amount', label: 'Max Amount', type: 'number', value: p.maxAmount },
            { id: 'purchase-lore-amount', label: 'Lore: Amount', value: p.lore.amount },
            { id: 'purchase-lore-total', label: 'Lore: Total', value: p.lore.total },
            { id: 'purchase-lore-spawner', label: 'Lore: Spawner', value: p.lore.spawner },
            { id: 'purchase-add-material', label: 'Add Buttons Material', value: p.add.material, hint: 'Material for all +Add buttons' },
            { id: 'purchase-remove-material', label: 'Remove Buttons Material', value: p.remove.material, hint: 'Material for all -Remove buttons' },
            { id: 'purchase-set-material', label: 'Set Buttons Material', value: p.set.material, hint: 'Material for all =Set buttons' }
        ],
        onSave: (data) => {
            const beforeData = JSON.parse(JSON.stringify(p));
            p.titlePrefix = data['purchase-title-prefix'];
            p.displayMaterial = data['purchase-display-material'];
            p.displaySlot = parseInt(data['purchase-display-slot']);
            p.maxAmount = parseInt(data['purchase-max-amount']);
            p.lore.amount = data['purchase-lore-amount'];
            p.lore.total = data['purchase-lore-total'];
            p.lore.spawner = data['purchase-lore-spawner'];
            p.add.material = data['purchase-add-material'];
            p.remove.material = data['purchase-remove-material'];
            p.set.material = data['purchase-set-material'];
            
            addActivityEntry('updated', 'purchase-menu-settings', beforeData, JSON.parse(JSON.stringify(p)));

            updatePurchasePreview();
            renderPurchaseButtons();
            scheduleAutoSave();
        }
    });
}

function openSellSettings() {
    const s = transactionSettings.sell;
    openEditModal({
        title: 'Sell Menu Settings',
        fields: [
            { id: 'sell-title-prefix', label: 'Title Prefix', value: s.titlePrefix },
            { id: 'sell-display-material', label: 'Display Material', value: s.displayMaterial },
            { id: 'sell-display-slot', label: 'Display Slot', type: 'number', value: s.displaySlot, min: 0, max: 53 },
            { id: 'sell-max-amount', label: 'Max Amount', type: 'number', value: s.maxAmount },
            { id: 'sell-lore-amount', label: 'Lore: Amount', value: s.lore.amount },
            { id: 'sell-lore-total', label: 'Lore: Total', value: s.lore.total },
            { id: 'sell-add-material', label: 'Add Buttons Material', value: s.add.material, hint: 'Material for all +Add buttons' },
            { id: 'sell-remove-material', label: 'Remove Buttons Material', value: s.remove.material, hint: 'Material for all -Remove buttons' },
            { id: 'sell-set-material', label: 'Set Buttons Material', value: s.set.material, hint: 'Material for all =Set buttons' }
        ],
        onSave: (data) => {
            const beforeData = JSON.parse(JSON.stringify(s));
            s.titlePrefix = data['sell-title-prefix'];
            s.displayMaterial = data['sell-display-material'];
            s.displaySlot = parseInt(data['sell-display-slot']);
            s.maxAmount = parseInt(data['sell-max-amount']);
            s.lore.amount = data['sell-lore-amount'];
            s.lore.total = data['sell-lore-total'];
            s.add.material = data['sell-add-material'];
            s.remove.material = data['sell-remove-material'];
            s.set.material = data['sell-set-material'];
            
            addActivityEntry('updated', 'sell-menu-settings', beforeData, JSON.parse(JSON.stringify(s)));

            updateSellPreview();
            renderSellButtons();
            scheduleAutoSave();
        }
    });
}

async function rollbackChange() {
    if (!currentViewedEntry) return;
    const entry = currentViewedEntry;
    
    // Check if context matches for shop-specific changes
    if ((entry.target === 'shop-item' || entry.target === 'shop-settings') && 
        entry.details && entry.details.shopFile && entry.details.shopFile !== currentShopFile) {
        showAlert(`You must switch to shop "${entry.details.shopFile}" before rolling back this change.`, 'warning');
        return;
    }

    const confirmed = await showConfirm(`Are you sure you want to rollback this ${entry.action} ${entry.target}? This will overwrite current state.`);
    if (!confirmed) return;

    try {
        switch (entry.target) {
            case 'shop-item':
                if (entry.action === 'updated') {
                    const rollbackItem = (before, after) => {
                        const item = items.find(i => i.id === after.id);
                        if (item) {
                            Object.assign(item, JSON.parse(JSON.stringify(before)));
                        } else {
                            // Item might have been deleted, add it back
                            items.push(JSON.parse(JSON.stringify(before)));
                        }
                    };
                    if (Array.isArray(entry.afterData)) {
                        entry.afterData.forEach((after, idx) => rollbackItem(entry.beforeData[idx], after));
                    } else {
                        rollbackItem(entry.beforeData, entry.afterData);
                    }
                } else if (entry.action === 'created') {
                    // Remove created item
                    items = items.filter(i => i.id !== entry.afterData.id);
                } else if (entry.action === 'deleted') {
                    // Add deleted item back
                    items.push(JSON.parse(JSON.stringify(entry.beforeData)));
                }
                renderItems();
                updateAll();
                break;

            case 'main-menu-button':
                if (entry.action === 'updated') {
                    const rollbackShop = (before, after) => {
                        const shop = loadedGuiShops.find(s => s.key === after.key);
                        if (shop) {
                            Object.assign(shop, JSON.parse(JSON.stringify(before)));
                        }
                    };
                    if (Array.isArray(entry.afterData)) {
                        entry.afterData.forEach((after, idx) => rollbackShop(entry.beforeData[idx], after));
                    } else {
                        rollbackShop(entry.beforeData, entry.afterData);
                    }
                } else if (entry.action === 'created') {
                    loadedGuiShops = loadedGuiShops.filter(s => s.key !== entry.afterData.key);
                } else if (entry.action === 'deleted') {
                    loadedGuiShops.push(JSON.parse(JSON.stringify(entry.beforeData)));
                }
                renderMainMenuShops();
                updateGuiPreview();
                scheduleAutoSave();
                break;

            case 'purchase-menu-button':
            case 'sell-menu-button':
                {
                    const type = entry.details.type; // 'purchase' or 'sell'
                    
                    const rollbackBtn = (before, details) => {
                        const group = details.group; // 'main', 'add', 'remove', 'set'
                        const key = details.key;
                        if (group === 'display') {
                            transactionSettings[type].displaySlot = before.slot;
                        } else if (group === 'main') {
                            transactionSettings[type].buttons[key] = JSON.parse(JSON.stringify(before));
                        } else {
                            transactionSettings[type][group].buttons[key] = JSON.parse(JSON.stringify(before));
                        }
                    };

                    if (entry.action === 'updated') {
                        if (Array.isArray(entry.afterData)) {
                            entry.afterData.forEach((after, idx) => rollbackBtn(entry.beforeData[idx], entry.details.batch[idx]));
                        } else {
                            rollbackBtn(entry.beforeData, entry.details);
                        }
                    } else if (entry.action === 'created') {
                        if (entry.details.group !== 'main') {
                            delete transactionSettings[type][entry.details.group].buttons[entry.details.key];
                        }
                    } else if (entry.action === 'deleted') {
                        if (entry.details.group !== 'main') {
                            transactionSettings[type][entry.details.group].buttons[entry.details.key] = JSON.parse(JSON.stringify(entry.beforeData));
                        }
                    }
                    
                    if (type === 'purchase') {
                        updatePurchasePreview();
                        renderPurchaseButtons();
                    } else {
                        updateSellPreview();
                        renderSellButtons();
                    }
                    scheduleAutoSave();
                }
                break;

            case 'shop-settings':
                Object.assign(currentShopSettings, JSON.parse(JSON.stringify(entry.beforeData)));
                updateAll();
                break;

            case 'main-menu-settings':
                Object.assign(mainMenuSettings, JSON.parse(JSON.stringify(entry.beforeData)));
                updateGuiPreview();
                renderMainMenuShops();
                scheduleAutoSave();
                break;

            case 'purchase-menu-settings':
            case 'sell-menu-settings':
                {
                    const settingsType = entry.target.split('-')[0]; // 'purchase' or 'sell'
                    Object.assign(transactionSettings[settingsType], JSON.parse(JSON.stringify(entry.beforeData)));
                    if (settingsType === 'purchase') {
                        updatePurchasePreview();
                        renderPurchaseButtons();
                    } else {
                        updateSellPreview();
                        renderSellButtons();
                    }
                    scheduleAutoSave();
                }
                break;
        }

        const rollbackAction = entry.action === 'created' ? 'deleted' : (entry.action === 'deleted' ? 'created' : 'updated');

        // Add rollback to history
        addActivityEntry(rollbackAction, entry.target, entry.afterData, entry.beforeData, {
            ...entry.details,
            isRollback: true
        });

        closeActivityDetailModal();
        closeActivityLogModal();
        showToast(t('web-editor.modals.rollback-success', 'Action rolled back successfully'), 'success');
    } catch (error) {
        console.error('Rollback failed:', error);
        showAlert(t('web-editor.modals.rollback-failed', 'Rollback failed') + ': ' + error.message, 'error');
    }
}

function refreshActivityLog() {
    const container = document.getElementById('activity-log-container');
    const emptyState = document.getElementById('activity-log-empty');
    if (!container) return;

    if (activityLog.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    let html = '';
    activityLog.forEach(entry => {
        const timeAgo = getTimeAgo(entry.timestamp);
        const icon = entry.action === 'created' ? '➕' : entry.action === 'updated' ? '✏️' : '🗑️';
        const color = entry.action === 'created' ? 'rgba(0, 230, 118, 0.15)' : entry.action === 'updated' ? 'rgba(255, 215, 0, 0.15)' : 'rgba(255, 107, 107, 0.15)';
        const borderColor = entry.action === 'created' ? 'rgba(0, 230, 118, 0.25)' : entry.action === 'updated' ? 'rgba(255, 215, 0, 0.25)' : 'rgba(255, 107, 107, 0.25)';

        html += `
            <div class="shop-item" style="margin-bottom: 10px; background: ${color}; border-color: ${borderColor}; cursor: pointer;" onclick="openActivityDetailModal(${entry.id})">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                    <div style="font-size: 1.2em; flex-shrink: 0;">${icon}</div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(getActivitySummary(entry))}</div>
                        <div style="font-size: 0.8em; color: rgba(255,255,255,0.6);">${entry.username} • ${timeAgo}</div>
                    </div>
                    <div style="font-size: 1.2em; opacity: 0.5;">🔍</div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}
