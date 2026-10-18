window.EditorShortcuts = (() => {
    let initialized = false;
    let dialog;
    const tabs = () => Array.from(document.querySelectorAll('.sidebar-tabs [data-tab]'))
        .filter(button => !button.hidden && EditorPermissions.tabAllowed(button.dataset.tab));
    const available = action => {
        if (!sessionToken || getEditorState('isLoadingFiles')) return false;
        if (action === 'save') return EditorPermissions.canSaveTab(currentTab);
        if (action === 'publish') return EditorPermissions.hasDrafts();
        if (action === 'history') return EditorPermissions.can('admin');
        if (action === 'reload') return EditorPermissions.tabAllowed(currentTab);
        if (action === 'search') return currentTab === 'shop';
        if (action === 'previous' || action === 'next') return tabs().length > 1;
        return action === 'help';
    };
    const definitions = [
        ['save', 'Ctrl + S', 'Quick-save the current section to your draft'],
        ['publish', 'Ctrl + Shift + S', 'Open draft review / publish confirmation'],
        ['history', 'Ctrl + H', 'Open history'],
        ['reload', 'Ctrl + R', 'Reload configuration (asks first)'],
        ['previous', 'Ctrl + Alt + Left', 'Previous accessible tab'],
        ['next', 'Ctrl + Alt + Right', 'Next accessible tab'],
        ['search', 'Ctrl + F', 'Focus shop item search'],
        ['help', 'Ctrl + /', 'Open / close keyboard shortcuts']
    ];
    function blocked() {
        return !!document.querySelector('dialog[open]') || Array.from(document.querySelectorAll('.modal-overlay'))
            .some(modal => getComputedStyle(modal).display !== 'none');
    }
    function open() {
        if (dialog?.open) { dialog.close(); return; }
        if (blocked() || window.EditorTutorial?.isActive()) return;
        if (typeof closeEditorNavigation === 'function') closeEditorNavigation();
        if (!dialog) {
            dialog = document.createElement('dialog');
            dialog.id = 'editor-shortcuts';
            dialog.className = 'editor-shortcuts';
            dialog.setAttribute('aria-labelledby', 'editor-shortcuts-title');
            document.body.append(dialog);
        }
        dialog.replaceChildren();
        const header = document.createElement('header');
        const title = document.createElement('h2');
        title.id = 'editor-shortcuts-title'; title.textContent = 'Keyboard shortcuts';
        const close = document.createElement('button');
        close.type = 'button'; close.className = 'btn btn-secondary'; close.textContent = 'Close';
        close.setAttribute('aria-label', 'Close shortcuts');
        close.onclick = () => dialog.close();
        header.append(title, close);
        const content = document.createElement('div');
        content.className = 'shortcuts-content';
        const intro = document.createElement('p');
        intro.textContent = 'Use Command instead of Ctrl on macOS. Shortcuts pause while dialogs or tutorials are open. Publishing always requires an explicit confirmation.';
        content.append(intro);
        for (const [action, keys, description] of definitions) {
            const row = document.createElement('div');
            row.className = 'shortcut-row';
            const label = document.createElement('span');
            label.textContent = description;
            const binding = document.createElement('kbd');
            binding.textContent = keys;
            row.append(label, binding);
            if (!available(action)) {
                row.classList.add('shortcut-unavailable');
                const reason = document.createElement('small');
                reason.textContent = 'Unavailable with your current permissions or tab';
                row.append(reason);
            }
            content.append(row);
        }
        const escape = document.createElement('p');
        escape.textContent = 'Escape closes this menu. Browser-reserved shortcuts may vary by browser or operating system.';
        content.append(escape);
        dialog.append(header, content);
        dialog.showModal();
    }
    async function run(action) {
        if (!available(action)) {
            if (typeof showToast === 'function') showToast('This shortcut is unavailable for your permissions or current tab.', 'warning');
            return;
        }
        if (action === 'help') return open();
        if (blocked() || isSaving || window.EditorTutorial?.isActive()) return;
        try {
            if (action === 'save') {
                EditorRevisions.requireResolved();
                await saveCurrentTabChanges(false);
            } else if (action === 'publish') {
                EditorRevisions.requireResolved();
                await EditorDrafts.review();
            } else if (action === 'history') openActivityLogModal();
            else if (action === 'reload') await reloadCurrentConfig();
            else if (action === 'search') {
                const input = document.getElementById('item-search');
                input?.focus(); input?.select();
            } else {
                const allowed = tabs();
                const index = allowed.findIndex(button => button.dataset.tab === currentTab);
                const next = (index + (action === 'next' ? 1 : -1) + allowed.length) % allowed.length;
                selectEditorTab(allowed[next].dataset.tab);
            }
        } catch (error) {
            if (error.isSaveConflict) return;
            showAlert(error.message || 'The shortcut could not complete.', 'error');
        }
    }
    function init() {
        const launcher = document.getElementById('editor-shortcuts-button');
        if (launcher) launcher.disabled = !document.body.classList.contains('permissions-ready');
        if (initialized) return;
        initialized = true;
        document.addEventListener('keydown', event => {
            if (!sessionToken || event.defaultPrevented || event.isComposing) return;
            const key = String(event.key || '').toLowerCase();
            if (key === 'escape') {
                if (dialog?.open) { event.preventDefault(); dialog.close(); return; }
                for (const [id, close] of [['activity-detail-modal', closeActivityDetailModal], ['activity-log-modal', closeActivityLogModal], ['save-confirmation-modal', closeSaveConfirmationModal]]) {
                    if (document.getElementById(id)?.style.display === 'flex') { event.preventDefault(); close(); return; }
                }
                return;
            }
            if (!(event.ctrlKey || event.metaKey)) return;
            let action;
            if (!event.altKey && key === 's') action = event.shiftKey ? 'publish' : 'save';
            else if (!event.altKey && !event.shiftKey && key === 'h') action = 'history';
            else if (!event.altKey && !event.shiftKey && key === 'r') action = 'reload';
            else if (!event.altKey && !event.shiftKey && key === 'f') action = 'search';
            else if (!event.altKey && !event.shiftKey && (key === '/' || event.code === 'Slash')) action = 'help';
            else if (event.altKey && !event.shiftKey && key === 'arrowleft') action = 'previous';
            else if (event.altKey && !event.shiftKey && key === 'arrowright') action = 'next';
            if (!action) return;
            event.preventDefault();
            if (event.repeat) return;
            void run(action);
        });
    }
    return { init, open, run, available };
})();
