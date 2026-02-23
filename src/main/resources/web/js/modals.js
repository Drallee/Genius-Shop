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

    if (data.titleHtml) {
        modalTitle.innerHTML = data.titleHtml;
    } else {
        modalTitle.textContent = data.title || 'Edit Item';
    }

    // Generate content from fields array or use provided content
    if (data.fields && Array.isArray(data.fields)) {
        let html = '';

        // Helper to render a single field
        const renderField = (field) => {
            let fHtml = `<div class="form-group" id="group-${field.id}" ${field.hidden ? 'style="display: none;"' : ''}>`;

            if (field.type === 'checkbox') {
                fHtml += `<label class="flex items-center gap-8 cursor-pointer">`;
                fHtml += `<input type="checkbox" id="${field.id}" name="${field.id}" ${field.value ? 'checked' : ''}>`;
                fHtml += `<span>${escapeHtml(field.label)}</span>`;
                fHtml += `</label>`;
            } else {
                if (field.label) {
                    fHtml += `<label for="${field.id}" class="section-label">${escapeHtml(field.label)}</label>`;
                }

                if (field.removeable) {
                    fHtml += `<div class="flex items-center gap-12">`;
                    fHtml += `<div class="flex-1">`;
                }

                if (field.type === 'select') {
                    fHtml += `<select id="${field.id}" name="${field.id}" class="premium-select">`;
                    if (field.options) {
                        field.options.forEach(opt => {
                            const val = typeof opt === 'string' ? opt : opt.value;
                            const lab = typeof opt === 'string' ? opt : opt.label;
                            fHtml += `<option value="${escapeHtml(val)}" ${val === field.value ? 'selected' : ''}>${escapeHtml(lab)}</option>`;
                        });
                    }
                    fHtml += `</select>`;
                } else if (field.type === 'textarea') {
                    fHtml += `<textarea id="${field.id}" name="${field.id}" class="textarea-base" placeholder="${escapeHtml(field.placeholder || '')}">${escapeHtml(field.value || '')}</textarea>`;
                } else if (field.type === 'number') {
                    fHtml += `<input type="number" id="${field.id}" name="${field.id}" class="input-base" value="${escapeHtml(field.value || '')}" min="${field.min || ''}" max="${field.max || ''}" step="${field.step || ''}" placeholder="${escapeHtml(field.placeholder || '')}">`;
                } else {
                    fHtml += `<input type="text" id="${field.id}" name="${field.id}" class="input-base" value="${escapeHtml(field.value || '')}" placeholder="${escapeHtml(field.placeholder || '')}">`;
                }

                if (field.removeable) {
                    fHtml += `</div>`;
                    fHtml += `<button type="button" id="remove-${field.id}" class="btn btn-danger-text" style="padding: 4px 8px; font-size: 1.2em;" title="${t('web-editor.modals.remove')}">×</button>`;
                    fHtml += `</div>`;
                }
            }

            if (field.hint) {
                fHtml += `<small class="input-hint">${escapeHtml(field.hint)}</small>`;
            }
            fHtml += '</div>';
            return fHtml;
        };

        const checkboxes = data.fields.filter(f => f.type === 'checkbox');
        const regularFields = data.fields.filter(f => f.type !== 'checkbox');

        let i = 0;
        while (i < regularFields.length) {
            const field = regularFields[i];
            if (field.row && regularFields[i + 1] && regularFields[i + 1].row) {
                html += '<div class="form-row">';
                html += renderField(field);
                html += renderField(regularFields[i + 1]);
                html += '</div>';
                i += 2;
            } else {
                html += renderField(field);
                i++;
            }
        }

        if (checkboxes.length > 0) {
            html += '<div class="checkbox-grid">';
            checkboxes.forEach(cb => {
                html += renderField(cb);
            });
            html += '</div>';
        }

        modalContent.innerHTML = html;

        // Attach event listeners
        data.fields.forEach(field => {
            const el = document.getElementById(field.id);
            if (el) {
                if (field.onchange) {
                    el.addEventListener('change', (e) => field.onchange(e));
                }
                if (field.oninput) {
                    el.addEventListener('input', (e) => field.oninput(e));
                }
            }
            if (field.onRemove) {
                const removeBtn = document.getElementById(`remove-${field.id}`);
                if (removeBtn) {
                    removeBtn.addEventListener('click', (e) => field.onRemove(e));
                }
            }
        });
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

    initCustomSelects();
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

function detectHeadTextureMode(value) {
    const v = (value || '').trim();
    if (!v) return 'id';
    if (v.startsWith('http://') || v.startsWith('https://') || v.includes('textures.minecraft.net/texture/')) return 'url';
    if (v.startsWith('{')) return 'base64';
    if (v.length > 60) return 'base64';
    return 'id';
}

function updateHeadTextureInputUi() {
    const modeEl = document.getElementById('modal-headTextureMode');
    const texEl = document.getElementById('modal-headTexture');
    if (!modeEl || !texEl) return;

    const mode = modeEl.value;
    if (mode === 'url') {
        texEl.placeholder = 'https://textures.minecraft.net/texture/<id>';
    } else if (mode === 'base64') {
        texEl.placeholder = 'Base64 texture value';
    } else {
        texEl.placeholder = 'Texture ID from textures.minecraft.net';
    }
}

function updateStockResetInputUi(prefix = 'modal-stockReset') {
    const enabled = document.getElementById(`${prefix}Enabled`);
    const typeEl = document.getElementById(`${prefix}Type`);

    const typeGroup = document.getElementById(`group-${prefix}Type`);
    const timeGroup = document.getElementById(`group-${prefix}Time`);
    const intervalGroup = document.getElementById(`group-${prefix}Interval`);
    const dowGroup = document.getElementById(`group-${prefix}DayOfWeek`);
    const domGroup = document.getElementById(`group-${prefix}DayOfMonth`);
    const monthGroup = document.getElementById(`group-${prefix}Month`);
    const dateGroup = document.getElementById(`group-${prefix}Date`);
    const timezoneGroup = document.getElementById(`group-${prefix}Timezone`);

    const isEnabled = !!(enabled && enabled.checked);
    const type = ((typeEl && typeEl.value) || 'daily').toLowerCase();

    if (typeGroup) typeGroup.style.display = isEnabled ? 'block' : 'none';
    const isMinuteInterval = isEnabled && type === 'minute-interval';
    const isSecondInterval = isEnabled && type === 'second-interval';
    const usesInterval = isMinuteInterval || isSecondInterval;

    if (timeGroup) timeGroup.style.display = (isEnabled && !usesInterval) ? 'block' : 'none';
    if (intervalGroup) intervalGroup.style.display = usesInterval ? 'block' : 'none';
    if (timezoneGroup) timezoneGroup.style.display = isEnabled ? 'block' : 'none';

    const isWeekly = isEnabled && type === 'weekly';
    const isMonthly = isEnabled && type === 'monthly';
    const isYearly = isEnabled && type === 'yearly';
    const isOnce = isEnabled && type === 'once';

    if (dowGroup) dowGroup.style.display = isWeekly ? 'block' : 'none';
    if (domGroup) domGroup.style.display = (isMonthly || isYearly) ? 'block' : 'none';
    if (monthGroup) monthGroup.style.display = isYearly ? 'block' : 'none';
    if (dateGroup) dateGroup.style.display = isOnce ? 'block' : 'none';
}

function readStockResetFromModal(data, prefix = 'modal-stockReset') {
    return sanitizeStockResetRule({
        enabled: !!data[`${prefix}Enabled`],
        type: data[`${prefix}Type`] || 'daily',
        time: data[`${prefix}Time`] || '00:00',
        interval: parseInt(data[`${prefix}Interval`], 10) || 1,
        dayOfWeek: data[`${prefix}DayOfWeek`] || 'MONDAY',
        dayOfMonth: parseInt(data[`${prefix}DayOfMonth`], 10) || 1,
        month: parseInt(data[`${prefix}Month`], 10) || 1,
        date: data[`${prefix}Date`] || '',
        timezone: data[`${prefix}Timezone`] || ''
    });
}

function handleShopItemMaterialChange(value) {
    const material = (value || '').toUpperCase();
    const label = document.getElementById('modal-material-label');
    if (label) label.textContent = material;

    const isSpawner = material === 'SPAWNER' || material === 'TRIAL_SPAWNER';
    const isPotion = material.includes('POTION') || material === 'TIPPED_ARROW';
    const isHead = material === 'PLAYER_HEAD';

    const spawnerModeGroup = document.getElementById('group-modal-spawnerMode');
    const spawnerTypeGroup = document.getElementById('group-modal-spawnerType');
    const spawnerItemGroup = document.getElementById('group-modal-spawnerItem');
    const potionTypeGroup = document.getElementById('group-modal-potionType');
    const potionLevelGroup = document.getElementById('group-modal-potionLevel');

    if (spawnerModeGroup) spawnerModeGroup.style.display = isSpawner ? 'block' : 'none';
    if (spawnerTypeGroup) spawnerTypeGroup.style.display = isSpawner ? 'block' : 'none';
    if (spawnerItemGroup) spawnerItemGroup.style.display = 'none';

    const spawnerModeEl = document.getElementById('modal-spawnerMode');
    if (isSpawner && spawnerModeEl && spawnerTypeGroup && spawnerItemGroup) {
        if (spawnerModeEl.value === 'ITEM') {
            spawnerTypeGroup.style.display = 'none';
            spawnerItemGroup.style.display = 'block';
        } else {
            spawnerTypeGroup.style.display = 'block';
            spawnerItemGroup.style.display = 'none';
        }
    }

    if (potionTypeGroup) potionTypeGroup.style.display = isPotion ? 'block' : 'none';
    if (potionLevelGroup) potionLevelGroup.style.display = isPotion ? 'block' : 'none';

    const headTexGroup = document.getElementById('group-modal-headTexture');
    const headOwnerGroup = document.getElementById('group-modal-headOwner');
    const headModeGroup = document.getElementById('group-modal-headTextureMode');
    if (headTexGroup) headTexGroup.style.display = isHead ? 'block' : 'none';
    if (headOwnerGroup) headOwnerGroup.style.display = isHead ? 'block' : 'none';
    if (headModeGroup) headModeGroup.style.display = isHead ? 'block' : 'none';

    const unstableGroup = document.getElementById('group-modal-unstableTnt');
    if (unstableGroup) unstableGroup.style.display = material.includes('TNT') ? 'block' : 'none';
}

function openShopItemModal(itemId) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const hasLore = Array.isArray(item.lore) && item.lore.some(line => (line || '').trim() !== '');
    const hasEnchantments = !!(item.enchantments && Object.keys(item.enchantments).length > 0);
    const hasCommands = !!(item.commands && item.commands.length > 0);
    const hasLimits = (item.limit || 0) > 0 || (item.globalLimit || 0) > 0;

    const fields = [
        { id: 'modal-name', label: t('web-editor.modals.fields.display-name'), value: item.name, hint: t('web-editor.modals.fields.display-name-hint') },
        { id: 'modal-slot', label: t('web-editor.modals.fields.slot'), type: 'number', value: item.slot, min: 0, hint: t('web-editor.modals.fields.slot-hint'), row: true },
        { id: 'modal-amount', label: t('web-editor.modals.fields.amount'), type: 'number', value: item.amount, min: 1, max: 64, row: true },
        { id: 'modal-price', label: t('web-editor.modals.fields.buy-price'), type: 'number', value: item.price, hint: t('web-editor.modals.fields.buy-price-hint'), row: true },
        { id: 'modal-sellPrice', label: t('web-editor.modals.fields.sell-price'), type: 'number', value: item.sellPrice || 0, hint: t('web-editor.modals.fields.sell-price-hint'), row: true },
        {
            id: 'modal-enableLore',
            label: 'Enable Lore',
            type: 'checkbox',
            value: hasLore,
            onchange: (e) => {
                const group = document.getElementById('group-modal-lore');
                if (group) group.style.display = e.target.checked ? 'block' : 'none';
            }
        },
        { id: 'modal-lore', label: t('web-editor.modals.fields.lore'), type: 'textarea', value: (item.lore || []).join('\n'), hidden: !hasLore },
        {
            id: 'modal-enableEnchantments',
            label: 'Enable Enchantments',
            type: 'checkbox',
            value: hasEnchantments,
            onchange: (e) => {
                const group = document.getElementById('group-modal-enchantments');
                if (group) group.style.display = e.target.checked ? 'block' : 'none';
            }
        },
        { id: 'modal-enchantments', label: t('web-editor.modals.fields.enchantments'), type: 'textarea', value: Object.entries(item.enchantments || {}).map(([k, v]) => `${k}:${v}`).join('\n'), hint: t('web-editor.modals.fields.enchantments-hint'), hidden: !hasEnchantments }
    ];

    // Spawner specific (always present, visibility controlled by material input)
    if (serverInfo.smartSpawnerEnabled) {
        const spawnerMode = item.spawnerItem ? 'ITEM' : 'ENTITY';
        
        fields.push({
            id: 'modal-spawnerMode',
            label: t('web-editor.modals.fields.spawner-mode', 'Spawner Mode'),
            type: 'select',
            value: spawnerMode,
            options: [
                { value: 'ENTITY', label: t('web-editor.modals.fields.spawner-mode-entity', 'Entity Spawner') },
                { value: 'ITEM', label: t('web-editor.modals.fields.spawner-mode-item', 'Item Spawner') }
            ],
            hidden: true,
            onchange: () => {
                const materialValue = document.getElementById('modal-material')?.value || '';
                handleShopItemMaterialChange(materialValue);
            }
        });

        // SmartSpawner Entity Types
        fields.push({
            id: 'modal-spawnerType',
            label: t('web-editor.modals.fields.spawner-type'),
            type: 'select',
            value: item.spawnerType || (serverInfo.smartSpawnerEntityTypes && serverInfo.smartSpawnerEntityTypes[0]) || 'ZOMBIE',
            options: serverInfo.smartSpawnerEntityTypes || serverInfo.entityTypes || [],
            hint: t('web-editor.modals.fields.spawner-type-hint'),
            hidden: true
        });

        // SmartSpawner Item Types
        fields.push({
            id: 'modal-spawnerItem',
            label: t('web-editor.modals.fields.spawner-item'),
            type: 'select',
            value: item.spawnerItem || (serverInfo.smartSpawnerItemTypes && serverInfo.smartSpawnerItemTypes[0]) || '',
            options: serverInfo.smartSpawnerItemTypes || serverInfo.materials || [],
            hint: t('web-editor.modals.fields.spawner-item-hint'),
            hidden: true
        });
    } else {
        if (serverInfo.entityTypes && serverInfo.entityTypes.length > 0) {
            fields.push({ 
                id: 'modal-spawnerType', 
                label: t('web-editor.modals.fields.spawner-type'), 
                type: 'select',
                value: item.spawnerType || 'ZOMBIE', 
                options: serverInfo.entityTypes,
                hint: t('web-editor.modals.fields.spawner-type-hint'),
                hidden: true
            });
        } else {
            fields.push({
                id: 'modal-spawnerType',
                label: t('web-editor.modals.fields.spawner-type'),
                value: item.spawnerType || 'ZOMBIE',
                hint: t('web-editor.modals.fields.spawner-type-hint'),
                hidden: true
            });
        }
    }

    // Potion specific (always present, visibility controlled by material input)
    fields.push({
        id: 'modal-potionType',
        label: t('web-editor.modals.fields.potion-type'),
        value: item.potionType || 'SWIFTNESS',
        hint: t('web-editor.modals.fields.potion-type-hint'),
        row: true,
        hidden: true
    });
    fields.push({
        id: 'modal-potionLevel',
        label: t('web-editor.modals.fields.potion-level'),
        type: 'number',
        value: item.potionLevel || 0,
        min: 0,
        max: 255,
        hint: t('web-editor.modals.fields.potion-level-hint'),
        row: true,
        hidden: true
    });

    const headMode = detectHeadTextureMode(item.headTexture || '');
    fields.push({
        id: 'modal-headTextureMode',
        label: 'Head Texture Type',
        type: 'select',
        value: headMode,
        options: [
            { value: 'id', label: 'Texture ID' },
            { value: 'url', label: 'Texture URL' },
            { value: 'base64', label: 'Base64 Value' }
        ],
        hidden: item.material !== 'PLAYER_HEAD',
        onchange: () => updateHeadTextureInputUi()
    });
    fields.push({
        id: 'modal-headTexture',
        label: 'Head Texture',
        value: item.headTexture || '',
        hidden: item.material !== 'PLAYER_HEAD',
        hint: 'Use texture ID, textures URL, or base64 depending on selected type.'
    });
    fields.push({
        id: 'modal-headOwner',
        label: 'Head Owner (optional)',
        value: item.headOwner || '',
        hidden: item.material !== 'PLAYER_HEAD',
        hint: 'Optional fallback owner name for player heads.'
    });

    fields.push({ id: 'modal-hideAttributes', label: t('web-editor.modals.fields.hide-attributes'), type: 'checkbox', value: item.hideAttributes });
    fields.push({ id: 'modal-hideAdditional', label: t('web-editor.modals.fields.hide-additional'), type: 'checkbox', value: item.hideAdditional });
    fields.push({ id: 'modal-requireName', label: t('web-editor.modals.fields.require-name'), type: 'checkbox', value: item.requireName, hint: t('web-editor.modals.fields.require-name-hint') });
    fields.push({ id: 'modal-requireLore', label: t('web-editor.modals.fields.require-lore'), type: 'checkbox', value: item.requireLore, hint: t('web-editor.modals.fields.require-lore-hint') });
    fields.push({ id: 'modal-unstableTnt', label: t('web-editor.modals.fields.unstable-tnt'), type: 'checkbox', value: item.unstableTnt, hidden: !item.material.toUpperCase().includes('TNT') });

    fields.push({
        id: 'modal-enableLimits',
        label: 'Enable Limits',
        type: 'checkbox',
        value: hasLimits,
        onchange: (e) => {
            const enabled = e.target.checked;
            const addGroup = document.getElementById('group-modal-add-limit');
            const playerGroup = document.getElementById('group-modal-limit');
            const globalGroup = document.getElementById('group-modal-globalLimit');
            if (!enabled) {
                if (addGroup) addGroup.style.display = 'none';
                if (playerGroup) playerGroup.style.display = 'none';
                if (globalGroup) globalGroup.style.display = 'none';
                return;
            }
            const playerInput = document.getElementById('modal-limit');
            const globalInput = document.getElementById('modal-globalLimit');
            const hasPlayer = playerInput && (parseInt(playerInput.value, 10) || 0) > 0;
            const hasGlobal = globalInput && (parseInt(globalInput.value, 10) || 0) > 0;
            if (playerGroup) playerGroup.style.display = hasPlayer ? 'block' : 'none';
            if (globalGroup) globalGroup.style.display = hasGlobal ? 'block' : 'none';
            if (addGroup) addGroup.style.display = (hasPlayer && hasGlobal) ? 'none' : 'block';
        }
    });

    fields.push({
        id: 'modal-add-limit',
        label: t('web-editor.modals.fields.add-limit'),
        type: 'select',
        value: '',
        options: [
            { value: '', label: t('web-editor.modals.fields.select-limit') },
            { value: 'player', label: t('web-editor.modals.fields.player-limit') },
            { value: 'global', label: t('web-editor.modals.fields.global-limit') }
        ],
        hidden: !hasLimits || (item.limit > 0 && item.globalLimit > 0),
        onchange: (e) => {
            const val = e.target.value;
            if (val === 'player') {
                const group = document.getElementById('group-modal-limit');
                if (group) group.style.display = 'block';
            } else if (val === 'global') {
                const group = document.getElementById('group-modal-globalLimit');
                if (group) group.style.display = 'block';
            }
            e.target.value = '';
            e.target.dispatchEvent(new Event('refresh'));

            // Hide add-limit dropdown if both limits are now shown
            const pGroup = document.getElementById('group-modal-limit');
            const gGroup = document.getElementById('group-modal-globalLimit');
            const addGroup = document.getElementById('group-modal-add-limit');
            if (pGroup && gGroup && addGroup && pGroup.style.display !== 'none' && gGroup.style.display !== 'none') {
                addGroup.style.display = 'none';
            }
        }
    });

    fields.push({
        id: 'modal-limit',
        label: t('web-editor.modals.fields.player-limit'),
        type: 'number',
        value: item.limit || 0,
        min: 0,
        hint: t('web-editor.modals.fields.player-limit-hint'),
        removeable: true,
        hidden: !hasLimits || !item.limit,
        onRemove: () => {
            const input = document.getElementById('modal-limit');
            if (input) input.value = 0;
            const group = document.getElementById('group-modal-limit');
            if (group) group.style.display = 'none';
            
            const addGroup = document.getElementById('group-modal-add-limit');
            if (addGroup) addGroup.style.display = 'block';
        }
    });

    fields.push({
        id: 'modal-globalLimit',
        label: t('web-editor.modals.fields.global-limit'),
        type: 'number',
        value: item.globalLimit || 0,
        min: 0,
        hint: t('web-editor.modals.fields.global-limit-hint'),
        removeable: true,
        hidden: !hasLimits || !item.globalLimit,
        onRemove: () => {
            const input = document.getElementById('modal-globalLimit');
            if (input) input.value = 0;
            const group = document.getElementById('group-modal-globalLimit');
            if (group) group.style.display = 'none';
            
            const addGroup = document.getElementById('group-modal-add-limit');
            if (addGroup) addGroup.style.display = 'block';
        }
    });

    fields.push({ 
        id: 'modal-dynamicPricing', 
        label: t('web-editor.modals.fields.dynamic-pricing'), 
        type: 'checkbox', 
        value: item.dynamicPricing,
        onchange: (e) => {
            const isDynamic = e.target.checked;
            ['group-modal-minPrice', 'group-modal-maxPrice', 'group-modal-priceChange'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = isDynamic ? 'block' : 'none';
            });
        }
    });
    fields.push({ id: 'modal-minPrice', label: t('web-editor.modals.fields.min-price'), type: 'number', value: item.minPrice || 0, hint: t('web-editor.modals.fields.min-price-hint'), hidden: !item.dynamicPricing });
    fields.push({ id: 'modal-maxPrice', label: t('web-editor.modals.fields.max-price'), type: 'number', value: item.maxPrice || 0, hint: t('web-editor.modals.fields.max-price-hint'), hidden: !item.dynamicPricing });
    fields.push({ id: 'modal-priceChange', label: t('web-editor.modals.fields.price-change'), type: 'number', value: item.priceChange || 0, step: '0.01', hint: t('web-editor.modals.fields.price-change-hint'), hidden: !item.dynamicPricing });
    fields.push({
        id: 'modal-enableCommands',
        label: 'Enable Commands',
        type: 'checkbox',
        value: hasCommands,
        onchange: (e) => {
            const enabled = e.target.checked;
            const commandsGroup = document.getElementById('group-modal-commands');
            const runAsGroup = document.getElementById('group-modal-runAs');
            const runOnlyGroup = document.getElementById('group-modal-runCommandOnly');
            if (commandsGroup) commandsGroup.style.display = enabled ? 'block' : 'none';
            if (runAsGroup) runAsGroup.style.display = enabled ? 'block' : 'none';
            if (runOnlyGroup) runOnlyGroup.style.display = enabled ? 'block' : 'none';
        }
    });
    fields.push({ id: 'modal-commands', label: t('web-editor.modals.fields.commands', 'Commands'), type: 'textarea', value: (item.commands || []).join('\n'), hint: t('web-editor.modals.fields.commands-hint', 'Commands to run on purchase (%player%, %amount%, %item%, %price%)'), hidden: !hasCommands });
    fields.push({
        id: 'modal-runAs',
        label: 'Run commands as',
        type: 'select',
        value: (item.runAs || 'console').toLowerCase() === 'player' ? 'player' : 'console',
        options: [
            { value: 'console', label: 'console' },
            { value: 'player', label: 'player' }
        ],
        hint: 'Executor for item commands',
        hidden: !hasCommands
    });
    fields.push({ id: 'modal-runCommandOnly', label: t('web-editor.modals.fields.run-command-only', 'Run Command Only'), type: 'checkbox', value: item.runCommandOnly !== false, hint: t('web-editor.modals.fields.run-command-only-hint', 'If enabled, the item will not be given to the player if commands are present.'), hidden: !hasCommands });
    fields.push({ id: 'modal-permission', label: t('web-editor.modals.fields.permission', 'Permission'), value: item.permission || '', hint: t('web-editor.modals.fields.permission-hint', 'Optional permission required to buy/sell this item.') });
    fields.push({ id: 'modal-sellAddsToStock', label: 'Sell adds back to stock', type: 'checkbox', value: item.sellAddsToStock === true, hint: 'Override shop setting for this item' });
    fields.push({ id: 'modal-allowSellStockOverflow', label: 'Allow sell stock overflow', type: 'checkbox', value: item.allowSellStockOverflow === true, hint: 'If disabled, selling is blocked when stock is already full' });
    const itemStockReset = sanitizeStockResetRule(item.stockResetRule);
    fields.push({
        id: 'modal-stockResetEnabled',
        label: 'Enable stock reset for this item',
        type: 'checkbox',
        value: itemStockReset.enabled,
        onchange: () => updateStockResetInputUi()
    });
    fields.push({
        id: 'modal-stockResetType',
        label: 'Reset frequency',
        type: 'select',
        value: itemStockReset.type,
        options: [
            { value: 'daily', label: 'Daily' },
            { value: 'hourly', label: 'Hourly' },
            { value: 'minute-interval', label: 'Minute Interval' },
            { value: 'second-interval', label: 'Second Interval' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'yearly', label: 'Yearly' },
            { value: 'once', label: 'Once' }
        ],
        onchange: () => updateStockResetInputUi()
    });
    fields.push({ id: 'modal-stockResetTime', label: 'Time of day (HH:mm or HH:mm:ss)', value: itemStockReset.time || '00:00' });
    fields.push({ id: 'modal-stockResetInterval', label: 'Interval value', type: 'number', value: itemStockReset.interval || 1, min: 1, hint: 'Used by Minute Interval and Second Interval types' });
    fields.push({
        id: 'modal-stockResetDayOfWeek',
        label: 'Day of week',
        type: 'select',
        value: itemStockReset.dayOfWeek || 'MONDAY',
        options: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
    });
    fields.push({ id: 'modal-stockResetDayOfMonth', label: 'Day of month (1-31)', type: 'number', value: itemStockReset.dayOfMonth || 1, min: 1, max: 31 });
    fields.push({ id: 'modal-stockResetMonth', label: 'Month (1-12)', type: 'number', value: itemStockReset.month || 1, min: 1, max: 12 });
    fields.push({ id: 'modal-stockResetDate', label: 'Exact date (YYYY-MM-DD)', value: itemStockReset.date || '' });
    fields.push({ id: 'modal-stockResetTimezone', label: 'Timezone (optional)', value: itemStockReset.timezone || '', hint: 'Example: Europe/Copenhagen or UTC' });
    fields.push({
        id: 'modal-showStock',
        label: 'Show stock line',
        type: 'checkbox',
        value: !!item.showStock,
        hint: 'Used when Shop Item Lore Format contains %global-limit%'
    });
    fields.push({
        id: 'modal-showStockResetTimer',
        label: 'Enable stock reset timer token',
        type: 'checkbox',
        value: !!item.showStockResetTimer,
        hint: 'Used when Shop Item Lore Format contains %stock-reset-timer%'
    });

    openEditModal({
        titleHtml: `
            <div class="flex items-center gap-12">
                <span data-i18n="web-editor.modals.edit-item">Edit Item</span><span>:</span>
                <div class="editable-header-key" title="Click to edit Material">
                    <label for="modal-material" class="sr-only">Material</label>
                    <input type="text" id="modal-material" name="material" value="${item.material}" class="header-key-input" oninput="handleShopItemMaterialChange(this.value)">
                    <span class="header-key-label" id="modal-material-label">${item.material}</span>
                    <span class="edit-icon">✎</span>
                </div>
            </div>
        `,
        fields: fields,
        onSave: (data) => {
            const beforeData = JSON.parse(JSON.stringify(item));

            const newMaterial = document.getElementById('modal-material')?.value.toUpperCase() || item.material;
            item.material = newMaterial;
            item.name = data['modal-name'];
            item.price = parseFloat(data['modal-price']) || 0;
            item.sellPrice = parseFloat(data['modal-sellPrice']) || 0;
            item.amount = parseInt(data['modal-amount']) || 1;
            item.lore = data['modal-enableLore'] ? data['modal-lore'].split('\n') : [];
            item.slot = parseInt(data['modal-slot']) || 0;

            const enchantments = {};
            if (data['modal-enableEnchantments'] && data['modal-enchantments'].trim()) {
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

            const isSpawnerMaterial = item.material === 'SPAWNER' || item.material === 'TRIAL_SPAWNER';
            if (isSpawnerMaterial && serverInfo.smartSpawnerEnabled) {
                const spawnerMode = data['modal-spawnerMode'];
                if (spawnerMode === 'ITEM') {
                    item.spawnerItem = (data['modal-spawnerItem'] || '').toUpperCase();
                    delete item.spawnerType;
                } else {
                    item.spawnerType = (data['modal-spawnerType'] || 'ZOMBIE').toUpperCase();
                    delete item.spawnerItem;
                }
            } else if (isSpawnerMaterial) {
                if (data['modal-spawnerType']) item.spawnerType = data['modal-spawnerType'].toUpperCase();
                else delete item.spawnerType;
                delete item.spawnerItem;
            } else {
                delete item.spawnerType;
                delete item.spawnerItem;
            }

            const isPotionMaterial = item.material.includes('POTION') || item.material === 'TIPPED_ARROW';
            if (isPotionMaterial) {
                item.potionType = (data['modal-potionType'] || item.potionType || 'SWIFTNESS').toUpperCase();
                item.potionLevel = parseInt(data['modal-potionLevel']) || 0;
            } else {
                delete item.potionType;
                item.potionLevel = 0;
            }

            if (item.material === 'PLAYER_HEAD') {
                item.headTexture = (data['modal-headTexture'] || '').trim();
                item.headOwner = (data['modal-headOwner'] || '').trim();
            } else {
                item.headTexture = '';
                item.headOwner = '';
            }

            item.hideAttributes = data['modal-hideAttributes'];
            item.hideAdditional = data['modal-hideAdditional'];
            item.requireName = data['modal-requireName'];
            item.requireLore = data['modal-requireLore'];
            item.unstableTnt = data['modal-unstableTnt'];

            item.limit = data['modal-enableLimits'] ? (parseInt(data['modal-limit']) || 0) : 0;
            item.globalLimit = data['modal-enableLimits'] ? (parseInt(data['modal-globalLimit']) || 0) : 0;

            item.dynamicPricing = data['modal-dynamicPricing'];
            item.minPrice = parseFloat(data['modal-minPrice']) || 0;
            item.maxPrice = parseFloat(data['modal-maxPrice']) || 0;
            item.priceChange = parseFloat(data['modal-priceChange']) || 0;
            item.commands = data['modal-enableCommands']
                ? data['modal-commands'].split('\n').filter(line => line.trim() !== '')
                : [];
            item.runAs = data['modal-enableCommands']
                ? ((data['modal-runAs'] || 'console').toLowerCase() === 'player' ? 'player' : 'console')
                : 'console';
            item.runCommandOnly = data['modal-enableCommands'] ? data['modal-runCommandOnly'] : true;
            item.permission = data['modal-permission'] || '';
            item.sellAddsToStock = !!data['modal-sellAddsToStock'];
            item.allowSellStockOverflow = !!data['modal-allowSellStockOverflow'];
            item.stockResetRule = readStockResetFromModal(data);
            item.showStock = !!data['modal-showStock'];
            item.showStockResetTimer = !!data['modal-showStockResetTimer'];

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

    setTimeout(() => {
        handleShopItemMaterialChange(item.material);
        updateHeadTextureInputUi();
        updateStockResetInputUi();
    }, 0);
}

function openShopSettingsModal() {
    const settings = currentShopSettings || {};
    const stockReset = sanitizeStockResetRule(settings.stockResetRule);
    const hasShopTimes = !!(settings.availableTimes && settings.availableTimes.trim().length > 0);

    openEditModal({
        title: 'Edit Shop Settings',
        fields: [
            { id: 'modal-shopRows', label: 'Rows (1-6)', type: 'number', value: settings.rows || 3, min: 1, max: 6, row: true },
            { id: 'modal-shopPermission', label: 'Permission (optional)', value: settings.permission || '', row: true },
            {
                id: 'modal-enableShopTimes',
                label: 'Enable Available Times',
                type: 'checkbox',
                value: hasShopTimes,
                onchange: (e) => {
                    const group = document.getElementById('group-modal-shopTimes');
                    if (group) group.style.display = e.target.checked ? 'block' : 'none';
                }
            },
            { id: 'modal-shopTimes', label: 'Available Times (one per line)', type: 'textarea', value: settings.availableTimes || '', hidden: !hasShopTimes },
            { id: 'modal-shopSellAddsToStock', label: 'Sell adds back to stock', type: 'checkbox', value: settings.sellAddsToStock === true },
            { id: 'modal-shopAllowSellStockOverflow', label: 'Allow sell stock overflow', type: 'checkbox', value: settings.allowSellStockOverflow === true },
            {
                id: 'modal-stockResetEnabled',
                label: 'Enable stock reset for this shop',
                type: 'checkbox',
                value: stockReset.enabled,
                onchange: () => updateStockResetInputUi()
            },
            {
                id: 'modal-stockResetType',
                label: 'Reset frequency',
                type: 'select',
                value: stockReset.type,
                options: [
                    { value: 'daily', label: 'Daily' },
                    { value: 'hourly', label: 'Hourly' },
                    { value: 'minute-interval', label: 'Minute Interval' },
                    { value: 'second-interval', label: 'Second Interval' },
                    { value: 'weekly', label: 'Weekly' },
                    { value: 'monthly', label: 'Monthly' },
                    { value: 'yearly', label: 'Yearly' },
                    { value: 'once', label: 'Once' }
                ],
                onchange: () => updateStockResetInputUi()
            },
            { id: 'modal-stockResetTime', label: 'Time of day (HH:mm or HH:mm:ss)', value: stockReset.time || '00:00' },
            { id: 'modal-stockResetInterval', label: 'Interval value', type: 'number', value: stockReset.interval || 1, min: 1, hint: 'Used by Minute Interval and Second Interval types' },
            {
                id: 'modal-stockResetDayOfWeek',
                label: 'Day of week',
                type: 'select',
                value: stockReset.dayOfWeek || 'MONDAY',
                options: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
            },
            { id: 'modal-stockResetDayOfMonth', label: 'Day of month (1-31)', type: 'number', value: stockReset.dayOfMonth || 1, min: 1, max: 31 },
            { id: 'modal-stockResetMonth', label: 'Month (1-12)', type: 'number', value: stockReset.month || 1, min: 1, max: 12 },
            { id: 'modal-stockResetDate', label: 'Exact date (YYYY-MM-DD)', value: stockReset.date || '' },
            { id: 'modal-stockResetTimezone', label: 'Timezone (optional)', value: stockReset.timezone || '', hint: 'Example: Europe/Copenhagen or UTC' }
        ],
        onSave: (data) => {
            const beforeData = JSON.parse(JSON.stringify(currentShopSettings));

            const nextRows = Math.max(1, Math.min(6, parseInt(data['modal-shopRows'], 10) || 3));
            currentShopSettings.rows = nextRows;
            currentShopSettings.permission = (data['modal-shopPermission'] || '').trim();
            currentShopSettings.availableTimes = data['modal-enableShopTimes'] ? (data['modal-shopTimes'] || '').trim() : '';
            currentShopSettings.sellAddsToStock = !!data['modal-shopSellAddsToStock'];
            currentShopSettings.allowSellStockOverflow = !!data['modal-shopAllowSellStockOverflow'];
            currentShopSettings.stockResetRule = readStockResetFromModal(data);

            addActivityEntry('updated', 'shop-settings', beforeData, JSON.parse(JSON.stringify(currentShopSettings)), {
                shopFile: currentShopFile
            });

            updateAll();
            showToast('Shop settings updated', 'success');
        }
    });

    setTimeout(() => {
        updateStockResetInputUi();
    }, 0);
}

function openMainMenuShopModal(index) {
    const shop = loadedGuiShops[index];
    if (!shop) return;

    const shopOptions = [];
    Object.keys(allShops).sort().forEach(filename => {
        const nameWithoutYml = filename.replace('.yml', '');
        shopOptions.push({ value: nameWithoutYml, label: filename });
    });

    const rawAction = (shop.action || '').toString().trim().toLowerCase();
    let effectiveAction = rawAction;
    if (!effectiveAction) {
        if (shop.shopKey) {
            effectiveAction = 'shop-key';
        } else if ((shop.commands || []).length > 0) {
            effectiveAction = 'command';
        } else {
            effectiveAction = 'no-action';
        }
    }
    if (effectiveAction === 'shop') {
        effectiveAction = 'shop-key';
    }
    if (effectiveAction === 'command' && shop.closeAfterAction) {
        effectiveAction = 'command-close';
    }

    openEditModal({
        titleHtml: `
            <div class="flex items-center gap-12">
                <span>Edit Menu Button:</span>
                <div class="editable-header-key" title="Click to edit Unique Key">
                    <label for="modal-key" class="sr-only">Unique Key</label>
                    <input type="text" id="modal-key" name="unique-key" value="${shop.key}" class="header-key-input">
                    <span class="header-key-label">${shop.key}</span>
                    <span class="edit-icon">✎</span>
                </div>
            </div>
        `,
        fields: [
            { id: 'modal-material', label: 'Material', value: shop.material, row: true },
            { id: 'modal-slot', label: 'Slot (0-53)', type: 'number', value: shop.slot, min: 0, max: 53, row: true },
            { id: 'modal-name', label: 'Display Name', value: shop.name },
            {
                id: 'modal-action',
                label: 'Action',
                type: 'select',
                value: effectiveAction,
                options: [
                    { value: 'shop-key', label: 'shop-key' },
                    { value: 'command', label: 'command' },
                    { value: 'command-close', label: 'command-close' },
                    { value: 'close', label: 'close' },
                    { value: 'no-action', label: 'no-action' }
                ],
                hint: 'Choose what this button does when clicked',
                onchange: (e) => {
                    const action = (e.target.value || '').toLowerCase();
                    const showShop = action === 'shop-key';
                    const showCommands = action === 'command' || action === 'command-close';
                    const shopGroup = document.getElementById('group-modal-shopKey');
                    const commandsGroup = document.getElementById('group-modal-commands');
                    const runAsGroup = document.getElementById('group-modal-runAs');
                    if (shopGroup) shopGroup.style.display = showShop ? '' : 'none';
                    if (commandsGroup) commandsGroup.style.display = showCommands ? '' : 'none';
                    if (runAsGroup) runAsGroup.style.display = showCommands ? '' : 'none';
                }
            },
            { 
                id: 'modal-shopKey', 
                label: 'Linked Shop File', 
                type: 'select', 
                value: shop.shopKey || (shopOptions[0]?.value || ''), 
                options: shopOptions,
                hint: 'Choose which shop opens when this button is clicked',
                hidden: effectiveAction !== 'shop-key'
            },
            {
                id: 'modal-commands',
                label: 'Commands (one per line)',
                type: 'textarea',
                value: (shop.commands || []).join('\n'),
                hint: 'Commands executed when action is command/command-close',
                hidden: effectiveAction !== 'command' && effectiveAction !== 'command-close'
            },
            {
                id: 'modal-runAs',
                label: 'Run commands as',
                type: 'select',
                value: (shop.runAs || 'player').toLowerCase() === 'console' ? 'console' : 'player',
                options: [
                    { value: 'player', label: 'player' },
                    { value: 'console', label: 'console' }
                ],
                hint: 'Executor for main-menu commands',
                hidden: effectiveAction !== 'command' && effectiveAction !== 'command-close'
            },
            { id: 'modal-permission', label: 'Required Permission', value: shop.permission, hint: 'Leave empty for no permission' },
            { id: 'modal-lore', label: 'Lore (one per line)', type: 'textarea', value: shop.lore.join('\n') },
            { id: 'modal-hideAttributes', label: 'Hide Attributes', type: 'checkbox', value: shop.hideAttributes },
            { id: 'modal-hideAdditional', label: 'Hide Additional Info', type: 'checkbox', value: shop.hideAdditional }
        ],
        onSave: (data) => {
            const beforeData = JSON.parse(JSON.stringify(shop));
            
            const newKey = document.getElementById('modal-key')?.value || shop.key;
            shop.key = newKey;
            shop.material = data['modal-material'];
            shop.name = data['modal-name'];
            shop.slot = parseInt(data['modal-slot']);
            shop.action = (data['modal-action'] || 'no-action').toLowerCase();
            shop.shopKey = '';
            shop.commands = [];
            shop.runAs = 'player';

            if (shop.action === 'shop-key') {
                shop.shopKey = data['modal-shopKey'] || '';
                if (!shop.shopKey) {
                    shop.action = 'no-action';
                }
            } else if (shop.action === 'command' || shop.action === 'command-close') {
                shop.commands = (data['modal-commands'] || '')
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0);
                shop.runAs = (data['modal-runAs'] || 'player').toLowerCase() === 'console' ? 'console' : 'player';
            }

            delete shop.closeAfterAction;
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

function openMainTransactionItemModal(type) {
    const settings = transactionSettings[type];
    
    openEditModal({
        titleHtml: `
            <div class="flex items-center gap-12">
                <span data-i18n="web-editor.modals.edit-main-item">Edit Main Item</span><span>:</span>
                <div class="editable-header-key" title="Click to edit Material">
                    <label for="modal-material" class="sr-only">Material</label>
                    <input type="text" id="modal-material" name="material" value="${settings.displayMaterial || 'BARRIER'}" class="header-key-input" oninput="document.getElementById('modal-material-label').textContent = this.value.toUpperCase()">
                    <span class="header-key-label" id="modal-material-label">${settings.displayMaterial || 'BARRIER'}</span>
                    <span class="edit-icon">✎</span>
                </div>
            </div>
        `,
        fields: [
            { id: 'modal-slot', label: t('web-editor.modals.fields.slot', 'Slot (0-53)'), type: 'number', value: settings.displaySlot !== undefined ? settings.displaySlot : 22, min: 0, max: 53 }
        ],
        onSave: (data) => {
            const beforeData = {
                displayMaterial: settings.displayMaterial,
                displaySlot: settings.displaySlot
            };
            
            const newMaterial = document.getElementById('modal-material')?.value.toUpperCase() || settings.displayMaterial;
            settings.displayMaterial = newMaterial;
            settings.displaySlot = parseInt(data['modal-slot']);
            if (isNaN(settings.displaySlot)) settings.displaySlot = 22;

            addActivityEntry('updated', `${type}-main-item`, beforeData, {
                displayMaterial: settings.displayMaterial,
                displaySlot: settings.displaySlot
            });

            if (type === 'purchase') {
                updatePurchasePreview();
                renderPurchaseButtons();
            } else {
                updateSellPreview();
                renderSellButtons();
            }
            scheduleAutoSave();
        }
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
        { id: 'modal-slot', label: 'Slot (0-53)', type: 'number', value: button.slot, min: 0, max: 53 },
        { id: 'modal-lore', label: 'Lore', type: 'textarea', value: (button.lore || []).join('\n') }
    ];

    const modalConfig = {
        title: title,
        fields: fields,
        onSave: (data) => {
            const beforeData = JSON.parse(JSON.stringify(button));
            
            if (group === 'main') {
                const newMaterial = document.getElementById('modal-material')?.value.toUpperCase() || data['modal-material'];
                if (newMaterial) button.material = newMaterial;
            }
            button.name = data['modal-name'];
            button.slot = parseInt(data['modal-slot']);
            button.lore = data['modal-lore'].split('\n');

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
    };

    if (group === 'main') {
        modalConfig.titleHtml = `
            <div class="flex items-center gap-12">
                <span>${title}</span><span>:</span>
                <div class="editable-header-key" title="Click to edit Material">
                    <label for="modal-material" class="sr-only">Material</label>
                    <input type="text" id="modal-material" name="material" value="${button.material}" class="header-key-input" oninput="document.getElementById('modal-material-label').textContent = this.value.toUpperCase()">
                    <span class="header-key-label" id="modal-material-label">${button.material}</span>
                    <span class="edit-icon">✎</span>
                </div>
            </div>
        `;
        delete modalConfig.title;
    }

    openEditModal(modalConfig);
}

function openActivityLogModal() {
    const modal = document.getElementById('activity-log-modal');
    refreshActivityLog();
    document.body.style.overflow = 'hidden';

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
    const detailModal = document.getElementById('activity-detail-modal');

    const modalBox = modal.querySelector('.modal-box');
    if (modalBox && !animationsDisabled) {
        modalBox.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            modal.style.display = 'none';
            if (!detailModal || detailModal.style.display !== 'flex') {
                document.body.style.overflow = '';
            }
        }, 300);
    } else {
        modal.style.display = 'none';
        if (!detailModal || detailModal.style.display !== 'flex') {
            document.body.style.overflow = '';
        }
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
    document.body.style.overflow = 'hidden';
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
    const logModal = document.getElementById('activity-log-modal');

    const modalBox = modal.querySelector('.modal-box');
    if (modalBox && !animationsDisabled) {
        modalBox.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            modal.style.display = 'none';
            currentViewedEntry = null;
            if (!logModal || logModal.style.display !== 'flex') {
                document.body.style.overflow = '';
            }
        }, 300);
    } else {
        modal.style.display = 'none';
        currentViewedEntry = null;
        if (!logModal || logModal.style.display !== 'flex') {
            document.body.style.overflow = '';
        }
    }
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
