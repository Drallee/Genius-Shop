(function(global) {
    'use strict';

    const loaded = new Map();
    const conflicts = new Map();
    const generations = new Map();
    let epoch = 0;
    const payloads = { mainMenu: 'menus/main-menu.yml', purchaseMenu: 'menus/purchase-menu.yml',
        sellMenu: 'menus/sell-menu.yml', guiSettings: 'menus/gui-settings.yml', campaignsFile: 'campaigns.yml',
        commandsFile: 'commands.yml', customItemsFile: 'custom-items.yml', discord: 'discord.yml' };
    let dialog, body, active, status, mergedInput, saveMergedButton;
    let busy = false;

    function seed(data) {
        epoch++;
        generations.clear();
        loaded.clear();
        conflicts.clear();
        for (const [file, revision] of Object.entries(data.revisions || {})) loaded.set(file, { revision, content: null });
        for (const [key, file] of Object.entries(payloads)) if (loaded.has(file)) loaded.get(file).content = data[key] ?? null;
        for (const [file, content] of Object.entries(data.shops || {})) if (loaded.has('shops/' + file)) loaded.get('shops/' + file).content = content;
        if (loaded.has('config.yml')) loaded.get('config.yml').content = JSON.stringify(normalizeEconomySafetySettings(data.economySafety), null, 2);
        updateNotice();
    }

    function updateNotice() {
        const notice = document.getElementById('save-conflict-notice');
        if (notice) { notice.hidden = conflicts.size === 0; notice.setAttribute('aria-label', `Resolve ${conflicts.size} save conflict(s)`); }
    }

    function fileUrl(file) { return 'api/file/' + file.split('/').map(encodeURIComponent).join('/'); }
    function fileFor(url) {
        const path = new URL(url, location.href).pathname;
        const offset = path.indexOf('/api/file/');
        return offset >= 0 ? decodeURIComponent(path.slice(offset + 10)) : path.endsWith('/api/economy-safety') ? 'config.yml' : null;
    }

    function conflictError() {
        const error = new Error('Save conflict. Your local edits are preserved; resolve the conflict before saving.');
        error.isSaveConflict = true;
        return error;
    }

    async function request(url, options, file = fileFor(url), localOverride) {
        if (!file) throw new Error('Cannot determine which file this action changes.');
        const generation = invalidate(file);
        const requestEpoch = epoch;
        const base = loaded.get(file) || { content: null, revision: 'missing' };
        const economy = new URL(url, location.href).pathname.endsWith('/api/economy-safety');
        const input = options.body ? JSON.parse(options.body) : {};
        const local = localOverride !== undefined ? localOverride : options.method === 'DELETE' ? null :
            economy ? JSON.stringify(normalizeEconomySafetySettings(input.settings), null, 2) : input.content;
        const response = await fetch(url, { ...options, headers: { 'X-Session-Token': sessionToken,
            ...options.headers, 'X-File-Revision': base.revision } });
        const data = await response.clone().json().catch(() => ({}));
        const current = requestEpoch === epoch && generations.get(file) === generation;
        if (response.status === 409) {
            if (!current) throw conflictError();
            const conflict = { file, economy, base: file === 'config.yml' && !economy ? null : base.content,
                local, latest: { content: data.content ?? null, revision: data.revision } };
            conflict.editorSnapshot = local == null || (file === 'config.yml' && !economy) ? null : localSource(file, local);
            conflicts.set(file, conflict);
            pauseAutosave();
            updateNotice();
            if (!dialog || !dialog.open || active.file === file) show(conflict);
            throw conflictError();
        }
        if (response.status === 403 && global.EditorPermissions) await global.EditorPermissions.recheck();
        if (!response.ok) throw new Error(data.message || data.error || `Save failed (${response.status})`);
        if (!data.revision) throw new Error('The server did not return a file revision. Reload before saving again.');
        if (current) {
            loaded.set(file, { revision: data.revision, content: file === 'config.yml' ? (data.economySafety ?
                JSON.stringify(normalizeEconomySafetySettings(data.economySafety), null, 2) : base.content) : local });
            conflicts.delete(file);
        }
        updateNotice();
        return response;
    }

    function pauseAutosave() {
        const timer = getEditorState('autoSaveTimeout');
        if (timer) clearTimeout(timer);
        setEditorState('autoSaveTimeout', null);
    }

    function invalidate(file) {
        const generation = (generations.get(file) || 0) + 1;
        generations.set(file, generation);
        return generation;
    }

    function element(tag, text, className) {
        const node = document.createElement(tag);
        if (text != null) node.textContent = text;
        if (className) node.className = className;
        return node;
    }

    function button(label, icon, action, className = '') {
        const node = element('button', null, `btn-base btn-secondary ${className}`);
        node.type = 'button';
        const glyph = element('i', null, `fa-solid fa-${icon}`);
        glyph.setAttribute('aria-hidden', 'true');
        node.append(glyph, document.createTextNode(label));
        node.addEventListener('click', action);
        return node;
    }

    function create() {
        dialog = element('dialog', null, 'save-conflict');
        dialog.id = 'save-conflict';
        dialog.setAttribute('aria-labelledby', 'save-conflict-title');
        dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
        dialog.addEventListener('keydown', event => {
            event.stopPropagation();
            if ((event.ctrlKey || event.metaKey) && ['s', 'enter'].includes(event.key.toLowerCase())) event.preventDefault();
        });
        document.body.append(dialog);
    }

    function close() {
        if (busy) return;
        if (mergedInput) { active.local = mergedInput.value; active.reconciled = true; }
        dialog.close();
    }

    function localSource(file, fallback) {
        if (fallback == null) return fallback;
        if (file.startsWith('shops/')) return file.slice(6) === currentShopFile ? EditorYaml.writeShop() : allShops[file.slice(6)] ?? fallback;
        if (file === 'menus/main-menu.yml') return EditorYaml.writeMain();
        if (file === 'menus/purchase-menu.yml') return EditorYaml.writeTransaction('purchase');
        if (file === 'menus/sell-menu.yml') return EditorYaml.writeTransaction('sell');
        if (file === 'menus/gui-settings.yml') return generateGuiSettingsYaml();
        if (file === 'campaigns.yml') return generateCampaignsFileYaml();
        if (file === 'commands.yml') return generateCommandsYaml();
        if (file === 'custom-items.yml') return customItemsFileRaw;
        if (file === 'config.yml') return JSON.stringify(normalizeEconomySafetySettings(economySafetySettings), null, 2);
        return fallback;
    }

    function pendingChanges() {
        const editable = new Set(['menus/main-menu.yml', 'menus/purchase-menu.yml', 'menus/sell-menu.yml',
            'menus/gui-settings.yml', 'campaigns.yml', 'commands.yml', 'custom-items.yml', 'config.yml']);
        const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
            ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
        const result = [];
        for (const [file, snapshot] of loaded) {
            if (!editable.has(file) && !file.startsWith('shops/')) continue;
            if (global.EditorPermissions && !EditorPermissions.canWriteFile(file)) continue;
            const before = snapshot.content;
            const after = localSource(file, before ?? '');
            if (before === after) continue;
            if (before != null && after != null && JSON.stringify(canonical(EditorYaml.parse(before))) === JSON.stringify(canonical(EditorYaml.parse(after)))) continue;
            result.push({ file, before, after, action: before == null ? 'created' : after == null ? 'deleted' : 'updated' });
        }
        return result;
    }

    function open() {
        const conflict = conflicts.values().next().value;
        if (!conflict) return;
        if (!conflict.reconciled && conflict.editorSnapshot != null) {
            const current = localSource(conflict.file, conflict.local);
            if (current !== conflict.editorSnapshot) conflict.local = current;
        }
        show(conflict);
    }

    function show(conflict) {
        if (!dialog) create();
        active = conflict;
        mergedInput = null;
        dialog.replaceChildren();
        const header = element('header');
        const title = element('h2', 'Save conflict');
        title.id = 'save-conflict-title';
        const dismiss = button('', 'xmark', close, 'conflict-close');
        dismiss.title = 'Keep local edits and close';
        dismiss.setAttribute('aria-label', 'Keep local edits and close');
        header.append(title, dismiss);
        body = element('div', null, 'conflict-body');
        body.append(element('code', conflict.file, 'conflict-filename'));
        status = element('p', 'Not saved. Your local edits are preserved; autosave is paused.', 'conflict-status');
        status.setAttribute('role', 'status');
        body.append(status);
        const comparison = element('div', null, 'conflict-comparison');
        const sources = [conflict.base, conflict.latest.content, conflict.local];
        let fullFiles = false;
        const renderComparison = () => {
            comparison.replaceChildren();
            const visible = fullFiles ? sources : EditorChangeView.conflictSources(sources, conflict.economy);
            const highlights = EditorChangeView.changedLines(visible);
            ['Originally loaded', 'Latest on server', 'Your changes'].forEach((title, index) => {
                const column = element('section', null, `conflict-version conflict-version-${index}`);
                const pre = element('pre');
                if (visible[index] == null) pre.textContent = index === 0 && conflict.file === 'config.yml' && !conflict.economy
                    ? '(full file was not loaded)' : '(file absent / deletion)';
                else visible[index].split(/\r?\n/).forEach((line, lineIndex, lines) => {
                    const text = line + (lineIndex < lines.length - 1 ? '\n' : '');
                    pre.append(element('span', text, highlights[index].has(lineIndex) ? 'conflict-line-changed' : 'conflict-line-context'));
                });
                column.append(element('h3', title), pre);
                comparison.append(column);
            });
        };
        const controls = element('div', null, 'conflict-view-controls');
        const description = element('span', 'Changed fields are highlighted. Unchanged settings are hidden.');
        const toggle = button('Show full files', 'expand', () => {
            fullFiles = !fullFiles;
            toggle.textContent = fullFiles ? 'Show differences only' : 'Show full files';
            description.textContent = fullFiles ? 'Full files shown; changed lines remain highlighted.' : 'Changed fields are highlighted. Unchanged settings are hidden.';
            renderComparison();
        });
        controls.append(description, toggle);
        body.append(controls, comparison, element('p', 'Downloads and reconciliation always use complete files.', 'conflict-view-note'));
        renderComparison();
        const footer = element('footer');
        saveMergedButton = button('Save reconciled', 'floppy-disk', saveMerged, 'btn-success');
        saveMergedButton.hidden = true;
        footer.append(button('Download local', 'download', download), button('Keep editing', 'pencil', close),
            button('Reload latest', 'rotate', reload), button('Reconcile', 'code-compare', reconcile), saveMergedButton);
        dialog.append(header, body, footer);
        if (!dialog.open) dialog.showModal();
        dialog.querySelector('button').focus();
    }

    function reconcile() {
        if (mergedInput) return mergedInput.focus();
        const label = element('label', active.economy ? 'Reconciled economy settings (JSON)' : 'Reconciled file (YAML)');
        label.htmlFor = 'conflict-merged';
        mergedInput = element('textarea', null, 'conflict-merged');
        mergedInput.id = label.htmlFor;
        mergedInput.value = active.local ?? active.latest.content ?? '';
        mergedInput.spellcheck = false;
        mergedInput.addEventListener('input', () => { active.local = mergedInput.value; active.reconciled = true; });
        body.append(label, mergedInput);
        saveMergedButton.hidden = false;
        mergedInput.focus();
    }

    function setBusy(value) {
        busy = value;
        dialog.querySelectorAll('button,textarea').forEach(control => { control.disabled = value; });
    }

    function finishResolution() {
        updateNotice();
        setBusy(false);
        dialog.close();
        if (!conflicts.size && unsavedChanges.length && typeof scheduleEditorAutoSave === 'function') scheduleEditorAutoSave();
    }

    async function latest(file, economy = file === 'config.yml') {
        const response = await fetch(economy ? 'api/economy-safety' : fileUrl(file), {
            headers: { 'X-Session-Token': sessionToken }, cache: 'no-store'
        });
        if (response.status === 404) return { revision: 'missing', content: null };
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || data.error || 'Could not load latest file');
        if (data.draft && global.EditorDrafts) global.EditorDrafts.setState(data.draft);
        if (!data.revision) throw new Error('Missing file revision. Reload the editor before saving.');
        return { revision: data.revision, content: economy ? JSON.stringify(normalizeEconomySafetySettings(data), null, 2) : data.content };
    }

    async function reload() {
        if (busy || !global.confirm(`Replace local edits to ${active.file} with the latest server version? Other files will be kept.`)) return;
        invalidate(active.file);
        setBusy(true);
        try {
            const snapshot = await latest(active.file, active.economy);
            await apply(active.file, snapshot.content, active.economy);
            loaded.set(active.file, { ...snapshot, content: active.file === 'config.yml' ?
                JSON.stringify(normalizeEconomySafetySettings(economySafetySettings), null, 2) : snapshot.content });
            conflicts.delete(active.file);
            finishResolution();
        } catch (error) { status.textContent = error.message; setBusy(false); }
    }

    async function saveMerged() {
        if (busy || !mergedInput) return;
        const content = mergedInput.value;
        const file = active.file;
        invalidate(file);
        setBusy(true);
        try {
            const payload = active.economy ? { settings: JSON.parse(content) } : { content };
            if (!active.economy) EditorYaml.parse(content);
            const response = await fetch(active.economy ? 'api/economy-safety' : fileUrl(file), {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Session-Token': sessionToken,
                    'X-File-Revision': active.latest.revision }, body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (response.status === 409) {
                active.local = content;
                active.reconciled = true;
                active.latest = { content: data.content ?? null, revision: data.revision };
                setBusy(false);
                show(active);
                reconcile();
                status.textContent = 'The server file changed again. Your reconciled text is preserved; review the latest version.';
                return;
            }
            if (response.status === 403 && global.EditorPermissions) await global.EditorPermissions.recheck();
            if (!response.ok) throw new Error(data.message || data.error || 'Could not save reconciled file');
            if (data.draft && global.EditorDrafts) global.EditorDrafts.setState(data.draft);
            if (!data.revision) throw new Error('Missing file revision. Reload before saving again.');
            const saved = active.economy ? JSON.stringify(normalizeEconomySafetySettings(data.economySafety), null, 2) : content;
            await apply(file, saved, active.economy);
            loaded.set(file, { content: file === 'config.yml' ? JSON.stringify(normalizeEconomySafetySettings(economySafetySettings), null, 2) : saved, revision: data.revision });
            conflicts.delete(file);
            finishResolution();
            showToast('Reconciled file saved', 'success');
        } catch (error) { status.textContent = error.message; setBusy(false); }
    }

    function download() {
        const source = mergedInput ? mergedInput.value : active.local;
        const url = URL.createObjectURL(new Blob([source ?? ''], { type: 'text/plain' }));
        const link = element('a');
        link.href = url;
        link.download = active.file.replace(/\//g, '-') + '.local.' + (active.economy ? 'json' : 'yml');
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function apply(file, content, economy = file === 'config.yml') {
        if (file.startsWith('shops/')) {
            const name = file.slice(6);
            if (content == null) delete allShops[name]; else allShops[name] = content;
            const selector = document.getElementById('shop-file-selector');
            if (selector) {
                selector.replaceChildren();
                Object.keys(allShops).sort().forEach(name => { const option = element('option', name); option.value = name; selector.append(option); });
            }
            if (name === currentShopFile) {
                if (content == null) currentShopFile = Object.keys(allShops)[0] || '';
                if (currentShopFile) loadShopFromData(currentShopFile);
                else { parseShopYaml('rows: 3\nitems: []\n'); renderItems(); updateAll(); }
            }
            if (selector) { selector.value = currentShopFile; selector.dispatchEvent(new Event('refresh')); }
            campaignHubDirtyShopFiles.delete(name);
        } else if (file === 'menus/main-menu.yml') { parseMainMenuYaml(content || 'items: {}\n'); renderMainMenuShops(); if (currentTab === 'mainmenu') updateGuiPreview(); }
        else if (file === 'menus/purchase-menu.yml') { parsePurchaseMenuYaml(content || ''); renderPurchaseButtons(); if (currentTab === 'purchase') updatePurchasePreview(); }
        else if (file === 'menus/sell-menu.yml') { parseSellMenuYaml(content || ''); renderSellButtons(); if (currentTab === 'sell') updateSellPreview(); }
        else if (file === 'menus/gui-settings.yml') { parseGuiSettingsYaml(content || ''); if (currentTab === 'guisettings') renderGuiSettings(); }
        else if (file === 'campaigns.yml') { parseCampaignsFileYaml(content || 'campaigns: []\n'); renderCampaignsTab(); }
        else if (file === 'commands.yml') { commandsFileRaw = content || 'commands: {}\n'; parseCommandsYaml(commandsFileRaw); renderCommandsTab(); }
        else if (file === 'custom-items.yml') { parseCustomItemsYaml(content || 'items: {}\n'); renderCustomItemsTab(); }
        else if (file === 'config.yml') {
            if (!economy) { parsePriceFormatConfig(content || ''); content = (await latest(file, true)).content; }
            economySafetySettings = normalizeEconomySafetySettings(JSON.parse(content));
            if (currentTab === 'guisettings') renderGuiSettings();
        }
        const targets = { 'menus/main-menu.yml': ['main-menu-button', 'main-menu-settings'], 'menus/purchase-menu.yml': ['purchase-menu-button', 'purchase-menu-settings'],
            'menus/sell-menu.yml': ['sell-menu-button', 'sell-menu-settings'], 'menus/gui-settings.yml': ['gui-settings'], 'campaigns.yml': ['campaign-settings'],
            'commands.yml': ['custom-command'], 'custom-items.yml': ['custom-item'], 'config.yml': ['config-settings'] };
        setUnsavedChanges(unsavedChanges.filter(change => file.startsWith('shops/') ?
            !(['shop-item', 'shop-settings'].includes(change.target) && (!change.details || change.details.shopFile === file.slice(6))) :
            !(targets[file] || []).includes(change.target)));
        updateExport();
    }

    function requireResolved() {
        if (conflicts.size) { open(); throw conflictError(); }
    }

    global.EditorRevisions = { seed, request, open, latest, apply, requireResolved, pendingChanges, hasPending: () => conflicts.size > 0 };
})(window);
