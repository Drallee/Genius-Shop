const editorNavigationMedia = window.matchMedia('(max-width: 900px)');
let editorNavigationCollapsed = false;

function syncEditorNavigation() {
    const mobile = editorNavigationMedia.matches;
    const open = document.body.classList.contains('navigation-open');
    const sidebar = document.getElementById('editor-sidebar');
    const toggle = document.getElementById('navigation-toggle');
    document.body.classList.toggle('navigation-collapsed', editorNavigationCollapsed);
    sidebar.inert = mobile && !open;
    document.getElementById('editor-workspace').inert = mobile && open;
    document.querySelector('.navigation-backdrop').hidden = !mobile || !open;
    toggle.setAttribute('aria-expanded', String(mobile ? open : !editorNavigationCollapsed));
    const action = mobile ? 'Open navigation' : editorNavigationCollapsed ? 'Expand navigation' : 'Collapse navigation';
    toggle.setAttribute('aria-label', action);
    toggle.title = action;
    document.querySelectorAll('.editor-sidebar .tab').forEach(button => {
        const label = button.querySelector('.sidebar-label').textContent.trim();
        button.title = label;
        button.setAttribute('aria-label', label);
        if (button.classList.contains('active')) {
            button.setAttribute('aria-current', 'page');
            document.getElementById('navigation-current-section').textContent = label;
        } else {
            button.removeAttribute('aria-current');
        }
    });
}

function toggleEditorNavigation() {
    if (editorNavigationMedia.matches) {
        document.body.classList.toggle('navigation-open');
        syncEditorNavigation();
        if (document.body.classList.contains('navigation-open')) {
            document.querySelector('.editor-sidebar .tab.active').focus();
        }
    } else {
        editorNavigationCollapsed = !editorNavigationCollapsed;
        try { localStorage.setItem('editor-navigation-collapsed', String(editorNavigationCollapsed)); } catch (_) {}
        syncEditorNavigation();
    }
}

function closeEditorNavigation() {
    const wasOpen = document.body.classList.contains('navigation-open');
    document.body.classList.remove('navigation-open');
    syncEditorNavigation();
    if (wasOpen) document.getElementById('navigation-toggle').focus();
}

function selectEditorTab(tabName) {
    switchTab(tabName);
    closeEditorNavigation();
    document.querySelector('.main-content').scrollIntoView({ block: 'start', behavior: 'instant' });
}

document.addEventListener('DOMContentLoaded', () => {
    try { editorNavigationCollapsed = localStorage.getItem('editor-navigation-collapsed') === 'true'; } catch (_) {}
    syncEditorNavigation();
    new MutationObserver(syncEditorNavigation).observe(document.querySelector('.sidebar-tabs'), { childList: true, subtree: true, characterData: true });
    editorNavigationMedia.addEventListener('change', closeEditorNavigation);
    document.addEventListener('keydown', event => {
        if (!editorNavigationMedia.matches || !document.body.classList.contains('navigation-open')) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            closeEditorNavigation();
        } else if (event.key === 'Tab') {
            const buttons = Array.from(document.querySelectorAll('.editor-sidebar button'));
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    });
});
