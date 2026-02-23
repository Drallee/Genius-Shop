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
    setEditorState('activeSaveMode', mode);
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
        if (currentTab === 'campaigns') {
            return change.target === 'campaign-settings' ||
                (change.target === 'shop-settings' && (
                    !change.details ||
                    change.details.shopFile === currentShopFile ||
                    change.details.campaignHub === true
                )) ||
                (change.target === 'shop-item' && change.details && change.details.campaignHub === true);
        }
        if (currentTab === 'guisettings') {
            return change.target === 'gui-settings' || change.target === 'config-settings';
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

function getModalFieldValues(fields) {
    const values = {};
    if (!fields || !Array.isArray(fields)) return values;
    fields.forEach(field => {
        const element = document.getElementById(field.id);
        if (!element) return;
        values[field.id] = field.type === 'checkbox' ? element.checked : element.value;
    });
    return values;
}

function refreshModalSidePreview() {
    if (!currentModalData || !currentModalData.preview || !currentModalData.fields) return;
    const preview = currentModalData.preview;
    if (typeof preview.render !== 'function') return;

    const contentEl = document.getElementById('modal-side-preview-content');
    if (!contentEl) return;

    const values = getModalFieldValues(currentModalData.fields);
    const html = preview.render(values);
    contentEl.innerHTML = html || '<div class="modal-preview-empty">No preview available</div>';
}

function isModalPreviewCollapsed() {
    try {
        return localStorage.getItem('shop.modalPreviewCollapsed') === 'true';
    } catch (e) {
        return false;
    }
}

function setModalPreviewCollapsed(collapsed) {
    try {
        localStorage.setItem('shop.modalPreviewCollapsed', collapsed ? 'true' : 'false');
    } catch (e) {
        // ignore storage failures
    }
}

function applyModalPreviewCollapsedState(collapsed) {
    const previewEl = document.getElementById('modal-side-preview');
    const floatingToggleBtn = document.getElementById('modal-preview-toggle-floating');
    const layoutEl = document.querySelector('#modal-content .modal-editor-layout');
    if (previewEl) {
        previewEl.classList.toggle('collapsed', !!collapsed);
    }
    if (layoutEl) {
        layoutEl.classList.toggle('preview-collapsed', !!collapsed);
    }
    if (floatingToggleBtn) {
        floatingToggleBtn.textContent = collapsed ? 'Show Preview' : 'Hide Preview';
    }
}

function toggleModalSidePreview() {
    const collapsed = !isModalPreviewCollapsed();
    setModalPreviewCollapsed(collapsed);
    applyModalPreviewCollapsedState(collapsed);
}

function openEditModal(data) {
    currentModalData = data;
    const modal = document.getElementById('edit-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    const deleteBtn = document.getElementById('modal-delete-btn');
    const footer = modal.querySelector('.modal-footer');

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
                } else if (field.type === 'file') {
                    fHtml += `<input type="file" id="${field.id}" name="${field.id}" class="input-base" ${field.accept ? `accept="${escapeHtml(field.accept)}"` : ''}>`;
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
            const grouped = {};
            checkboxes.forEach(cb => {
                const key = cb.checkboxGroup || 'Options';
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(cb);
            });

            html += '<div class="checkbox-grid">';
            Object.entries(grouped).forEach(([groupName, groupFields]) => {
                html += `<div class="checkbox-group-card"><div class="checkbox-group-title">${escapeHtml(groupName)}</div>`;
                groupFields.forEach(cb => {
                    html += renderField(cb);
                });
                html += '</div>';
            });
            html += '</div>';
        }

        if (data.preview && data.preview.enabled) {
            const previewTitle = escapeHtml(data.preview.title || 'Preview');
            modalContent.innerHTML = `
                <div class="modal-editor-layout">
                    <div class="modal-editor-form">
                        <div class="modal-form-top-actions">
                            <button type="button" class="btn-base btn-secondary modal-preview-toggle" id="modal-preview-toggle-floating" onclick="toggleModalSidePreview()">Hide Preview</button>
                        </div>
                        ${html}
                    </div>
                    <aside class="modal-side-preview" id="modal-side-preview">
                        <div class="modal-side-preview-title-row">
                            <div class="modal-side-preview-title">${previewTitle}</div>
                        </div>
                        <div id="modal-side-preview-content"></div>
                    </aside>
                </div>
            `;
        } else {
            modalContent.innerHTML = html;
        }

        // Attach event listeners
        data.fields.forEach(field => {
            const el = document.getElementById(field.id);
            if (el) {
                if (field.onchange) {
                    el.addEventListener('change', (e) => {
                        field.onchange(e);
                        refreshModalSidePreview();
                    });
                }
                if (field.oninput) {
                    el.addEventListener('input', (e) => {
                        field.oninput(e);
                        refreshModalSidePreview();
                    });
                }
                el.addEventListener('change', refreshModalSidePreview);
                if (field.type !== 'checkbox') {
                    el.addEventListener('input', refreshModalSidePreview);
                }
            }
            if (field.onRemove) {
                const removeBtn = document.getElementById(`remove-${field.id}`);
                if (removeBtn) {
                    removeBtn.addEventListener('click', (e) => {
                        field.onRemove(e);
                        refreshModalSidePreview();
                    });
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

    // Extra modal actions (e.g. clone item)
    const existingExtra = footer ? footer.querySelector('.modal-extra-actions') : null;
    if (existingExtra) existingExtra.remove();
    if (footer && Array.isArray(data.extraActions) && data.extraActions.length > 0) {
        const extraWrap = document.createElement('div');
        extraWrap.className = 'modal-extra-actions flex gap-12';
        extraWrap.style.marginRight = 'auto';

        data.extraActions.forEach((action, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = action.id || `modal-extra-action-${idx}`;
            btn.className = `btn-base ${action.className || 'btn-secondary'}`;
            btn.textContent = action.label || 'Action';
            btn.addEventListener('click', () => {
                if (typeof action.onClick === 'function') action.onClick();
            });
            extraWrap.appendChild(btn);
        });

        footer.insertBefore(extraWrap, footer.firstChild);
    }

    // Prevent background scrolling
    document.body.style.overflow = 'hidden';

    modal.style.display = 'flex';

    // Add bounce-in animation to modal content (only if animations enabled)
    const modalBox = modal.querySelector('.modal-box');
    const animationsDisabled = document.body.classList.contains('no-animations');
    if (modalBox) {
        modalBox.classList.toggle('modal-box-with-preview', !!(data.preview && data.preview.enabled));
    }

    if (modalBox && !animationsDisabled) {
        modalBox.style.animation = 'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
    } else if (modalBox) {
        modalBox.style.animation = 'none';
    }

    initCustomSelects();
    applyModalPreviewCollapsedState(isModalPreviewCollapsed());
    refreshModalSidePreview();
}

function closeEditModal() {
    const modal = document.getElementById('edit-modal');
    const modalBox = modal.querySelector('.modal-box');
    const animationsDisabled = document.body.classList.contains('no-animations');
    if (modalBox) {
        modalBox.classList.remove('modal-box-with-preview');
    }

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

    refreshModalSidePreview();
}

function formatModalPreviewPrice(value) {
    const num = Number(value) || 0;
    if (typeof formatDisplayPrice === 'function') {
        return formatDisplayPrice(num);
    }
    if (Number.isInteger(num)) return String(num);
    return num.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function getModalPreviewItemIcon(itemData) {
    if (typeof getShopItemIconUrl === 'function') {
        return getShopItemIconUrl(itemData);
    }
    const material = itemData && itemData.material ? itemData.material : 'STONE';
    return `${TEXTURE_API}${String(material).toLowerCase()}.png`;
}

function buildShopItemPreviewHtml(baseItem, formData) {
    const materialInput = document.getElementById('modal-material');
    const material = ((materialInput && materialInput.value) || baseItem.material || 'STONE').toUpperCase();
    const isSpawnerMaterial = material === 'SPAWNER' || material === 'TRIAL_SPAWNER';
    const isPotionMaterial = material.includes('POTION') || material === 'TIPPED_ARROW';
    const isHeadMaterial = material === 'PLAYER_HEAD';
    const amount = Math.max(1, parseInt(formData['modal-amount'], 10) || 1);
    const buyPrice = parseFloat(formData['modal-price']) || 0;
    const sellPrice = parseFloat(formData['modal-sellPrice']) || 0;
    const buyPerItem = (formData['modal-buyPricePerItem'] || 'per-item') === 'per-item';
    const sellPerItem = (formData['modal-sellPricePerItem'] || 'per-item') === 'per-item';
    const campaignEnabled = !!formData['modal-campaignEnabled'];
    const campaignName = (formData['modal-campaignName'] || '').trim();
    const campaignStart = (formData['modal-campaignStart'] || '').trim();
    const campaignEnd = (formData['modal-campaignEnd'] || '').trim();
    const campaignTimezone = (formData['modal-campaignTimezone'] || '').trim();
    const campaignBuyMultiplierRaw = parseFloat(formData['modal-campaignBuyMultiplier']);
    const campaignSellMultiplierRaw = parseFloat(formData['modal-campaignSellMultiplier']);
    const campaignBuyMultiplier = Number.isFinite(campaignBuyMultiplierRaw) && campaignBuyMultiplierRaw > 0 ? campaignBuyMultiplierRaw : 1;
    const campaignSellMultiplier = Number.isFinite(campaignSellMultiplierRaw) && campaignSellMultiplierRaw > 0 ? campaignSellMultiplierRaw : 1;
    const name = formData['modal-name'] || baseItem.name || '&eItem';

    const baseBuyTotal = buyPerItem ? (buyPrice * amount) : buyPrice;
    const baseSellTotal = sellPerItem ? (sellPrice * amount) : sellPrice;
    const buyTotal = campaignEnabled ? (baseBuyTotal * campaignBuyMultiplier) : baseBuyTotal;
    const sellTotal = campaignEnabled ? (baseSellTotal * campaignSellMultiplier) : baseSellTotal;
    const enableEnchantments = !!formData['modal-enableEnchantments'];
    const enchantmentLines = enableEnchantments && formData['modal-enchantments']
        ? String(formData['modal-enchantments']).split('\n').map(l => l.trim()).filter(Boolean)
        : [];
    const enableCommands = !!formData['modal-enableCommands'];
    const commandLines = enableCommands && formData['modal-commands']
        ? String(formData['modal-commands']).split('\n').map(l => l.trim()).filter(Boolean)
        : [];
    const runAs = (formData['modal-runAs'] || 'console').toLowerCase() === 'player' ? 'player' : 'console';
    const runCommandOnly = !!formData['modal-runCommandOnly'];
    const playerLimit = !!formData['modal-enableLimits'] ? (parseInt(formData['modal-limit'], 10) || 0) : 0;
    const globalLimit = !!formData['modal-enableLimits'] ? (parseInt(formData['modal-globalLimit'], 10) || 0) : 0;
    const dynamicPricing = !!formData['modal-dynamicPricing'];
    const minPrice = parseFloat(formData['modal-minPrice']) || 0;
    const maxPrice = parseFloat(formData['modal-maxPrice']) || 0;
    const priceChange = parseFloat(formData['modal-priceChange']) || 0;
    const permission = (formData['modal-permission'] || '').trim();
    const hideAttributes = !!formData['modal-hideAttributes'];
    const hideAdditional = !!formData['modal-hideAdditional'];
    const requireName = !!formData['modal-requireName'];
    const requireLore = !!formData['modal-requireLore'];
    const unstableTnt = !!formData['modal-unstableTnt'];
    const showStock = !!formData['modal-showStock'];
    const showStockResetTimer = !!formData['modal-showStockResetTimer'];
    const sellAddsToStock = !!formData['modal-sellAddsToStock'];
    const allowSellOverflow = !!formData['modal-allowSellStockOverflow'];
    const stockResetEnabled = !!formData['modal-stockResetEnabled'];
    const stockResetType = stockResetEnabled ? (formData['modal-stockResetType'] || 'daily') : null;
    const spawnerMode = formData['modal-spawnerMode'] || '';
    const spawnerType = (formData['modal-spawnerType'] || '').trim();
    const spawnerItem = (formData['modal-spawnerItem'] || '').trim();
    const potionType = (formData['modal-potionType'] || '').trim();
    const potionLevel = parseInt(formData['modal-potionLevel'], 10) || 0;
    const headTexture = (formData['modal-headTexture'] || '').trim();
    const headOwner = (formData['modal-headOwner'] || '').trim();

    const lore = [];
    if (guiSettings?.itemLore?.showBuyPrice && buyPrice > 0) {
        lore.push((guiSettings.itemLore.buyPriceLine || '&6Buy Price: &a%price%').replace('%price%', `$${formatModalPreviewPrice(buyTotal)}`));
    }
    if (guiSettings?.itemLore?.showSellPrice && sellPrice > 0) {
        lore.push((guiSettings.itemLore.sellPriceLine || '&cSell Price: &a%sell-price%').replace('%sell-price%', `$${formatModalPreviewPrice(sellTotal)}`));
    }

    const enableLore = !!formData['modal-enableLore'];
    if (enableLore && formData['modal-lore']) {
        formData['modal-lore'].split('\n').forEach(line => lore.push(line));
    }

    const loreHtml = lore.length
        ? lore.map(line => `<div class="modal-preview-lore-line">${typeof parseMinecraftColors === 'function' ? parseMinecraftColors(line) : escapeHtml(line)}</div>`).join('')
        : '<div class="modal-preview-empty">No lore lines</div>';

    const chips = [];
    if (enchantmentLines.length > 0) chips.push(`<span class="modal-preview-chip">Enchants: ${enchantmentLines.length}</span>`);
    if (commandLines.length > 0) chips.push(`<span class="modal-preview-chip">Commands: ${commandLines.length}</span>`);
    if (commandLines.length > 0) chips.push(`<span class="modal-preview-chip">Run as: ${escapeHtml(runAs)}</span>`);
    if (commandLines.length > 0 && runCommandOnly) chips.push('<span class="modal-preview-chip">Run command only</span>');
    if (playerLimit > 0) chips.push(`<span class="modal-preview-chip">Player limit: ${playerLimit}</span>`);
    if (globalLimit > 0) chips.push(`<span class="modal-preview-chip">Global limit: ${globalLimit}</span>`);
    if (dynamicPricing) chips.push('<span class="modal-preview-chip">Dynamic pricing</span>');
    if (hideAttributes) chips.push('<span class="modal-preview-chip">Hide attributes</span>');
    if (hideAdditional) chips.push('<span class="modal-preview-chip">Hide additional</span>');
    if (requireName) chips.push('<span class="modal-preview-chip">Require name</span>');
    if (requireLore) chips.push('<span class="modal-preview-chip">Require lore</span>');
    if (unstableTnt) chips.push('<span class="modal-preview-chip">Unstable TNT</span>');
    if (sellAddsToStock) chips.push('<span class="modal-preview-chip">Sell adds stock</span>');
    if (allowSellOverflow) chips.push('<span class="modal-preview-chip">Allow sell overflow</span>');
    if (showStock) chips.push('<span class="modal-preview-chip">Show stock line</span>');
    if (showStockResetTimer) chips.push('<span class="modal-preview-chip">Show reset timer</span>');
    if (stockResetEnabled) chips.push(`<span class="modal-preview-chip">Reset: ${escapeHtml(stockResetType || 'daily')}</span>`);
    if (permission) chips.push('<span class="modal-preview-chip">Permission required</span>');
    if (campaignEnabled) chips.push('<span class="modal-preview-chip">Campaign enabled</span>');

    const details = [];
    if (dynamicPricing) {
        details.push(`Dynamic: min ${formatModalPreviewPrice(minPrice)}, max ${formatModalPreviewPrice(maxPrice)}, change ${formatModalPreviewPrice(priceChange)}`);
    }
    if (campaignEnabled) {
        const campaignLabel = campaignName || 'Unnamed campaign';
        details.push(`Campaign: ${escapeHtml(campaignLabel)}`);
        if (campaignStart || campaignEnd) {
            details.push(`Window: ${escapeHtml(campaignStart || '...')} -> ${escapeHtml(campaignEnd || '...')}`);
        }
        if (campaignTimezone) details.push(`Timezone: ${escapeHtml(campaignTimezone)}`);
        details.push(`Multipliers: buy x${formatModalPreviewPrice(campaignBuyMultiplier)}, sell x${formatModalPreviewPrice(campaignSellMultiplier)}`);
    }
    if (isSpawnerMaterial && spawnerMode === 'ENTITY' && spawnerType) details.push(`Spawner entity: ${escapeHtml(spawnerType)}`);
    if (isSpawnerMaterial && spawnerMode === 'ITEM' && spawnerItem) details.push(`Spawner item: ${escapeHtml(spawnerItem)}`);
    if (isPotionMaterial && potionType) details.push(`Potion: ${escapeHtml(potionType)} ${potionLevel > 0 ? `(${potionLevel})` : ''}`);
    if (isHeadMaterial && headOwner) details.push(`Head owner: ${escapeHtml(headOwner)}`);
    if (isHeadMaterial && headTexture) details.push('Head texture set');
    if (permission) details.push(`Permission: ${escapeHtml(permission)}`);

    const enchListHtml = enchantmentLines.length > 0
        ? `<div class="modal-preview-subsection"><div class="modal-preview-subtitle">Enchantments</div><div class="modal-preview-code">${escapeHtml(enchantmentLines.slice(0, 8).join('\n'))}${enchantmentLines.length > 8 ? '\n...' : ''}</div></div>`
        : '';
    const cmdListHtml = commandLines.length > 0
        ? `<div class="modal-preview-subsection"><div class="modal-preview-subtitle">Commands</div><div class="modal-preview-code">${escapeHtml(commandLines.slice(0, 6).join('\n'))}${commandLines.length > 6 ? '\n...' : ''}</div></div>`
        : '';
    const detailHtml = details.length > 0
        ? `<div class="modal-preview-subsection"><div class="modal-preview-subtitle">Details</div><div class="modal-preview-detail-list">${details.map(d => `<div class="modal-preview-detail-line">${d}</div>`).join('')}</div></div>`
        : '';

    return `
        <div class="modal-preview-item">
            <div class="modal-preview-top">
                <div class="modal-preview-icon">
                    <img src="${getModalPreviewItemIcon({ ...baseItem, material })}" onerror="this.src='${TEXTURE_API}stone.png'">
                </div>
                <div class="modal-preview-meta">
                    <div class="modal-preview-name">${typeof parseMinecraftColors === 'function' ? parseMinecraftColors(name) : escapeHtml(name)}</div>
                    <div class="modal-preview-sub">${escapeHtml(material)} • x${amount}</div>
                </div>
            </div>
            <div class="modal-preview-price-row">
                ${buyPrice > 0 ? `<span class="modal-preview-pill buy">Buy: $${formatModalPreviewPrice(buyTotal)}</span>` : ''}
                ${sellPrice > 0 ? `<span class="modal-preview-pill sell">Sell: $${formatModalPreviewPrice(sellTotal)}</span>` : ''}
            </div>
            ${chips.length > 0 ? `<div class="modal-preview-chip-row">${chips.join('')}</div>` : ''}
            ${detailHtml}
            ${enchListHtml}
            ${cmdListHtml}
            <div class="modal-preview-lore">${loreHtml}</div>
        </div>
    `;
}

function findNextFreeShopSlot(itemList) {
    const used = new Set((itemList || []).map(it => parseInt(it.slot, 10)).filter(Number.isInteger));
    let slot = 0;
    while (used.has(slot)) slot++;
    return slot;
}

function parseCloneTargetsInput(inputRaw, availableTargets) {
    const raw = (inputRaw || '').trim();
    if (!raw) return [];
    if (raw.toLowerCase() === 'all') {
        return [...availableTargets];
    }
    const set = new Set();
    raw.split(/[\n,]+/).forEach(token => {
        const v = token.trim();
        if (v) set.add(v);
    });
    return [...set];
}

function closeShopTargetPicker() {
    const existing = document.getElementById('shop-target-picker-overlay');
    if (existing) existing.remove();
}

function openShopTargetPicker(options) {
    const cfg = options || {};
    const targets = Array.isArray(cfg.targets) ? cfg.targets : [];
    const multi = !!cfg.multi;
    const title = cfg.title || (multi ? 'Select Target Shops' : 'Select Target Shop');
    const confirmLabel = cfg.confirmLabel || (multi ? 'Clone to Selected' : 'Clone');
    const onConfirm = typeof cfg.onConfirm === 'function' ? cfg.onConfirm : () => {};
    const initialSelection = Array.isArray(cfg.initialSelection) ? cfg.initialSelection : [];

    closeShopTargetPicker();

    const overlay = document.createElement('div');
    overlay.id = 'shop-target-picker-overlay';
    overlay.className = 'shop-target-picker-overlay';
    overlay.innerHTML = `
        <div class="shop-target-picker-panel">
            <div class="shop-target-picker-header">
                <h3 class="shop-target-picker-title">${escapeHtml(title)}</h3>
                <button type="button" class="shop-target-picker-close" id="shop-target-picker-close-btn">&times;</button>
            </div>
            <div class="shop-target-picker-search-wrap">
                <input type="text" id="shop-target-picker-search" class="input-base" placeholder="Search shops...">
            </div>
            <div id="shop-target-picker-list" class="shop-target-picker-list"></div>
            <div class="shop-target-picker-actions">
                <button type="button" class="btn-base btn-secondary" id="shop-target-picker-cancel">Cancel</button>
                <button type="button" class="btn-base btn-success" id="shop-target-picker-confirm">${escapeHtml(confirmLabel)}</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const searchEl = document.getElementById('shop-target-picker-search');
    const listEl = document.getElementById('shop-target-picker-list');
    const confirmBtn = document.getElementById('shop-target-picker-confirm');
    const cancelBtn = document.getElementById('shop-target-picker-cancel');
    const closeBtn = document.getElementById('shop-target-picker-close-btn');

    const selected = new Set(initialSelection.filter(v => targets.includes(v)));
    if (!multi && selected.size > 1) {
        const first = selected.values().next().value;
        selected.clear();
        if (first) selected.add(first);
    }

    const renderList = () => {
        if (!listEl) return;
        const query = String(searchEl?.value || '').trim().toLowerCase();
        const visible = targets.filter(t => t.toLowerCase().includes(query));

        if (visible.length === 0) {
            listEl.innerHTML = '<div class="shop-target-picker-empty">No shops found</div>';
            return;
        }

        listEl.innerHTML = '';
        visible.forEach(shop => {
            const row = document.createElement('div');
            row.className = 'shop-target-picker-row';
            row.dataset.shop = shop;
            row.tabIndex = 0;
            row.setAttribute('role', 'button');

            if (multi) {
                const checked = selected.has(shop) ? 'checked' : '';
                row.innerHTML = `
                    <div class="shop-target-picker-row-label">
                        <input type="checkbox" ${checked} tabindex="-1" disabled>
                        <span>${escapeHtml(shop)}</span>
                    </div>
                `;
                row.addEventListener('click', () => {
                    if (selected.has(shop)) selected.delete(shop);
                    else selected.add(shop);
                    renderList();
                });
            } else {
                if (selected.has(shop)) row.classList.add('selected');
                row.innerHTML = `<span>${escapeHtml(shop)}</span>${selected.has(shop) ? '<span class="shop-target-picker-check">&#10003;</span>' : ''}`;
                row.addEventListener('click', () => {
                    selected.clear();
                    selected.add(shop);
                    renderList();
                });
            }
            row.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    row.click();
                }
            });
            listEl.appendChild(row);
        });
    };

    const submit = () => {
        const values = [...selected];
        if (values.length === 0) {
            showAlert('Select at least one target shop.', 'warning');
            return;
        }
        closeShopTargetPicker();
        onConfirm(values);
    };

    searchEl?.addEventListener('input', renderList);
    confirmBtn?.addEventListener('click', submit);
    cancelBtn?.addEventListener('click', closeShopTargetPicker);
    closeBtn?.addEventListener('click', closeShopTargetPicker);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeShopTargetPicker();
    });

    const onKeyDown = (e) => {
        if (!document.getElementById('shop-target-picker-overlay')) {
            document.removeEventListener('keydown', onKeyDown);
            return;
        }
        if (e.key === 'Escape') closeShopTargetPicker();
        if (e.key === 'Enter') submit();
    };
    document.addEventListener('keydown', onKeyDown);

    renderList();
    setTimeout(() => searchEl?.focus(), 0);
}

function cloneShopItemToTargets(item, targets) {
    const originalShopFile = currentShopFile;
    const originalItems = JSON.parse(JSON.stringify(items || []));
    const originalSettings = JSON.parse(JSON.stringify(currentShopSettings || {}));
    const originalItemIdCounter = itemIdCounter;
    const exportOutput = document.getElementById('export-output');
    const originalExport = exportOutput ? exportOutput.textContent : '';
    const successTargets = [];
    const failedTargets = [];

    try {
        targets.forEach(targetFile => {
            if (!allShops[targetFile]) {
                failedTargets.push(`${targetFile} (not found)`);
                return;
            }
            if (targetFile === originalShopFile) {
                failedTargets.push(`${targetFile} (same shop)`);
                return;
            }

            parseShopYaml(allShops[targetFile]);

            const cloned = JSON.parse(JSON.stringify(item));
            cloned.id = itemIdCounter++;
            cloned.slot = findNextFreeShopSlot(items);
            items.push(cloned);

            const newYaml = getCurrentShopYamlContent();
            allShops[targetFile] = newYaml;

            addActivityEntry('created', 'shop-item', null, JSON.parse(JSON.stringify(cloned)), {
                shopFile: targetFile,
                sourceShopFile: originalShopFile,
                cloned: true,
                bulkClone: targets.length > 1
            });
            successTargets.push(targetFile);
        });
    } catch (error) {
        console.error('Failed to clone item:', error);
        showAlert(`Failed to clone item: ${error.message || error}`, 'error');
    } finally {
        currentShopFile = originalShopFile;
        items = originalItems;
        currentShopSettings = originalSettings;
        if (exportOutput) exportOutput.textContent = originalExport;
        itemIdCounter = Math.max(itemIdCounter, originalItemIdCounter);
        renderItems();
        updateAll();
    }

    return { successTargets, failedTargets };
}

function cloneShopItemToAnotherShop(item) {
    const shopFiles = Object.keys(allShops || {});
    const targetOptions = shopFiles.filter(f => f !== currentShopFile);
    if (targetOptions.length === 0) {
        showAlert('No other shop file is available to clone into.', 'warning');
        return;
    }

    openShopTargetPicker({
        targets: targetOptions,
        multi: false,
        title: 'Clone Item to Shop',
        confirmLabel: 'Clone',
        onConfirm: (selectedTargets) => {
            const targetFile = selectedTargets[0];
            const result = cloneShopItemToTargets(item, [targetFile]);
            if (result.successTargets.length > 0) {
                showToast(`Item cloned to ${result.successTargets[0]}`, 'success');
            } else if (result.failedTargets.length > 0) {
                showAlert(`Clone failed: ${result.failedTargets.join(', ')}`, 'error');
            }
        }
    });
}

function cloneShopItemToMultipleShops(item) {
    const shopFiles = Object.keys(allShops || {});
    const targetOptions = shopFiles.filter(f => f !== currentShopFile);
    if (targetOptions.length === 0) {
        showAlert('No other shop file is available to clone into.', 'warning');
        return;
    }

    openShopTargetPicker({
        targets: targetOptions,
        multi: true,
        title: 'Clone Item to Multiple Shops',
        confirmLabel: 'Clone to Selected',
        initialSelection: targetOptions.slice(0, Math.min(2, targetOptions.length)),
        onConfirm: (selectedTargets) => {
            const result = cloneShopItemToTargets(item, selectedTargets);
            if (result.successTargets.length > 0) {
                showToast(`Cloned item to ${result.successTargets.length} shop(s)`, 'success');
            }
            if (result.failedTargets.length > 0) {
                showAlert(`Some targets were skipped:\n${result.failedTargets.join('\n')}`, 'warning');
            }
        }
    });
}

function parseCsvLine(line) {
    const out = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (ch === ',' && !inQuotes) {
            out.push(current.trim());
            current = '';
            continue;
        }
        current += ch;
    }
    out.push(current.trim());
    return out;
}

function parseBooleanLike(value, def = false) {
    if (value === undefined || value === null || value === '') return def;
    const s = String(value).trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'y';
}

function parseNumberLike(value, def = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : def;
}

function readTextFromFileInput(inputId) {
    return new Promise((resolve, reject) => {
        const input = document.getElementById(inputId);
        const file = input && input.files && input.files[0] ? input.files[0] : null;
        if (!file) {
            reject(new Error('No file selected.'));
            return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve({
            name: file.name || '',
            text: String(reader.result || '')
        });
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsText(file);
    });
}

function detectImportFormat(fileName, text, fallback = 'yaml') {
    const name = String(fileName || '').toLowerCase();
    if (name.endsWith('.json')) return 'json';
    if (name.endsWith('.yml') || name.endsWith('.yaml')) return 'yaml';

    const body = String(text || '').trim();
    if (!body) return fallback;
    if (body.startsWith('{') || body.startsWith('[')) return 'json';
    return 'yaml';
}

function ensureImportedItemDefaults(raw) {
    const item = raw || {};
    const amount = Math.max(1, parseInt(item.amount, 10) || 1);
    const loreRaw = item.lore;
    const commandsRaw = item.commands;
    const lore = Array.isArray(loreRaw)
        ? loreRaw
        : (typeof loreRaw === 'string' && loreRaw.trim() ? loreRaw.split('|').map(s => s.trim()) : []);
    const commands = Array.isArray(commandsRaw)
        ? commandsRaw
        : (typeof commandsRaw === 'string' && commandsRaw.trim() ? commandsRaw.split('|').map(s => s.trim()) : []);

    const normalized = {
        id: null,
        material: String(item.material || 'STONE').toUpperCase(),
        name: String(item.name || '&eImported Item'),
        itemKey: String(item.itemKey || ''),
        variantKey: String(item.variantKey || ''),
        headTexture: item.headTexture || '',
        headOwner: item.headOwner || '',
        itemStack: item.itemStack || item.item_stack || '',
        price: parseNumberLike(item.price, 0),
        sellPrice: parseNumberLike(item.sellPrice, 0),
        buyPricePerItem: item.buyPricePerItem !== false,
        sellPricePerItem: item.sellPricePerItem !== false,
        campaignEnabled: !!item.campaignEnabled,
        campaign: String(item.campaign || ''),
        campaignName: String(item.campaignName || ''),
        campaignStart: String(item.campaignStart || ''),
        campaignEnd: String(item.campaignEnd || ''),
        campaignTimezone: String(item.campaignTimezone || ''),
        campaignBuyMultiplier: parseNumberLike(item.campaignBuyMultiplier, 1) || 1,
        campaignSellMultiplier: parseNumberLike(item.campaignSellMultiplier, 1) || 1,
        amount: amount,
        lore: lore,
        enchantments: (item.enchantments && typeof item.enchantments === 'object') ? item.enchantments : {},
        hideAttributes: !!item.hideAttributes,
        hideAdditional: !!item.hideAdditional,
        requireName: !!item.requireName,
        requireLore: !!item.requireLore,
        unstableTnt: !!item.unstableTnt,
        spawnerType: item.spawnerType || null,
        spawnerItem: item.spawnerItem || null,
        potionType: item.potionType || null,
        potionLevel: parseInt(item.potionLevel, 10) || 0,
        commands: commands,
        runAs: (String(item.runAs || 'console').toLowerCase() === 'player') ? 'player' : 'console',
        limit: parseInt(item.limit, 10) || 0,
        globalLimit: parseInt(item.globalLimit, 10) || 0,
        dynamicPricing: !!item.dynamicPricing,
        minPrice: parseNumberLike(item.minPrice, 0),
        maxPrice: parseNumberLike(item.maxPrice, 0),
        priceChange: parseNumberLike(item.priceChange, 0),
        stockResetRule: sanitizeStockResetRule(item.stockResetRule || {}),
        showStock: !!item.showStock,
        showStockResetTimer: !!item.showStockResetTimer,
        runCommandOnly: item.runCommandOnly !== false,
        permission: item.permission || '',
        sellAddsToStock: (item.sellAddsToStock === null || item.sellAddsToStock === undefined) ? null : !!item.sellAddsToStock,
        allowSellStockOverflow: (item.allowSellStockOverflow === null || item.allowSellStockOverflow === undefined) ? null : !!item.allowSellStockOverflow,
        slot: Number.isInteger(parseInt(item.slot, 10)) ? parseInt(item.slot, 10) : null
    };

    return normalized;
}

function parseImportJsonItems(payload) {
    const parsed = JSON.parse(payload);
    const list = Array.isArray(parsed)
        ? parsed
        : (Array.isArray(parsed.items) ? parsed.items : (parsed.item ? [parsed.item] : []));
    return list.map(ensureImportedItemDefaults);
}

function parseImportYamlItems(payload) {
    const backupItems = JSON.parse(JSON.stringify(items || []));
    const backupSettings = JSON.parse(JSON.stringify(currentShopSettings || {}));
    const backupCounter = itemIdCounter;
    let parsedItems = [];

    try {
        parseShopYaml(payload);
        parsedItems = JSON.parse(JSON.stringify(items || []));
    } finally {
        items = backupItems;
        Object.assign(currentShopSettings, backupSettings);
        itemIdCounter = backupCounter;
    }

    return parsedItems.map(ensureImportedItemDefaults);
}

function applyImportedItems(importedItems, keepProvidedSlot) {
    if (!Array.isArray(importedItems) || importedItems.length === 0) return 0;

    const existingSlots = new Set(items.map(it => parseInt(it.slot, 10)).filter(Number.isInteger));
    let added = 0;

    importedItems.forEach(imported => {
        const newItem = JSON.parse(JSON.stringify(imported));
        newItem.id = itemIdCounter++;
        if (keepProvidedSlot && Number.isInteger(newItem.slot) && !existingSlots.has(newItem.slot)) {
            // keep slot
        } else {
            newItem.slot = findNextFreeShopSlot(items);
        }
        existingSlots.add(newItem.slot);
        items.push(newItem);
        added++;

        addActivityEntry('created', 'shop-item', null, JSON.parse(JSON.stringify(newItem)), {
            shopFile: currentShopFile,
            imported: true
        });
    });

    return added;
}

function openImportItemsModal() {
    openEditModal({
        title: 'Import Items (JSON / YAML)',
        fields: [
            {
                id: 'modal-import-format',
                label: 'Format',
                type: 'select',
                value: 'yaml',
                options: [
                    { value: 'json', label: 'JSON' },
                    { value: 'yaml', label: 'YAML' }
                ]
            },
            {
                id: 'modal-import-keep-slot',
                label: 'Keep provided slot if free',
                type: 'checkbox',
                value: false
            },
            {
                id: 'modal-import-file',
                label: 'Import File',
                type: 'file',
                accept: '.json,.yml,.yaml',
                hint: 'Upload a JSON item list or a YAML shop file (items section will be imported). Format is auto-detected from file.'
            }
        ],
        onSave: async (data) => {
            const selectedFormat = (data['modal-import-format'] || 'yaml').toLowerCase();
            const keepSlot = !!data['modal-import-keep-slot'];

            try {
                const fileData = await readTextFromFileInput('modal-import-file');
                const payload = fileData.text || '';
                if (!payload.trim()) {
                    showAlert('Import file is empty.', 'warning');
                    return;
                }
                const format = detectImportFormat(fileData.name, payload, selectedFormat);
                const imported = format === 'yaml'
                    ? parseImportYamlItems(payload)
                    : parseImportJsonItems(payload);
                const count = applyImportedItems(imported, keepSlot);
                if (count <= 0) {
                    showAlert('No items were imported.', 'warning');
                    return;
                }
                renderItems();
                updateAll();
                showToast(`Imported ${count} item(s)`, 'success');
            } catch (error) {
                console.error('Import failed:', error);
                showAlert(`Import failed: ${error.message || error}`, 'error');
            }
        }
    });
}

function buildMenuExportPayload(menuType) {
    const now = new Date().toISOString();
    if (menuType === 'mainmenu') {
        return {
            exportedAt: now,
            type: 'mainmenu',
            mainMenuSettings: JSON.parse(JSON.stringify(mainMenuSettings || {})),
            loadedGuiShops: JSON.parse(JSON.stringify(loadedGuiShops || []))
        };
    }
    if (menuType === 'purchase' || menuType === 'sell') {
        return {
            exportedAt: now,
            type: menuType,
            settings: JSON.parse(JSON.stringify((transactionSettings && transactionSettings[menuType]) || {}))
        };
    }
    throw new Error(`Unsupported menu type: ${menuType}`);
}

function yamlQuote(value) {
    return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

function buildMainMenuYamlExport() {
    let yaml = `title: ${yamlQuote(mainMenuSettings.title || '&8Shop Menu')}\n`;
    yaml += `rows: ${parseInt(mainMenuSettings.rows, 10) || 3}\n`;
    yaml += `items:\n`;

    (loadedGuiShops || []).forEach(shop => {
        const key = (shop.key || `shop_${shop.slot ?? 0}`).toString();
        yaml += `  ${key}:\n`;
        yaml += `    slot: ${parseInt(shop.slot, 10) || 0}\n`;
        yaml += `    material: ${(shop.material || 'CHEST').toString()}\n`;
        yaml += `    name: ${yamlQuote(shop.name || '&eShop')}\n`;
        yaml += `    action: ${(shop.action || 'shop-key').toString()}\n`;

        if (shop.shopKey) yaml += `    shop-key: ${yamlQuote(shop.shopKey)}\n`;
        if (shop.permission) yaml += `    permission: ${yamlQuote(shop.permission)}\n`;
        if (shop.hideAttributes) yaml += `    hide-attributes: true\n`;
        if (shop.hideAdditional) yaml += `    hide-additional: true\n`;
        if (shop.closeAfterAction) yaml += `    close-after-action: true\n`;
        if (shop.runAs && shop.runAs !== 'player') yaml += `    run-as: ${shop.runAs}\n`;

        if (Array.isArray(shop.lore) && shop.lore.length > 0) {
            yaml += `    lore:\n`;
            shop.lore.forEach(line => {
                yaml += `      - ${yamlQuote(line)}\n`;
            });
        }
        if (Array.isArray(shop.commands) && shop.commands.length > 0) {
            yaml += `    commands:\n`;
            shop.commands.forEach(cmd => {
                yaml += `      - ${yamlQuote(cmd)}\n`;
            });
        }
    });

    return yaml;
}

function buildTransactionMenuYamlExport(type) {
    const settings = transactionSettings && transactionSettings[type] ? transactionSettings[type] : {};
    let yaml = `title-prefix: ${yamlQuote(settings.titlePrefix || (type === 'purchase' ? '&8Buying ' : '&8Selling '))}\n`;
    yaml += `display-material: ${(settings.displayMaterial || 'BOOK').toString()}\n`;
    yaml += `display-slot: ${parseInt(settings.displaySlot, 10) || 22}\n`;
    yaml += `max-amount: ${parseInt(settings.maxAmount, 10) || 2304}\n`;

    yaml += `lore:\n`;
    yaml += `  amount: ${yamlQuote((settings.lore && settings.lore.amount) || '&eAmount: &7')}\n`;
    yaml += `  total: ${yamlQuote((settings.lore && settings.lore.total) || '&eTotal: &7')}\n`;
    if (type === 'purchase') {
        yaml += `  spawner: ${yamlQuote((settings.lore && settings.lore.spawner) || '&7Spawner: &e')}\n`;
    }

    yaml += `buttons:\n`;
    const mainButtons = settings.buttons || {};
    Object.entries(mainButtons).forEach(([key, btn]) => {
        const button = btn || {};
        yaml += `  ${key}:\n`;
        yaml += `    material: ${(button.material || 'STONE').toString()}\n`;
        yaml += `    name: ${yamlQuote(button.name || '&fButton')}\n`;
        yaml += `    slot: ${parseInt(button.slot, 10) || 0}\n`;
    });

    ['add', 'remove', 'set'].forEach(group => {
        const groupData = settings[group] || {};
        yaml += `  ${group}:\n`;
        yaml += `    material: ${(groupData.material || 'STONE').toString()}\n`;
        const buttons = groupData.buttons || {};
        Object.entries(buttons).forEach(([amount, btn]) => {
            const b = btn || {};
            yaml += `    '${amount}':\n`;
            yaml += `      name: ${yamlQuote(b.name || '&fButton')}\n`;
            yaml += `      slot: ${parseInt(b.slot, 10) || 0}\n`;
        });
    });

    return yaml;
}

function applyImportedMenuPayload(menuType, parsed) {
    if (menuType === 'mainmenu') {
        const importedSettings = parsed.mainMenuSettings || parsed.settings || parsed.mainmenuSettings;
        const importedShops = parsed.loadedGuiShops || parsed.shops || parsed.buttons;
        if (!importedSettings || !Array.isArray(importedShops)) {
            throw new Error('Invalid main menu payload. Required: mainMenuSettings + loadedGuiShops');
        }
        const beforeSettings = JSON.parse(JSON.stringify(mainMenuSettings || {}));
        const beforeShops = JSON.parse(JSON.stringify(loadedGuiShops || []));

        mainMenuSettings = JSON.parse(JSON.stringify(importedSettings));
        loadedGuiShops = JSON.parse(JSON.stringify(importedShops));

        addActivityEntry('updated', 'main-menu-settings', beforeSettings, JSON.parse(JSON.stringify(mainMenuSettings)), { imported: true });
        addActivityEntry('updated', 'main-menu-button', beforeShops, JSON.parse(JSON.stringify(loadedGuiShops)), { imported: true, bulk: true });

        renderMainMenuShops();
        if (currentTab === 'mainmenu') updateGuiPreview();
        scheduleAutoSave();
        return;
    }

    if (menuType === 'purchase' || menuType === 'sell') {
        const importedSettings = parsed.settings || parsed[menuType] || (parsed.transactionSettings && parsed.transactionSettings[menuType]);
        if (!importedSettings || typeof importedSettings !== 'object') {
            throw new Error(`Invalid ${menuType} payload. Required: settings object`);
        }
        const before = JSON.parse(JSON.stringify(transactionSettings[menuType] || {}));
        transactionSettings[menuType] = JSON.parse(JSON.stringify(importedSettings));

        addActivityEntry('updated', `${menuType}-menu-settings`, before, JSON.parse(JSON.stringify(transactionSettings[menuType])), { imported: true, bulk: true });

        if (menuType === 'purchase') {
            renderPurchaseButtons();
            if (currentTab === 'purchase') updatePurchasePreview();
        } else {
            renderSellButtons();
            if (currentTab === 'sell') updateSellPreview();
        }
        scheduleAutoSave();
        return;
    }

    throw new Error(`Unsupported menu type: ${menuType}`);
}

function openImportMenuModal(menuType) {
    const normalized = String(menuType || '').toLowerCase();
    const titleMap = {
        mainmenu: 'Import Main Menu',
        purchase: 'Import Purchase Menu',
        sell: 'Import Sell Menu'
    };
    if (!titleMap[normalized]) {
        showAlert('Unsupported menu import target.', 'error');
        return;
    }

    openEditModal({
        title: `${titleMap[normalized]} Import`,
        fields: [
            {
                id: 'modal-menu-import-format',
                label: 'Format',
                type: 'select',
                value: 'yaml',
                options: [
                    { value: 'json', label: 'JSON' },
                    { value: 'yaml', label: 'YAML' }
                ]
            },
            {
                id: 'modal-menu-import-file',
                label: 'Import File',
                type: 'file',
                accept: '.json,.yml,.yaml',
                hint: 'Upload a menu config file in JSON or YAML. Format is auto-detected from file.'
            }
        ],
        onSave: async (data) => {
            const selectedFormat = (data['modal-menu-import-format'] || 'yaml').toLowerCase();
            try {
                const fileData = await readTextFromFileInput('modal-menu-import-file');
                const payload = String(fileData.text || '').trim();
                if (!payload) {
                    showAlert('Import file is empty.', 'warning');
                    return;
                }
                const format = detectImportFormat(fileData.name, payload, selectedFormat);

                if (format === 'yaml') {
                    if (normalized === 'mainmenu') {
                        const beforeSettings = JSON.parse(JSON.stringify(mainMenuSettings || {}));
                        const beforeShops = JSON.parse(JSON.stringify(loadedGuiShops || []));
                        parseMainMenuYaml(payload);
                        addActivityEntry('updated', 'main-menu-settings', beforeSettings, JSON.parse(JSON.stringify(mainMenuSettings || {})), { imported: true });
                        addActivityEntry('updated', 'main-menu-button', beforeShops, JSON.parse(JSON.stringify(loadedGuiShops || [])), { imported: true, bulk: true });
                        renderMainMenuShops();
                        if (currentTab === 'mainmenu') updateGuiPreview();
                    } else if (normalized === 'purchase') {
                        const before = JSON.parse(JSON.stringify(transactionSettings.purchase || {}));
                        parsePurchaseMenuYaml(payload);
                        addActivityEntry('updated', 'purchase-menu-settings', before, JSON.parse(JSON.stringify(transactionSettings.purchase || {})), { imported: true, bulk: true });
                        renderPurchaseButtons();
                        if (currentTab === 'purchase') updatePurchasePreview();
                    } else if (normalized === 'sell') {
                        const before = JSON.parse(JSON.stringify(transactionSettings.sell || {}));
                        parseSellMenuYaml(payload);
                        addActivityEntry('updated', 'sell-menu-settings', before, JSON.parse(JSON.stringify(transactionSettings.sell || {})), { imported: true, bulk: true });
                        renderSellButtons();
                        if (currentTab === 'sell') updateSellPreview();
                    } else {
                        throw new Error('Unsupported menu import target.');
                    }
                } else {
                    const parsed = JSON.parse(payload);
                    applyImportedMenuPayload(normalized, parsed);
                }

                scheduleAutoSave();
                showToast(`${titleMap[normalized]} imported`, 'success');
            } catch (error) {
                console.error('Menu import failed:', error);
                showAlert(`Import failed: ${error.message || error}`, 'error');
            }
        }
    });
}

function openExportMenuModal(menuType) {
    const normalized = String(menuType || '').toLowerCase();
    const titleMap = {
        mainmenu: 'Main Menu',
        purchase: 'Purchase Menu',
        sell: 'Sell Menu'
    };
    if (!titleMap[normalized]) {
        showAlert('Unsupported menu export target.', 'error');
        return;
    }

    openEditModal({
        title: `${titleMap[normalized]} Export`,
        fields: [
            {
                id: 'modal-menu-export-format',
                label: 'Format',
                type: 'select',
                value: 'yaml',
                options: [
                    { value: 'yaml', label: 'YAML' },
                    { value: 'json', label: 'JSON' }
                ]
            }
        ],
        onSave: (data) => {
            const format = (data['modal-menu-export-format'] || 'yaml').toLowerCase();
            const date = new Date().toISOString().slice(0, 10);
            try {
                if (format === 'json') {
                    const payload = buildMenuExportPayload(normalized);
                    triggerDownload(`geniusshop-${normalized}-${date}.json`, JSON.stringify(payload, null, 2), 'application/json');
                } else {
                    const yamlContent = normalized === 'mainmenu'
                        ? buildMainMenuYamlExport()
                        : buildTransactionMenuYamlExport(normalized);
                    triggerDownload(`geniusshop-${normalized}-${date}.yml`, yamlContent, 'text/yaml');
                }
                showToast(`${titleMap[normalized]} exported`, 'success');
            } catch (error) {
                console.error('Menu export failed:', error);
                showAlert(`Export failed: ${error.message || error}`, 'error');
            }
        }
    });
}

function sanitizeFilename(value, fallback = 'export') {
    const raw = String(value || '').trim();
    const clean = raw.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\s+/g, '_');
    return clean || fallback;
}

function triggerDownload(filename, content, mimeType = 'application/octet-stream') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function getCurrentShopYamlContent() {
    if (typeof updateExport === 'function') {
        updateExport();
    } else if (typeof generateShopYaml === 'function') {
        generateShopYaml();
    }
    const exportOutput = document.getElementById('export-output');
    return exportOutput ? exportOutput.textContent : '';
}

function buildCurrentShopExportJson() {
    return {
        file: currentShopFile,
        settings: JSON.parse(JSON.stringify(currentShopSettings || {})),
        items: JSON.parse(JSON.stringify(items || []))
    };
}

function buildProjectExportJson() {
    const shops = JSON.parse(JSON.stringify(allShops || {}));
    // Ensure current in-memory shop edits are reflected in export payload.
    if (currentShopFile) {
        shops[currentShopFile] = getCurrentShopYamlContent();
    }
    return {
        exportedAt: new Date().toISOString(),
        project: 'GeniusShop Web Editor',
        shops: shops,
        state: {
            currentShopFile,
            currentShopSettings: JSON.parse(JSON.stringify(currentShopSettings || {})),
            items: JSON.parse(JSON.stringify(items || [])),
            mainMenuSettings: JSON.parse(JSON.stringify(mainMenuSettings || {})),
            loadedGuiShops: JSON.parse(JSON.stringify(loadedGuiShops || [])),
            transactionSettings: JSON.parse(JSON.stringify(transactionSettings || {})),
            guiSettings: JSON.parse(JSON.stringify(guiSettings || {})),
            priceFormatSettings: JSON.parse(JSON.stringify(priceFormatSettings || {}))
        }
    };
}

function exportShopItemData(item) {
    const payload = {
        exportedAt: new Date().toISOString(),
        sourceShop: currentShopFile,
        item: JSON.parse(JSON.stringify(item || {}))
    };
    const itemName = sanitizeFilename((item && item.material) ? item.material : 'item', 'item');
    triggerDownload(`geniusshop-item-${itemName}.json`, JSON.stringify(payload, null, 2), 'application/json');
    showToast('Item exported', 'success');
}

function openExportModal() {
    openEditModal({
        title: 'Export Data',
        fields: [
            {
                id: 'modal-export-target',
                label: 'Export Scope',
                type: 'select',
                value: 'shop',
                options: [
                    { value: 'shop', label: 'Current Shop' },
                    { value: 'project', label: 'Current Project' }
                ],
                onchange: (e) => {
                    const formatGroup = document.getElementById('group-modal-export-format');
                    const formatEl = document.getElementById('modal-export-format');
                    if (!formatGroup || !formatEl) return;
                    if (e.target.value === 'project') {
                        formatGroup.style.display = 'none';
                        formatEl.value = 'json';
                    } else {
                        formatGroup.style.display = 'block';
                    }
                }
            },
            {
                id: 'modal-export-format',
                label: 'Format',
                type: 'select',
                value: 'yaml',
                options: [
                    { value: 'yaml', label: 'YAML' },
                    { value: 'json', label: 'JSON' }
                ]
            }
        ],
        onSave: (data) => {
            const target = (data['modal-export-target'] || 'shop').toLowerCase();
            const format = (data['modal-export-format'] || 'yaml').toLowerCase();

            try {
                if (target === 'project') {
                    const payload = buildProjectExportJson();
                    const filename = `geniusshop-project-${new Date().toISOString().slice(0, 10)}.json`;
                    triggerDownload(filename, JSON.stringify(payload, null, 2), 'application/json');
                    showToast('Project exported', 'success');
                    return;
                }

                const shopBase = sanitizeFilename(currentShopFile ? currentShopFile.replace(/\.yml$/i, '') : 'shop', 'shop');
                if (format === 'json') {
                    const payload = buildCurrentShopExportJson();
                    triggerDownload(`geniusshop-shop-${shopBase}.json`, JSON.stringify(payload, null, 2), 'application/json');
                    showToast('Shop exported (JSON)', 'success');
                } else {
                    const yamlContent = getCurrentShopYamlContent();
                    triggerDownload(`geniusshop-shop-${shopBase}.yml`, yamlContent, 'text/yaml');
                    showToast('Shop exported (YAML)', 'success');
                }
            } catch (error) {
                console.error('Export failed:', error);
                showAlert(`Export failed: ${error.message || error}`, 'error');
            }
        }
    });
}

function openShopItemModal(itemId) {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const hasLore = Array.isArray(item.lore) && item.lore.some(line => (line || '').trim() !== '');
    const hasEnchantments = !!(item.enchantments && Object.keys(item.enchantments).length > 0);
    const hasCommands = !!(item.commands && item.commands.length > 0);
    const hasLimits = (item.limit || 0) > 0 || (item.globalLimit || 0) > 0;
    const campaignOptions = [{ value: '', label: 'None' }]
        .concat((globalCampaigns || [])
            .filter(c => c && c.key)
            .map(c => ({ value: c.key, label: c.name ? `${c.key} - ${c.name}` : c.key })));
    const hasAdvancedConditions = (item.minPlayerLevel || 0) > 0
        || (item.maxPlayerLevel || 0) > 0
        || !!String(item.requiredGamemode || '').trim()
        || (Array.isArray(item.allowedWorlds) && item.allowedWorlds.length > 0)
        || (Array.isArray(item.deniedWorlds) && item.deniedWorlds.length > 0);
    const hasCampaign = !!item.campaignEnabled
        || !!String(item.campaignName || '').trim()
        || !!String(item.campaignStart || '').trim()
        || !!String(item.campaignEnd || '').trim()
        || !!String(item.campaignTimezone || '').trim()
        || (parseFloat(item.campaignBuyMultiplier) || 1) !== 1
        || (parseFloat(item.campaignSellMultiplier) || 1) !== 1;

    const fields = [
        { id: 'modal-name', label: t('web-editor.modals.fields.display-name'), value: item.name, hint: t('web-editor.modals.fields.display-name-hint') },
        { id: 'modal-slot', label: t('web-editor.modals.fields.slot'), type: 'number', value: item.slot, min: 0, hint: t('web-editor.modals.fields.slot-hint'), row: true },
        { id: 'modal-amount', label: t('web-editor.modals.fields.amount'), type: 'number', value: item.amount, min: 1, max: 64, row: true },
        { id: 'modal-price', label: t('web-editor.modals.fields.buy-price'), type: 'number', value: item.price, hint: t('web-editor.modals.fields.buy-price-hint'), row: true },
        {
            id: 'modal-buyPricePerItem',
            label: t('web-editor.modals.fields.buy-price-mode', 'Buy Price Mode'),
            type: 'select',
            value: item.buyPricePerItem === false ? 'per-bundle' : 'per-item',
            options: [
                { value: 'per-item', label: t('web-editor.modals.fields.price-mode-per-item', 'Per item') },
                { value: 'per-bundle', label: t('web-editor.modals.fields.price-mode-per-bundle', 'Per configured amount') }
            ],
            row: true
        },
        { id: 'modal-sellPrice', label: t('web-editor.modals.fields.sell-price'), type: 'number', value: item.sellPrice || 0, hint: t('web-editor.modals.fields.sell-price-hint'), row: true },
        {
            id: 'modal-sellPricePerItem',
            label: t('web-editor.modals.fields.sell-price-mode', 'Sell Price Mode'),
            type: 'select',
            value: item.sellPricePerItem === false ? 'per-bundle' : 'per-item',
            options: [
                { value: 'per-item', label: t('web-editor.modals.fields.price-mode-per-item', 'Per item') },
                { value: 'per-bundle', label: t('web-editor.modals.fields.price-mode-per-bundle', 'Per configured amount') }
            ],
            row: true
        },
        {
            id: 'modal-campaignEnabled',
            label: t('web-editor.modals.fields.campaign-enabled', 'Enable Campaign'),
            type: 'checkbox',
            value: hasCampaign,
            checkboxGroup: 'Trading Rules',
            onchange: (e) => {
                const enabled = e.target.checked;
                ['campaignName', 'campaignStart', 'campaignEnd', 'campaignTimezone', 'campaignBuyMultiplier', 'campaignSellMultiplier'].forEach(key => {
                    const group = document.getElementById(`group-modal-${key}`);
                    if (group) group.style.display = enabled ? 'block' : 'none';
                });
            }
        },
        {
            id: 'modal-campaignKey',
            label: t('web-editor.modals.fields.campaign-key', 'Assigned Campaign'),
            type: 'select',
            value: item.campaign || '',
            options: campaignOptions,
            hint: t('web-editor.modals.fields.campaign-key-hint', 'Use a campaign from the Campaigns tab. Item inline campaign settings override this.')
        },
        { id: 'modal-campaignName', label: t('web-editor.modals.fields.campaign-name', 'Campaign Name'), value: item.campaignName || '', hidden: !hasCampaign },
        { id: 'modal-campaignStart', label: t('web-editor.modals.fields.campaign-start', 'Campaign Start'), value: item.campaignStart || '', hint: t('web-editor.modals.fields.campaign-start-hint', 'Use YYYY-MM-DD HH:mm (or ISO).'), hidden: !hasCampaign },
        { id: 'modal-campaignEnd', label: t('web-editor.modals.fields.campaign-end', 'Campaign End'), value: item.campaignEnd || '', hint: t('web-editor.modals.fields.campaign-end-hint', 'Use YYYY-MM-DD HH:mm (or ISO).'), hidden: !hasCampaign },
        { id: 'modal-campaignTimezone', label: t('web-editor.modals.fields.campaign-timezone', 'Campaign Timezone'), value: item.campaignTimezone || '', hint: t('web-editor.modals.fields.campaign-timezone-hint', 'Optional: e.g. UTC or Europe/Copenhagen'), hidden: !hasCampaign },
        { id: 'modal-campaignBuyMultiplier', label: t('web-editor.modals.fields.campaign-buy-multiplier', 'Campaign Buy Multiplier'), type: 'number', step: '0.01', min: 0.01, value: (parseFloat(item.campaignBuyMultiplier) || 1), hidden: !hasCampaign, row: true },
        { id: 'modal-campaignSellMultiplier', label: t('web-editor.modals.fields.campaign-sell-multiplier', 'Campaign Sell Multiplier'), type: 'number', step: '0.01', min: 0.01, value: (parseFloat(item.campaignSellMultiplier) || 1), hidden: !hasCampaign, row: true },
        {
            id: 'modal-enableLore',
            label: 'Enable Lore',
            type: 'checkbox',
            value: hasLore,
            checkboxGroup: 'Content',
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
            checkboxGroup: 'Content',
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

    fields.push({ id: 'modal-hideAttributes', label: t('web-editor.modals.fields.hide-attributes'), type: 'checkbox', value: item.hideAttributes, checkboxGroup: 'Display Flags' });
    fields.push({ id: 'modal-hideAdditional', label: t('web-editor.modals.fields.hide-additional'), type: 'checkbox', value: item.hideAdditional, checkboxGroup: 'Display Flags' });
    fields.push({ id: 'modal-requireName', label: t('web-editor.modals.fields.require-name'), type: 'checkbox', value: item.requireName, hint: t('web-editor.modals.fields.require-name-hint'), checkboxGroup: 'Requirements' });
    fields.push({ id: 'modal-requireLore', label: t('web-editor.modals.fields.require-lore'), type: 'checkbox', value: item.requireLore, hint: t('web-editor.modals.fields.require-lore-hint'), checkboxGroup: 'Requirements' });
    fields.push({ id: 'modal-unstableTnt', label: t('web-editor.modals.fields.unstable-tnt'), type: 'checkbox', value: item.unstableTnt, hidden: !item.material.toUpperCase().includes('TNT'), checkboxGroup: 'Display Flags' });

    fields.push({
        id: 'modal-enableLimits',
        label: 'Enable Limits',
        type: 'checkbox',
        value: hasLimits,
        checkboxGroup: 'Trading Rules',
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
        checkboxGroup: 'Trading Rules',
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
        id: 'modal-buyPriceFormula',
        label: t('web-editor.modals.fields.buy-price-formula', 'Buy Price Formula'),
        value: item.buyPriceFormula || '',
        hint: t('web-editor.modals.fields.price-formula-hint', 'Variables: base, dynamic, global_count, amount, price_change, min_price, max_price. Functions: min,max,abs,round,floor,ceil,pow')
    });
    fields.push({
        id: 'modal-sellPriceFormula',
        label: t('web-editor.modals.fields.sell-price-formula', 'Sell Price Formula'),
        value: item.sellPriceFormula || '',
        hint: t('web-editor.modals.fields.price-formula-hint', 'Variables: base, dynamic, global_count, amount, price_change, min_price, max_price. Functions: min,max,abs,round,floor,ceil,pow')
    });
    fields.push({
        id: 'modal-enableCommands',
        label: 'Enable Commands',
        type: 'checkbox',
        value: hasCommands,
        checkboxGroup: 'Automation',
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
    fields.push({ id: 'modal-runCommandOnly', label: t('web-editor.modals.fields.run-command-only', 'Run Command Only'), type: 'checkbox', value: item.runCommandOnly !== false, hint: t('web-editor.modals.fields.run-command-only-hint', 'If enabled, the item will not be given to the player if commands are present.'), hidden: !hasCommands, checkboxGroup: 'Automation' });
    fields.push({ id: 'modal-permission', label: t('web-editor.modals.fields.permission', 'Permission'), value: item.permission || '', hint: t('web-editor.modals.fields.permission-hint', 'Optional permission required to buy/sell this item.') });
    fields.push({ id: 'modal-itemKey', label: 'Item Key', value: item.itemKey || '', hint: 'Optional stable key written as item-key in YAML.' });
    fields.push({ id: 'modal-variantKey', label: 'Variant Key', value: item.variantKey || '', hint: 'Optional variant identifier written as variant-key in YAML.' });
    fields.push({
        id: 'modal-enableConditions',
        label: 'Enable Advanced Conditions',
        type: 'checkbox',
        value: hasAdvancedConditions,
        checkboxGroup: 'Requirements',
        onchange: (e) => {
            const enabled = e.target.checked;
            ['minPlayerLevel', 'maxPlayerLevel', 'requiredGamemode', 'allowedWorlds', 'deniedWorlds'].forEach(key => {
                const group = document.getElementById(`group-modal-${key}`);
                if (group) group.style.display = enabled ? 'block' : 'none';
            });
        }
    });
    fields.push({ id: 'modal-minPlayerLevel', label: 'Min Player Level', type: 'number', value: item.minPlayerLevel || 0, min: 0, hint: '0 disables this condition.', hidden: !hasAdvancedConditions });
    fields.push({ id: 'modal-maxPlayerLevel', label: 'Max Player Level', type: 'number', value: item.maxPlayerLevel || 0, min: 0, hint: '0 disables this condition.', hidden: !hasAdvancedConditions });
    fields.push({
        id: 'modal-requiredGamemode',
        label: 'Required Gamemode',
        type: 'select',
        value: (item.requiredGamemode || '').toUpperCase(),
        options: [
            { value: '', label: 'Any' },
            { value: 'SURVIVAL', label: 'SURVIVAL' },
            { value: 'CREATIVE', label: 'CREATIVE' },
            { value: 'ADVENTURE', label: 'ADVENTURE' },
            { value: 'SPECTATOR', label: 'SPECTATOR' }
        ],
        hint: 'Optional gamemode restriction.',
        hidden: !hasAdvancedConditions
    });
    fields.push({ id: 'modal-allowedWorlds', label: 'Allowed Worlds', type: 'textarea', value: (item.allowedWorlds || []).join('\n'), hint: 'One world per line. Leave empty to allow all worlds.', hidden: !hasAdvancedConditions });
    fields.push({ id: 'modal-deniedWorlds', label: 'Denied Worlds', type: 'textarea', value: (item.deniedWorlds || []).join('\n'), hint: 'One world per line. Deny list takes priority over allowed list.', hidden: !hasAdvancedConditions });
    fields.push({ id: 'modal-sellAddsToStock', label: 'Sell adds back to stock', type: 'checkbox', value: item.sellAddsToStock === true, hint: 'Override shop setting for this item', checkboxGroup: 'Trading Rules' });
    fields.push({ id: 'modal-allowSellStockOverflow', label: 'Allow sell stock overflow', type: 'checkbox', value: item.allowSellStockOverflow === true, hint: 'If disabled, selling is blocked when stock is already full', checkboxGroup: 'Trading Rules' });
    const itemStockReset = sanitizeStockResetRule(item.stockResetRule);
    fields.push({
        id: 'modal-stockResetEnabled',
        label: 'Enable stock reset for this item',
        type: 'checkbox',
        value: itemStockReset.enabled,
        checkboxGroup: 'Stock & Reset',
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
        checkboxGroup: 'Stock & Reset',
        hint: 'Used when Shop Item Lore Format contains %global-limit%'
    });
    fields.push({
        id: 'modal-showStockResetTimer',
        label: 'Enable stock reset timer token',
        type: 'checkbox',
        value: !!item.showStockResetTimer,
        checkboxGroup: 'Stock & Reset',
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
        extraActions: [
            {
                id: 'modal-export-item-btn',
                label: 'Export Item',
                className: 'btn-secondary',
                onClick: () => exportShopItemData(item)
            },
            {
                id: 'modal-clone-item-btn',
                label: 'Clone to Shop',
                className: 'btn-warning',
                onClick: () => cloneShopItemToAnotherShop(item)
            },
            {
                id: 'modal-bulk-clone-item-btn',
                label: 'Clone to Multiple',
                className: 'btn-warning',
                onClick: () => cloneShopItemToMultipleShops(item)
            }
        ],
        preview: {
            enabled: true,
            title: 'Item Preview',
            render: (formData) => buildShopItemPreviewHtml(item, formData)
        },
        onSave: (data) => {
            const beforeData = JSON.parse(JSON.stringify(item));

            const newMaterial = document.getElementById('modal-material')?.value.toUpperCase() || item.material;
            item.material = newMaterial;
            item.name = data['modal-name'];
            item.price = parseFloat(data['modal-price']) || 0;
            item.sellPrice = parseFloat(data['modal-sellPrice']) || 0;
            item.buyPricePerItem = (data['modal-buyPricePerItem'] || 'per-item') === 'per-item';
            item.sellPricePerItem = (data['modal-sellPricePerItem'] || 'per-item') === 'per-item';
            item.campaign = (data['modal-campaignKey'] || '').trim();
            item.campaignEnabled = !!data['modal-campaignEnabled'];
            item.campaignName = item.campaignEnabled ? (data['modal-campaignName'] || '').trim() : '';
            item.campaignStart = item.campaignEnabled ? (data['modal-campaignStart'] || '').trim() : '';
            item.campaignEnd = item.campaignEnabled ? (data['modal-campaignEnd'] || '').trim() : '';
            item.campaignTimezone = item.campaignEnabled ? (data['modal-campaignTimezone'] || '').trim() : '';
            item.campaignBuyMultiplier = item.campaignEnabled ? Math.max(0.01, parseFloat(data['modal-campaignBuyMultiplier']) || 1) : 1;
            item.campaignSellMultiplier = item.campaignEnabled ? Math.max(0.01, parseFloat(data['modal-campaignSellMultiplier']) || 1) : 1;
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
            item.buyPriceFormula = (data['modal-buyPriceFormula'] || '').trim();
            item.sellPriceFormula = (data['modal-sellPriceFormula'] || '').trim();
            item.commands = data['modal-enableCommands']
                ? data['modal-commands'].split('\n').filter(line => line.trim() !== '')
                : [];
            item.runAs = data['modal-enableCommands']
                ? ((data['modal-runAs'] || 'console').toLowerCase() === 'player' ? 'player' : 'console')
                : 'console';
            item.runCommandOnly = data['modal-enableCommands'] ? data['modal-runCommandOnly'] : true;
            item.permission = data['modal-permission'] || '';
            item.itemKey = (data['modal-itemKey'] || '').trim();
            item.variantKey = (data['modal-variantKey'] || '').trim();
            if (data['modal-enableConditions']) {
                item.minPlayerLevel = parseInt(data['modal-minPlayerLevel']) || 0;
                item.maxPlayerLevel = parseInt(data['modal-maxPlayerLevel']) || 0;
                item.requiredGamemode = (data['modal-requiredGamemode'] || '').toUpperCase();
                item.allowedWorlds = (data['modal-allowedWorlds'] || '').split('\n').map(v => v.trim()).filter(v => v.length > 0);
                item.deniedWorlds = (data['modal-deniedWorlds'] || '').split('\n').map(v => v.trim()).filter(v => v.length > 0);
            } else {
                item.minPlayerLevel = 0;
                item.maxPlayerLevel = 0;
                item.requiredGamemode = '';
                item.allowedWorlds = [];
                item.deniedWorlds = [];
            }
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
    const entry = activityLog.find(e => String(e.id) === String(entryId));
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

    const confirmed = await showConfirm(`Are you sure you want to rollback this ${entry.action} ${entry.target}? This will overwrite current state.`);
    if (!confirmed) return;

    try {
        const response = await fetch(`api/activity-log/rollback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': sessionToken
            },
            body: JSON.stringify({
                id: Number(entry.id)
            })
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || data.error || `HTTP error! status: ${response.status}`);
        }

        await loadAllFiles();
        await loadActivityLog();
        closeActivityDetailModal();
        closeActivityLogModal();
        refreshActivityLog();
        showToast(t('web-editor.modals.rollback-success', 'Action rolled back successfully'), 'success');
    } catch (error) {
        console.error('Rollback failed:', error);
        showAlert(t('web-editor.modals.rollback-failed', 'Rollback failed') + ': ' + error.message, 'error');
    }
}

async function refreshActivityLog() {
    await loadActivityLog();

    const container = document.getElementById('activity-log-container');
    const emptyState = document.getElementById('activity-log-empty');
    if (!container) return;

    if (activityLog.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    const sortedActivity = [...activityLog].sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
    let html = '';
    sortedActivity.forEach(entry => {
        const timeAgo = getTimeAgo(entry.timestamp);
        const icon = entry.action === 'created' ? '➕' : entry.action === 'updated' ? '✏️' : '🗑️';
        const color = entry.action === 'created' ? 'var(--activity-created-bg)' : entry.action === 'updated' ? 'var(--activity-updated-bg)' : 'var(--activity-deleted-bg)';
        const borderColor = entry.action === 'created' ? 'var(--activity-created-border)' : entry.action === 'updated' ? 'var(--activity-updated-border)' : 'var(--activity-deleted-border)';

        html += `
            <div class="shop-item" style="margin-bottom: 10px; background: ${color}; border-color: ${borderColor}; cursor: pointer;" onclick="openActivityDetailModal(${JSON.stringify(entry.id)})">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                    <div style="font-size: 1.2em; flex-shrink: 0;">${icon}</div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(getActivitySummary(entry))}</div>
                        <div style="font-size: 0.8em; color: rgba(255,255,255,0.6);">${entry.username || 'Unknown'} • ${timeAgo} • ${escapeHtml(entry.target || 'unknown')}</div>
                    </div>
                    <div style="font-size: 1.2em; opacity: 0.5;">🔍</div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}
