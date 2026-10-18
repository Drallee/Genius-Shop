(function(global) {
    'use strict';
    let capabilities = {};
    let readOnly = new Set();
    let checking;
    const tabPermissions = { mainmenu: 'drafts', shop: 'drafts', purchase: 'drafts', sell: 'drafts',
        campaigns: 'drafts', customitems: 'drafts', guisettings: 'drafts', commands: 'commands',
        stockanalytics: 'analytics', salesanalytics: 'analytics', dataeditor: 'database' };
    const tabFiles = { mainmenu: 'menus/main-menu.yml', purchase: 'menus/purchase-menu.yml',
        sell: 'menus/sell-menu.yml', campaigns: 'campaigns.yml', customitems: 'custom-items.yml',
        guisettings: 'menus/gui-settings.yml', commands: 'commands.yml' };
    const can = capability => capabilities.admin === true || capabilities[capability] === true || capability === 'commands' && capabilities.drafts === true;
    const sectionFor = tab => ['stockanalytics', 'salesanalytics'].includes(tab) ? 'analytics' : tab === 'dataeditor' ? 'database' : tab;
    const sectionAccess = tab => {
        if (can('admin')) return { view: true, edit: true };
        const section = capabilities.sections?.[sectionFor(tab)];
        if (section) return section;
        const edit = !!tabPermissions[tab] && !['stockanalytics', 'salesanalytics'].includes(tab) && can(tabPermissions[tab]);
        return { view: edit || (!!tabPermissions[tab] && can(tabPermissions[tab])) || can('publish'), edit };
    };
    const tabAllowed = tab => !!tabPermissions[tab] && (sectionAccess(tab).view || tab === 'guisettings' && sectionAccess('shop').view);
    const fileForTab = tab => tab === 'guisettings' && global.GuiLayout ? GuiLayout.targetFile() : tab === 'shop' ? `shops/${currentShopFile}` : tabFiles[tab];
    function canWriteFile(file) {
        if (readOnly.has(file)) return false;
        if (file === 'commands.yml') return sectionAccess('commands').edit;
        if (file === 'config.yml' || file === 'discord.yml' || file === 'gui.yml' || file.startsWith('languages/')) return can('admin');
        const section = file.startsWith('shops/') ? 'shop' : Object.entries(tabFiles).find(([, path]) => path === file)?.[0];
        return section ? sectionAccess(section).edit : file === 'menus/bulk-sell-menu.yml' && sectionAccess('sell').edit;
    }
    const canSaveTab = tab => tabAllowed(tab) && (tab === 'guisettings' && canWriteFile('menus/gui-settings.yml') || !!fileForTab(tab) && canWriteFile(fileForTab(tab)));
    const canEditDrafts = () => Object.keys(tabFiles).some(tab => sectionAccess(tab).edit) || sectionAccess('shop').edit;
    const hasDrafts = () => can('publish') || canEditDrafts();

    function set(value, lockedFiles = []) {
        // Missing or old capability payloads fail closed instead of assuming administrator access.
        capabilities = value || {};
        readOnly = new Set(lockedFiles);
    }

    function refresh() {
        const practice = global.EditorTutorialPractice && global.EditorTutorialPractice.isActive();
        const editableTab = tab => canSaveTab(tab) || practice && tabAllowed(tab);
        document.querySelectorAll('.sidebar-tabs [data-tab]').forEach(button => {
            button.hidden = !tabAllowed(button.dataset.tab);
        });
        document.querySelectorAll('button[onclick="openActivityLogModal()"]').forEach(button => { button.hidden = !can('admin'); });
        document.querySelectorAll('button[onclick="manualSave()"]').forEach(button => { button.hidden = !canSaveTab(currentTab); });
        document.querySelectorAll('button[onclick="publishChanges()"]').forEach(button => {
            button.hidden = !hasDrafts();
            button.querySelector('span:last-child').textContent = can('publish') ? 'REVIEW & PUBLISH' : 'REVIEW DRAFT';
        });
        const status = document.getElementById('draft-status');
        if (status) status.hidden = !hasDrafts();
        const footer = document.querySelector('.footer-actions-container');
        if (footer) {
            const divider = footer.querySelector('.divider-v');
            if (divider) divider.hidden = !can('admin');
            footer.style.setProperty('--footer-action-count', footer.querySelectorAll('button:not([hidden])').length);
        }
        const publish = document.getElementById('draft-publish');
        if (publish) {
            publish.hidden = !can('publish');
            if (!can('publish')) publish.disabled = true;
        }
        const modalContent = document.getElementById('modal-content');
        if (modalContent) modalContent.inert = !editableTab(currentTab);
        document.querySelectorAll('#edit-modal button[onclick="saveEditModal()"], #modal-delete-btn').forEach(button => {
            button.disabled = !editableTab(currentTab);
        });
        const toggle = document.getElementById('auto-save-toggle');
        if (toggle) toggle.closest('label').hidden = !Object.keys(tabFiles).some(tab => sectionAccess(tab).edit) && !sectionAccess('shop').edit;
        const editable = editableTab(currentTab);
        const locked = tabAllowed(currentTab) && !!fileForTab(currentTab) && !editable;
        const notice = document.getElementById('editor-permission-notice');
        if (notice) {
            notice.hidden = !locked;
            const section = currentTab === 'guisettings' && global.GuiLayout && GuiLayout.isShopScope() ? 'shop' : sectionFor(currentTab);
            notice.textContent = `Read-only: editing this section requires geniusshop.editor.${section}.drafts or geniusshop.editor.drafts. Command-bearing files require geniusshop.editor.commands or broad draft access.`;
        }
        const preview = document.querySelector('.minecraft-preview-section');
        if (preview) preview.inert = !editable;
        for (const tab of Object.keys(tabPermissions)) {
            const section = document.getElementById(`${tab}-tab`);
            if (!section) continue;
            // Keep the shop selector usable when the selected shop is read-only.
            if (tab === 'shop') {
                const items = document.getElementById('items-container');
                if (items) items.inert = !editableTab('shop');
                section.querySelectorAll('.content-header button').forEach(button => {
                    button.inert = button.getAttribute('onclick') === 'createNewShop()' ? !sectionAccess('shop').edit : !editableTab('shop');
                });
            } else if (tab === 'guisettings') {
                section.inert = false;
                section.querySelectorAll('.settings-group:not(.gui-layout-settings)').forEach(group => { group.inert = !sectionAccess('guisettings').edit; });
                const layoutEditor = document.getElementById('gui-layout-editor');
                const layoutEditable = canWriteFile(fileForTab('guisettings')) || practice && tabAllowed('guisettings');
                if (layoutEditor) layoutEditor.inert = !layoutEditable;
                const buttonEditor = document.getElementById('gui-button-editor');
                if (buttonEditor) buttonEditor.inert = !layoutEditable;
            } else if (!['stockanalytics', 'salesanalytics', 'dataeditor'].includes(tab)) {
                section.inert = !editableTab(tab);
            }
        }
        const empty = document.getElementById('restricted-tab');
        document.querySelectorAll('#data-editor-sections input').forEach(input => { input.readOnly = !can('database'); });
        document.querySelectorAll('#data-editor-sections button').forEach(button => { button.disabled = !can('database'); });
        if (empty) empty.classList.toggle('active', currentTab === 'restricted');
    }

    function apply() {
        const tab = tabAllowed(currentTab) ? currentTab : Object.keys(tabPermissions).find(tabAllowed) || 'restricted';
        switchTab(tab);
        refresh();
        document.body.classList.add('permissions-ready');
    }

    function recheck() {
        if (checking) return checking;
        checking = (async () => {
            const response = await fetch(`api/files?t=${Date.now()}`, { headers: { 'X-Session-Token': sessionToken } });
            if (response.status === 401 || response.status === 403) {
                set({});
            } else if (response.ok) {
                const data = await response.json();
                // Revoke immediately without replacing local edits. Newly granted sections wait for a full reload
                // so blank/default client models can never overwrite files the user has not loaded yet.
                const reduced = {};
                for (const key of ['admin', 'analytics', 'drafts', 'publish', 'commands', 'database']) {
                    reduced[key] = can(key) && data.permissions?.[key] === true;
                }
                if (data.permissions?.sections) {
                    reduced.sections = {};
                    for (const [section, access] of Object.entries(data.permissions.sections)) {
                        const previous = sectionAccess(section === 'analytics' ? 'stockanalytics' : section === 'database' ? 'dataeditor' : section);
                        reduced.sections[section] = { view: previous.view && access.view, edit: previous.edit && access.edit };
                    }
                }
                set(reduced, data.readOnlyFiles);
            } else return;
            apply();
        })().catch(error => console.warn('Could not refresh editor permissions:', error)).finally(() => { checking = null; });
        return checking;
    }

    if (global.addEventListener) global.addEventListener('focus', () => {
        if (document.body.classList.contains('permissions-ready')) recheck();
    });

    global.EditorPermissions = { can, set, apply, refresh, recheck, tabAllowed, canSaveTab, canWriteFile, hasDrafts, canEditDrafts, canViewSharedGui: () => sectionAccess('guisettings').view };
})(window);
