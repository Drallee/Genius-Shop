(function(global) {
    'use strict';

    // Keep IDs stable. Bump only a changed section's revision to onboard existing users.
    const sections = [
        { id: 'workspace', revision: 1, title: 'Workspace', steps: [
            { target: '#navigation-toggle', title: 'Move between sections', text: 'Use the navigation menu to choose a part of the shop configuration. Your current section appears beside this button.' },
            { target: '#editor-tutorial-help', title: 'Return to a tutorial', text: 'Open Tutorial to replay the full walkthrough, choose one section, or change new-feature tutorial preferences.' }
        ] },
        { id: 'mainmenu', revision: 3, title: 'Main menu', tab: 'mainmenu', steps: [
            { target: '#mainmenu-tab button[onclick="addMainMenuShop()"]', title: 'Main menu buttons', text: 'Manage the buttons players use to open shops. Add a button or select an existing one to edit it.' },
            { target: '#preview .gui-title-container', task: 'menu-title', title: 'Edit the preview title', text: 'Click the title above the preview and replace it with Practice menu title. These are temporary practice values; your original configuration will return when you exit.' }
        ] },
        { id: 'shop', revision: 3, title: 'Shop items', tab: 'shop', steps: [
            { target: '.shop-file-selector-wrapper', task: 'shop-select', title: 'Choose a shop', text: 'Open the shop selector and choose the tutorial practice shop. It contains sample items, even if your real shop is empty. Practice changes never reach the server.' },
            { target: '#preview-grid .gui-slot.filled', task: 'shop-open', modal: true, title: 'Click the preview to edit an item', text: 'Click the first occupied preview slot, the practice stone, to open its editor. Clicking an item card opens the same editor outside the tutorial.' },
            { target: '#modal-material', task: 'material', itemEditor: true, title: 'Material and appearance', text: 'Replace STONE with DIAMOND in the material field. Watch the item preview update. Potion, head, and spawner controls appear for their corresponding materials.' },
            { target: '#modal-price', task: 'price', itemEditor: true, title: 'Buy, sell, and bundle pricing', text: 'Set the Buy Price to 25. Buy and sell prices are independent; the price mode decides whether they apply per item or per configured amount.' },
            { target: '#group-modal-enableLore label', task: 'lore', itemEditor: true, title: 'Lore, enchantments, and display flags', text: 'Check Enable Lore, then enter Practice item in the Lore field. Enchantments and display flags give you more control over the item and its tooltip.' },
            { target: '#group-modal-enableLimits label', itemEditor: true, title: 'Player limits and shared stock', text: 'Enable Limits to configure player-specific limits or a global stock limit. Stock options can let sales replenish stock, allow overflow, and show stock information in item lore.' },
            { target: '#group-modal-stockResetEnabled label', itemEditor: true, title: 'Scheduled stock resets', text: 'Stock resets can follow hourly, daily, weekly, monthly, yearly, one-time, or interval schedules. Set the schedule and timezone when enabling them. Stock and reset-timer display options control the corresponding lore tokens.' },
            { target: '#group-modal-dynamicPricing label', task: 'dynamic', itemEditor: true, title: 'Dynamic prices and campaigns', text: 'Enable Dynamic Pricing to reveal its minimum, maximum, and change settings. Formulas provide custom price calculations, and campaigns apply scheduled multipliers.' },
            { target: '#modal-permission', task: 'permission', itemEditor: true, title: 'Permissions and trading conditions', text: 'Enter tutorial.practice as the item permission. Advanced conditions also support player levels, game modes, and world restrictions. This permission is only being applied to a temporary practice item.' },
            { target: '#group-modal-enableCommands label', task: 'item-commands', itemEditor: true, title: 'Run commands on purchase', text: 'Enable Commands and enter say Practice %player% in the Commands field. Commands can run as console or player. No command is executed by this tutorial.' },
            { target: '#edit-modal button[onclick="saveEditModal()"]', task: 'item-save', itemEditor: true, title: 'Apply the practice item edits', text: 'Click the item dialog\'s Save button to apply your edits to the temporary item. This is not Save Tab or Publish All: no practice data is sent to the server.' },
            { target: '#preview-grid .gui-slot.filled', task: 'drag', modal: true, title: 'Click and drag to arrange items', text: 'Drag the diamond to another preview slot. Dropping onto an occupied slot swaps items. On touch devices or with a keyboard, click the diamond, change Slot to 2, and click the item dialog\'s Save instead.' },
            { target: '#shop-tab button[onclick="addItem()"]', task: 'item-add', title: 'Find or add shop items', text: 'Click Add Item to create another temporary item. Outside the tutorial, search and sort the item list to find the entry you need.' },
            { target: '#modal-clone-item-btn', itemEditor: true, title: 'Reuse an item in other shops', text: 'Export Item copies an item definition for reuse. Clone to Shop or Clone to Multiple copies it to selected shops. Those are editing actions; this tutorial never activates them or the item Save button.' }
        ] },
        { id: 'purchase', revision: 2, title: 'Purchase screen', tab: 'purchase', steps: [
            { target: '#purchase-settings-preview .stealth-edit-container:first-child', task: 'purchase-rows', title: 'Purchase layout', text: 'Change Rows to 4, then leave the field to update the purchase preview. These controls configure the purchase screen, not the item prices.' }
        ] },
        { id: 'sell', revision: 2, title: 'Sell screen', tab: 'sell', steps: [
            { target: '#sell-settings-preview .stealth-edit-container:nth-child(2)', task: 'sell-maximum', title: 'Sell layout', text: 'Change Max to 128. This limits the maximum amount offered on the selling screen. Your real setting will be restored after practice.' }
        ] },
        { id: 'campaigns', revision: 2, title: 'Campaigns', tab: 'campaigns', steps: [
            { target: '#campaigns-tab button[onclick="addCampaignTemplate()"]', task: 'campaign-open', modal: true, title: 'Campaign schedules', text: 'Click Add Campaign to start a temporary campaign. Campaigns can apply scheduled multipliers to shops and items.' },
            { target: '#modal-campaign-key', task: 'campaign-key', modal: true, title: 'Name a campaign key', text: 'Enter practice-sale as the key. Keys identify campaigns when assigning them to shops and items.' },
            { target: '#modal-campaign-buy', task: 'campaign-multiplier', modal: true, title: 'Set a campaign multiplier', text: 'Set Buy Multiplier to 0.9 for a ten-percent discount. In a real campaign, also review its start, end, and timezone.' },
            { target: '#edit-modal button[onclick="saveEditModal()"]', task: 'campaign-save', modal: true, title: 'Apply the practice campaign', text: 'Click the dialog\'s Save to add the campaign to temporary practice data. It will not be published or assigned to a real shop.' }
        ] },
        { id: 'commands', revision: 2, title: 'Commands', tab: 'commands', steps: [
            { target: '#commands-tab button[onclick="addCustomCommand()"]', task: 'command-add', title: 'Custom commands', text: 'Click Add Command to create a temporary command entry. Commands can open shops, buy items, or sell items.' },
            { target: '[data-command-field="name"]', task: 'command-name', title: 'Name the practice command', text: 'Replace the new command\'s name with practice-shop, without a slash. Review its action, targets, and permission when configuring a real command.' }
        ] },
        { id: 'customitems', revision: 2, title: 'Custom items', tab: 'customitems', steps: [
            { target: '#customitems-tab button[onclick="addCustomItem()"]', task: 'customitem-add', title: 'Reusable item definitions', text: 'Click Add Item to create a temporary reusable item definition. Its controls configure click triggers, actions, multipliers, and other behavior.' }
        ] },
        { id: 'stockanalytics', revision: 1, title: 'Stock analytics', tab: 'stockanalytics', steps: [
            { target: '#stock-analytics-generated', title: 'Inspect stock', text: 'Review stock usage and resets here. Viewing this section does not change the stock counters.' }
        ] },
        { id: 'dataeditor', revision: 1, title: 'Stored data', tab: 'dataeditor', steps: [
            { target: '#data-editor-generated', title: 'Persistent counters', text: 'Inspect stored player counts, global counts, and reset data. Data editing actions affect live stored values, so review each action carefully.' }
        ] },
        { id: 'guisettings', revision: 2, title: 'GUI settings', tab: 'guisettings', steps: [
            { target: '#gui-settings-container [onclick="GuiLayout.edit(\'backButton\')"]', task: 'gui-open', modal: true, title: 'Shared GUI settings', text: 'Click the Back Button entry to edit a navigation button. The layout selector chooses shared defaults or a specific shop.' },
            { target: '#name', task: 'gui-name', modal: true, title: 'Edit a shared button', text: 'Change Display Name to Practice back. Button names and lore are configured here.' },
            { target: '#edit-modal button[onclick="saveEditModal()"]', task: 'gui-save', modal: true, title: 'Apply the practice button', text: 'Click the dialog\'s Save to apply the temporary name. Your real button will return when you exit the tutorial.' }
        ] },
        { id: 'saving', revision: 3, title: 'Saving and history', steps: [
            { target: '.sticky-footer-actions', title: 'Review before saving', text: 'Save Draft keeps the current section separate from the live server. Review & Publish saves all sections as a draft, checks references, and shows the changes before you explicitly publish. History versions restore into the draft too. During practice server writes and autosave are blocked; Finish restores your original drafts and preferences.' }
        ] }
    ];

    const requiredValues = {
        'menu-title': 'Practice menu title', material: 'DIAMOND', price: '25',
        lore: 'Practice item', permission: 'tutorial.practice',
        'item-commands': 'say Practice %player%', drag: '2',
        'purchase-rows': '4', 'sell-maximum': '128',
        'campaign-key': 'practice-sale', 'campaign-multiplier': '0.9',
        'command-name': 'practice-shop', 'gui-name': 'Practice back'
    };

    let progress;
    let dialog;
    let panel;
    let spotlight;
    let queue = [];
    let steps = [];
    let index = 0;
    let mode = 'library';
    let originalTab;
    let previousFocus;
    let target;
    let frame;
    let initialized = false;
    let storageAvailable = true;
    let ownedItemModal = null;
    let activeTask = null;
    let nextButton;
    let taskStatus;
    let monitor;
    let advanceTimer = null;
    let resumeAutoSave = false;
    let taskInstances = new Map();
    let completedTasks = new Set();
    const addedTabStops = new Map();
    let pointerInPanel = false;

    function allowedRoots() {
        return activeTask ? activeTask.allow.flatMap(selector => Array.from(document.querySelectorAll(selector))) : [];
    }

    function interactive() {
        return dialog && dialog.open && dialog.classList.contains('tutorial-interactive');
    }

    function guardInteraction(event) {
        if (!interactive()) return;
        if (event.type === 'keydown') {
            if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); exit(); return; }
            if ((event.ctrlKey || event.metaKey) && ['s', 'enter'].includes(event.key.toLowerCase())) {
                event.preventDefault(); event.stopImmediatePropagation(); return;
            }
            if (event.key === 'Tab') {
                const focusable = 'button,input,textarea,select,[tabindex="0"]';
                const controls = [...allowedRoots().flatMap(root => [root, ...root.querySelectorAll(focusable)]),
                    ...panel.querySelectorAll(focusable)].filter(element => element.matches(focusable) &&
                        usable(element) && element.getClientRects().length);
                const unique = [...new Set(controls)];
                if (unique.length) {
                    const current = unique.indexOf(document.activeElement);
                    const next = (current + (event.shiftKey ? -1 : 1) + unique.length) % unique.length;
                    event.preventDefault(); event.stopImmediatePropagation(); unique[next].focus();
                }
                return;
            }
        }
        if (panel.contains(event.target)) return;
        const allowed = allowedRoots().some(root => root.contains(event.target));
        if (allowed && event.type === 'keydown' && ['ArrowDown', 'ArrowUp'].includes(event.key) &&
            event.target.matches('.custom-select-trigger')) {
            const select = event.target.closest('.custom-select').nextElementSibling;
            if (select && select.tagName === 'SELECT') {
                event.preventDefault(); event.stopImmediatePropagation();
                select.selectedIndex = Math.max(0, Math.min(select.options.length - 1,
                    select.selectedIndex + (event.key === 'ArrowDown' ? 1 : -1)));
                select.dispatchEvent(new Event('change'));
            }
            return;
        }
        if (!allowed) {
            event.preventDefault(); event.stopImmediatePropagation();
            if (event.type === 'focusin') panel.querySelector('button').focus({ preventScroll: true });
        } else if (event.type === 'keydown' && ['Enter', ' '].includes(event.key) &&
            event.target.matches('.gui-slot.filled,.custom-select-trigger,.custom-select-option')) {
            event.preventDefault(); event.stopImmediatePropagation(); event.target.click();
        }
    }

    function enableTaskControls() {
        for (const root of allowedRoots()) {
            const controls = [root, ...root.querySelectorAll('.gui-slot.filled,.custom-select-trigger,.custom-select-option')];
            for (const element of controls) {
                if (!element.matches('.gui-slot.filled,.custom-select-trigger,.custom-select-option')) continue;
                if (!addedTabStops.has(element)) addedTabStops.set(element, element.getAttribute('tabindex'));
                element.tabIndex = 0;
            }
        }
    }

    function monitorTask() {
        if (!activeTask || !interactive()) return;
        const step = steps[index];
        if (currentModalData) ownedItemModal = currentModalData;
        enableTaskControls();
        const previouslyCompleted = completedTasks.has(step);
        const done = previouslyCompleted || activeTask.done();
        if (done) completedTasks.add(step);
        nextButton.disabled = !done;
        const message = done ? 'Task complete.' : 'Try it in the highlighted control to continue.';
        if (taskStatus.textContent !== message) taskStatus.textContent = message;
        if (done && !previouslyCompleted) {
            advanceTimer = setTimeout(() => {
                advanceTimer = null;
                if (interactive() && steps[index] === step && activeTask) nextButton.click();
            }, 300);
        }
        const selector = activeTask.target && activeTask.target();
        const candidate = selector && document.querySelector(selector);
        if (candidate && usable(candidate) && candidate !== target) {
            target = candidate;
            pointerInPanel = false;
            target.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
            schedulePosition();
        }
    }

    function clearTask() {
        clearTimeout(advanceTimer);
        advanceTimer = null;
        activeTask = null;
        for (const [element, tabindex] of addedTabStops) {
            if (tabindex === null) element.removeAttribute('tabindex');
            else element.setAttribute('tabindex', tabindex);
        }
        addedTabStops.clear();
    }

    function setInteractive(enabled) {
        if (enabled === dialog.classList.contains('tutorial-interactive')) return;
        dialog.close();
        dialog.classList.toggle('tutorial-interactive', enabled);
        document.body.classList.toggle('tutorial-interacting', enabled);
        if (enabled) dialog.show(); else dialog.showModal();
    }

    function closeItemInspection() {
        if (ownedItemModal && currentModalData === ownedItemModal) closeEditModal(true);
        ownedItemModal = null;
    }

    function prepareItemInspection() {
        if (ownedItemModal && currentModalData === ownedItemModal) return true;
        // Never replace another edit dialog or create a sample item in an empty shop.
        if (currentModalData || !Array.isArray(items) || !items.length) return false;
        const perPage = (currentShopSettings.rows || 3) * 9;
        const item = items.find(entry => entry.slot >= currentPreviewPage * perPage &&
            entry.slot < (currentPreviewPage + 1) * perPage) || items[0];
        openShopItemModal(item.id);
        ownedItemModal = currentModalData;
        return !!ownedItemModal;
    }

    function usable(element, navigation = false) {
        if (!element || element.disabled || element.getAttribute('aria-disabled') === 'true') return false;
        for (let node = element; node && node !== document.body; node = node.parentElement) {
            if (node.hidden || node.getAttribute('aria-hidden') === 'true') return false;
            const style = getComputedStyle(node);
            // A closed mobile navigation drawer does not revoke feature access.
            const closedDrawer = navigation && node.closest('#editor-sidebar') &&
                getComputedStyle(document.getElementById('editor-sidebar')).visibility === 'hidden';
            if (style.display === 'none' || (style.visibility === 'hidden' && !closedDrawer)) return false;
        }
        return true;
    }

    function available(section) {
        if (section.tab && global.EditorPermissions && !EditorPermissions.tabAllowed(section.tab)) return false;
        return !section.tab || (usable(document.querySelector(`.sidebar-tabs [data-tab="${section.tab}"]`), true) &&
            !!document.getElementById(`${section.tab}-tab`));
    }

    function remember(result) {
        if (!result) storageAvailable = false;
    }

    function button(label, icon, action, className = '') {
        const element = document.createElement('button');
        element.type = 'button';
        element.className = `tutorial-button ${className}`;
        const glyph = document.createElement('i');
        glyph.className = `fa-solid fa-${icon}`;
        glyph.setAttribute('aria-hidden', 'true');
        element.append(glyph, document.createTextNode(label));
        element.addEventListener('click', action);
        return element;
    }

    function text(tag, value, className) {
        const element = document.createElement(tag);
        element.textContent = value;
        if (className) element.className = className;
        return element;
    }

    function automaticPreference() {
        const label = document.createElement('label');
        label.className = 'tutorial-preference';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = progress.snapshot().autoNewFeatures;
        input.addEventListener('change', () => remember(progress.setAutomatic(input.checked)));
        label.append(input, document.createTextNode('Automatically show new-feature tutorials'));
        return label;
    }

    function createDialog() {
        dialog = document.createElement('dialog');
        dialog.id = 'editor-tutorial';
        dialog.setAttribute('aria-labelledby', 'tutorial-title');
        dialog.setAttribute('aria-describedby', 'tutorial-description');
        spotlight = document.createElement('div');
        spotlight.className = 'tutorial-spotlight';
        spotlight.setAttribute('aria-hidden', 'true');
        panel = document.createElement('div');
        panel.className = 'tutorial-panel';
        panel.addEventListener('pointerenter', () => { pointerInPanel = true; });
        panel.addEventListener('pointerleave', () => { pointerInPanel = false; schedulePosition(); });
        dialog.append(spotlight, panel);
        dialog.addEventListener('cancel', event => { event.preventDefault(); exit(); });
        dialog.addEventListener('keydown', event => {
            // Do not let the editor's save/publish shortcuts run through the tour.
            event.stopPropagation();
            if (event.ctrlKey || event.metaKey) {
                if (['s', 'enter'].includes(event.key.toLowerCase())) event.preventDefault();
            }
        });
        document.body.append(dialog);
        for (const type of ['pointerdown', 'mousedown', 'click', 'dblclick', 'contextmenu', 'dragstart', 'drop', 'keydown', 'focusin']) {
            document.addEventListener(type, guardInteraction, true);
        }
        new ResizeObserver(schedulePosition).observe(panel);
        global.addEventListener('resize', () => { pointerInPanel = false; schedulePosition(); });
        document.addEventListener('scroll', event => {
            if (!panel.contains(event.target)) schedulePosition();
        }, true);
    }

    function open() {
        if (!dialog) createDialog();
        if (!dialog.open) {
            previousFocus = document.activeElement;
            document.body.classList.add('tutorial-open');
            originalTab = getEditorState('currentTab');
            if (typeof closeEditorNavigation === 'function') closeEditorNavigation();
            const pending = getEditorState('autoSaveTimeout');
            resumeAutoSave = !!pending;
            if (pending) clearTimeout(pending);
            setEditorState('autoSaveTimeout', null);
            dialog.showModal();
            monitor = setInterval(monitorTask, 80);
        }
    }

    function copyFallback(value) {
        const previous = document.activeElement;
        const input = document.createElement('textarea');
        input.value = value;
        input.className = 'tutorial-copy-source';
        input.setAttribute('aria-label', 'Value to copy');
        panel.append(input);
        input.focus({ preventScroll: true });
        input.select();
        try { return document.execCommand('copy'); }
        finally {
            input.remove();
            if (previous && previous.isConnected) previous.focus({ preventScroll: true });
        }
    }

    function heading(title, description, value) {
        panel.replaceChildren();
        panel.scrollTop = 0;
        const header = document.createElement('div');
        header.className = 'tutorial-heading';
        const titleElement = text('h2', title);
        titleElement.id = 'tutorial-title';
        const close = button('', 'xmark', exit, 'tutorial-icon');
        close.title = 'Exit tutorial';
        close.setAttribute('aria-label', 'Exit tutorial');
        header.append(titleElement, close);
        const detail = text('p', description);
        detail.id = 'tutorial-description';
        panel.append(header, detail);
        if (value && description.includes(value)) {
            const start = description.indexOf(value);
            const marked = document.createElement('mark');
            marked.className = 'tutorial-required-value';
            marked.append(text('code', value));
            const feedback = text('span', '', 'tutorial-copy-status');
            feedback.setAttribute('role', 'status');
            feedback.setAttribute('aria-live', 'polite');
            const copy = button('', 'copy', async () => {
                copy.disabled = true;
                let copied = false;
                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(value);
                        copied = true;
                    }
                } catch (_) { /* Older or restricted browsers use the selection fallback. */ }
                if (copy.isConnected && !copied) {
                    try { copied = copyFallback(value); } catch (_) { /* Report failure below. */ }
                }
                if (!copy.isConnected) return;
                copy.disabled = false;
                copy.querySelector('i').className = `fa-solid fa-${copied ? 'check' : 'copy'}`;
                feedback.textContent = copied ? 'Copied' : 'Could not copy. Select the highlighted value to copy it manually.';
            }, 'tutorial-copy');
            copy.title = `Copy ${value}`;
            copy.setAttribute('aria-label', `Copy ${value}`);
            detail.replaceChildren(document.createTextNode(description.slice(0, start)), marked, copy,
                document.createTextNode(description.slice(start + value.length)));
            panel.append(feedback);
        }
    }

    function library() {
        if (!progress) return;
        clearTask();
        closeItemInspection();
        mode = 'library';
        target = null;
        queue = [];
        open();
        setInteractive(false);
        heading('Tutorial', 'Choose a section or replay the full walkthrough.');
        panel.append(button('Replay full walkthrough', 'play', () => start(sections.filter(available)), 'tutorial-primary'));
        const list = document.createElement('div');
        list.className = 'tutorial-sections';
        for (const section of sections.filter(available)) {
            const status = progress.snapshot().sections[section.id];
            const row = button(section.title, 'arrow-right', () => start([section]), 'tutorial-section');
            const label = status && status.revision >= section.revision ? status.status : 'new';
            row.append(text('span', label, 'tutorial-status'));
            list.append(row);
        }
        panel.append(list, automaticPreference());
        if (!storageAvailable) panel.append(text('p', 'Browser storage is unavailable. Progress may not survive a reload.', 'tutorial-notice'));
        schedulePosition();
        panel.querySelector('button').focus();
    }

    function start(selected, automatic = false) {
        queue = selected.filter(available);
        if (!queue.length) return library();
        steps = queue.flatMap(section => section.steps
            .filter(step => step.task !== 'item-commands' || !global.EditorPermissions || EditorPermissions.can('commands'))
            .map(step => ({ ...step, section })));
        taskInstances = new Map(); completedTasks = new Set();
        index = 0;
        mode = 'tour';
        open();
        // Record a first-run decision immediately, so leaving the page cannot restart it.
        if (progress.firstRun()) {
            remember(progress.handleFirstRun());
            queue.forEach(section => remember(progress.mark(section, 'dismissed')));
        }
        showStep(automatic);
    }

    function showStep(automatic = false) {
        pointerInPanel = false;
        clearTask();
        target = null;
        while (index < steps.length) {
            const step = steps[index];
            const startingPractice = step.task && !global.EditorTutorialPractice.isActive();
            if (!step.task) setInteractive(false);
            if ((!step.itemEditor && !step.modal) || !available(step.section)) closeItemInspection();
            if (!available(step.section)) { index++; continue; }
            if (step.task && !global.EditorTutorialPractice.begin()) {
                setInteractive(false);
                heading('Practice is waiting', 'Wait for the current save to finish, or exit this tutorial and close your open edit dialog before starting practice.');
                panel.append(button('Retry', 'rotate-right', () => showStep()));
                position();
                return;
            }
            if (step.section.tab && (startingPractice || getEditorState('currentTab') !== step.section.tab)) {
                switchTab(step.section.tab);
            }
            if (step.itemEditor && !prepareItemInspection()) { index++; continue; }
            const selectors = Array.isArray(step.target) ? step.target : [step.target];
            const candidate = selectors.map(selector => document.querySelector(selector))
                .find(element => usable(element) && element.getClientRects().length);
            if (usable(candidate) && candidate.getClientRects().length) {
                target = candidate;
                break;
            }
            index++;
        }
        if (index >= steps.length) return finish();
        const step = steps[index];
        if (step.task) {
            if (!taskInstances.has(step)) taskInstances.set(step, global.EditorTutorialPractice.task(step.task));
            activeTask = taskInstances.get(step);
        }
        setInteractive(!!activeTask);
        dialog.dataset.task = step.task || '';
        dialog.dataset.step = String(index);
        heading(step.title, step.text, requiredValues[step.task]);
        panel.prepend(text('div', `${global.EditorTutorialPractice.isActive() ? 'Practice / ' : ''}${step.section.title} / ${index + 1} of ${steps.length}`, 'tutorial-progress'));
        if (activeTask) {
            taskStatus = text('p', '', 'tutorial-task-status');
            taskStatus.setAttribute('role', 'status');
            taskStatus.setAttribute('aria-live', 'polite');
            panel.append(taskStatus);
        }
        const actions = document.createElement('div');
        actions.className = 'tutorial-actions';
        const back = button('Back', 'arrow-left', () => { index = Math.max(0, index - 1); showStep(); });
        back.disabled = index === 0;
        const next = button(index === steps.length - 1 ? 'Finish' : 'Next', 'arrow-right', () => {
            if (activeTask && !completedTasks.has(step)) return;
            if (!steps[index + 1] || steps[index + 1].section !== step.section) remember(progress.mark(step.section, 'completed'));
            index++;
            showStep();
        }, 'tutorial-primary');
        nextButton = next;
        if (activeTask) next.disabled = true;
        actions.append(back, next);
        const skip = button('Skip section', 'forward-step', () => {
            remember(progress.mark(step.section, 'dismissed'));
            while (index < steps.length && steps[index].section === step.section) index++;
            showStep();
        });
        panel.append(actions, skip);
        if (automatic || index === 0) panel.append(automaticPreference());
        if (!storageAvailable) panel.append(text('p', 'Browser storage is unavailable. Progress may not survive a reload.', 'tutorial-notice'));
        target.scrollIntoView({ block: step.itemEditor ? 'start' : 'center', inline: 'nearest', behavior: 'instant' });
        monitorTask();
        position();
        if (activeTask) panel.querySelector('button').focus({ preventScroll: true });
        else next.focus({ preventScroll: true });
    }

    function finish() {
        exit();
    }

    function exit() {
        if (!dialog || !dialog.open) return;
        const practiced = global.EditorTutorialPractice.isActive();
        if (mode === 'tour') queue.forEach(section => remember(progress.mark(section, 'dismissed')));
        clearTask();
        clearInterval(monitor);
        closeItemInspection();
        global.EditorTutorialPractice.end();
        dialog.close();
        dialog.classList.remove('tutorial-interactive');
        document.body.classList.remove('tutorial-open');
        document.body.classList.remove('tutorial-interacting');
        target = null;
        if (originalTab && usable(document.querySelector(`.sidebar-tabs [data-tab="${originalTab}"]`), true)) switchTab(originalTab);
        if (previousFocus && previousFocus.isConnected && usable(previousFocus)) previousFocus.focus({ preventScroll: true });
        else document.getElementById('editor-tutorial-help').focus({ preventScroll: true });
        if (practiced) showToast('Practice ended. Your original drafts have been restored.', 'info');
        if (resumeAutoSave) { resumeAutoSave = false; scheduleEditorAutoSave(); }
    }

    function schedulePosition() {
        if (!dialog || !dialog.open || frame) return;
        frame = requestAnimationFrame(() => { frame = null; position(); });
    }

    function position() {
        if (!dialog.open || pointerInPanel) return;
        const width = document.documentElement.clientWidth;
        const height = global.innerHeight;
        const margin = 12;
        let rect = target && usable(target) ? target.getBoundingClientRect() : null;
        if (rect && (rect.bottom <= 0 || rect.right <= 0 || rect.top >= height || rect.left >= width)) rect = null;
        spotlight.hidden = !rect;
        const panelScroll = panel.scrollTop;
        panel.style.maxHeight = '';
        let box = panel.getBoundingClientRect();
        if (activeTask && rect) {
            const above = rect.top - margin * 2;
            const below = height - rect.bottom - margin * 2;
            const horizontalSpace = Math.max(rect.left, width - rect.right) - margin * 2;
            if (Math.max(above, below) < box.height && horizontalSpace < box.width) {
                // Keep the actual task control clickable on short or narrow screens.
                panel.style.maxHeight = `${Math.max(100, Math.max(above, below))}px`;
                box = panel.getBoundingClientRect();
            }
        }
        let left = (width - box.width) / 2;
        let top = (height - box.height) / 2;
        if (rect) {
            Object.assign(spotlight.style, {
                left: `${Math.max(0, rect.left - 4)}px`, top: `${Math.max(0, rect.top - 4)}px`,
                width: `${Math.min(width, rect.right + 4) - Math.max(0, rect.left - 4)}px`,
                height: `${Math.min(height, rect.bottom + 4) - Math.max(0, rect.top - 4)}px`
            });
            if (height - rect.bottom >= box.height + margin * 2) top = rect.bottom + margin;
            else if (rect.top >= box.height + margin * 2) top = rect.top - box.height - margin;
            else if (width - rect.right >= box.width + margin * 2) left = rect.right + margin;
            else if (rect.left >= box.width + margin * 2) left = rect.left - box.width - margin;
            else spotlight.hidden = true;
        }
        panel.style.left = `${Math.max(margin, Math.min(left, width - box.width - margin))}px`;
        panel.style.top = `${Math.max(margin, Math.min(top, height - box.height - margin))}px`;
        panel.scrollTop = panelScroll;
        dialog.classList.toggle('tutorial-has-target', !spotlight.hidden);
    }

    function ready() {
        if (initialized || !username || getEditorState('isLoadingFiles')) return;
        initialized = true;
        let storage;
        try { storage = global.localStorage; } catch (_) { storageAvailable = false; }
        progress = global.EditorTutorialState.createProgress(storage, username);
        const help = document.getElementById('editor-tutorial-help');
        help.disabled = false;
        help.addEventListener('click', library);
        const pending = progress.pending(sections.filter(available));
        if (pending.length) start(pending, true);
    }

    global.EditorTutorial = { ready, open: library, isActive: () => !!(dialog && dialog.open) };
})(window);
