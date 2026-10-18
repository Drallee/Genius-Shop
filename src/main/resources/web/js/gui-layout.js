window.GuiLayout = (() => {
    const controls = ['searchButton', 'favoritesButton', 'recentButton', 'prevButton', 'backButton', 'nextButton'];
    const labels = ['Search', 'Favorites', 'Recent items', 'Previous page', 'Back', 'Next page'];
    const copy = value => JSON.parse(JSON.stringify(value));
    let scope = '';
    let paintMode = 'inspect';
    let selectedButton = 'searchButton';
    let model = guiSettings;
    function effective(override = currentShopSettings.layout) {
        const merged = copy(guiSettings);
        if (!override) return merged;
        merged.layout = { ...merged.layout, ...copy(override), filler: { ...merged.layout.filler, ...override.filler }, emptyItem: { ...merged.layout.emptyItem, ...override.emptyItem } };
        for (const key of controls) merged[key] = { ...merged[key], ...override.buttons?.[key] };
        return merged;
    }
    function current() { return resolve(effective(), currentShopSettings.rows || 3); }
    function rowsOverridden() { return Number(effective().layout.rows) > 0; }
    function updateRowsControl() {
        const overridden = rowsOverridden();
        const rows = document.getElementById('shop-rows-control');
        const button = document.getElementById('shop-layout-override');
        if (rows) rows.hidden = overridden;
        if (button) {
            button.hidden = !overridden;
            button.title = 'Inventory rows are overridden by GUI Settings (' + current().rows + ' rows).';
        }
    }
    const discoveryModes = { search: 'Search results', favorites: 'Favorite items', recent: 'Recent items' };
    function discoveryMode() { return scope.startsWith('discovery:') ? scope.slice(10) : ''; }
    function isShopScope() { return !!scope && !discoveryMode(); }
    function scopeRows() {
        if (discoveryMode()) return 5;
        if (scope) return currentShopSettings.rows || 3;
        const rows = [5];
        for (const [file, source] of Object.entries(allShops)) {
            try {
                const shop = file === currentShopFile ? currentShopSettings : EditorYaml.parse(source);
                if (!Number(shop.layout?.rows)) rows.push(Number(shop.rows) || 3);
            } catch (_) {}
        }
        return Math.min(...rows);
    }
    function sync() { model = discoveryMode() ? effective(guiSettings.discovery?.[discoveryMode()] ?? null) : scope ? effective() : guiSettings; }
    function prepare() {
        sync();
        if (!scope) { normalizeSlots(); return; }
        const buttons = Object.fromEntries(controls.map(key => [key, copy(model[key])]));
        const layout = { ...copy(model.layout), buttons };
        if (discoveryMode()) {
            guiSettings.discovery ||= {};
            guiSettings.discovery[discoveryMode()] = layout;
        } else currentShopSettings.layout = layout;
        model.layout = layout;
        for (const key of controls) model[key] = buttons[key];
        normalizeSlots();
    }
    function normalizeSlots() {
        const size = resolve(model, scopeRows()).size;
        const occupied = new Set();
        controls.forEach((key, offset) => {
            const button = model[key];
            if (button.enabled === false) { button.slot = -1; return; }
            const automatic = size - 9 + offset;
            let slot = Number(button.slot);
            if (!Number.isInteger(slot) || slot < 0 || slot >= size) slot = automatic;
            if (occupied.has(slot)) slot = !occupied.has(automatic) ? automatic : Array.from({ length: size }, (_, index) => index).find(index => !occupied.has(index));
            occupied.add(slot);
            button.slot = slot === automatic ? -1 : slot;
        });
        const layout = resolve(model, scopeRows());
        const explicitContent = model.layout.contentSlots.length > 0;
        model.layout.contentSlots = explicitContent ? [...layout.contentSlots] : [];
        model.layout.emptySlots = [...layout.emptySlots];
    }
    function repair() {
        sync();
        const before = copy(model);
        prepare();
        changed(before, 'Repair invalid or overlapping layout slots');
    }
    function targetFile() { return isShopScope() ? 'shops/' + currentShopFile : 'menus/gui-settings.yml'; }
    function selectScope(file) {
        if (file.startsWith('discovery:') && !discoveryModes[file.slice(10)]) return;
        if (file && !file.startsWith('discovery:') && file !== currentShopFile) switchShop(file);
        scope = file;
        sync();
        renderGuiSettings();
        if (window.EditorPermissions) EditorPermissions.refresh();
    }
    function setPaint(mode) { paintMode = mode; renderGuiSettings(); }
    function chooseButton(key) { selectedButton = key; paintMode = 'buttons'; renderGuiSettings(); }

    function resolve(settings, shopRows = 3, discovery = true) {
        const requested = Number(settings.layout?.rows || 0);
        const rows = Number.isInteger(requested) && requested >= 1 && requested <= 6 ? requested : Math.min(6, Math.max(1, shopRows) + 1);
        const size = rows * 9;
        const buttons = [];
        controls.forEach((key, offset) => {
            const model = settings[key] || {};
            if (model.enabled === false || !discovery && offset < 3) return;
            let slot = Number(model.slot ?? -1);
            if (!Number.isInteger(slot) || slot < 0 || slot >= size) slot = size - 9 + offset;
            if (!buttons.some(button => button.slot === slot)) buttons.push({ key, slot, label: labels[offset], model });
        });
        const emptySlots = [...new Set((settings.layout?.emptySlots || []).filter(slot => Number.isInteger(slot) && slot >= 0 && slot < size && !buttons.some(button => button.slot === slot)))];
        const available = slot => slot >= 0 && slot < size && !emptySlots.includes(slot) && !buttons.some(button => button.slot === slot);
        const requestedSlots = settings.layout?.contentSlots || [];
        let contentSlots = [...new Set(requestedSlots.length ? requestedSlots.filter(slot => Number.isInteger(slot) && available(slot))
            : Array.from({ length: Math.max(1, rows - 1) * 9 }, (_, slot) => slot).filter(available))];
        if (!contentSlots.length) contentSlots = Array.from({ length: size }, (_, slot) => slot).filter(available);
        if (!contentSlots.length) {
            const slot = Array.from({ length: size }, (_, index) => index).find(slot => !buttons.some(button => button.slot === slot));
            emptySlots.splice(emptySlots.indexOf(slot), 1);
            contentSlots.push(slot);
        }
        return { rows, size, controls: buttons, contentSlots, emptySlots, capacity: contentSlots.length, filler: settings.layout?.filler, emptyArea: settings.layout?.emptyArea || 'air', emptyItem: settings.layout?.emptyItem };
    }
    function changed(before, section) {
        addActivityEntry('updated', isShopScope() ? 'shop-settings' : 'gui-settings', before, copy(model), { section: discoveryMode() ? discoveryModes[discoveryMode()] + ': ' + section : section, shopFile: isShopScope() ? scope : undefined });
        if (isShopScope()) allShops[currentShopFile] = EditorYaml.writeShop();
        renderGuiSettings();
        updatePreview();
        updateRowsControl();
        scheduleAutoSave();
    }
    function setRows(value) {
        prepare();
        const before = copy(model);
        const rows = Number(value);
        if (!Number.isInteger(rows) || rows < 0 || rows > 6) return;
        model.layout.rows = rows;
        normalizeSlots();
        changed(before, 'layout');
    }
    function reset() {
        sync();
        const before = copy(model);
        if (discoveryMode()) guiSettings.discovery[discoveryMode()] = null;
        else if (scope) currentShopSettings.layout = null;
        else {
            model.layout.rows = 0;
            model.layout.contentSlots = [];
            model.layout.emptySlots = [];
            model.layout.emptyArea = 'air';
            controls.forEach(key => { model[key].slot = -1; });
        }
        sync();
        changed(before, 'layout');
    }
    function paint(slot) {
        sync();
        const layout = resolve(model, scopeRows());
        if (paintMode === 'inspect') {
            const control = layout.controls.find(button => button.slot === slot);
            if (control) return edit(control.key);
            if (!layout.emptySlots.includes(slot) && !layout.contentSlots.includes(slot)) return edit('filler');
            return;
        }
        if (paintMode === 'buttons') return move(selectedButton, slot);
        const slots = [...layout.contentSlots];
        const existing = layout.controls.find(button => button.slot === slot);
        const index = slots.indexOf(slot);
        const empty = layout.emptySlots.includes(slot);
        if (paintMode === 'items' && index >= 0 || paintMode === 'filler' && index < 0 && !existing && !empty || paintMode === 'empty' && empty) return;
        const add = paintMode === 'items' && index < 0;
        if (!add && index >= 0 && slots.length === 1) return showAlert('Keep at least one shop item slot.', 'warning');
        prepare();
        const before = copy(model);
        if (existing) model[existing.key].enabled = false;
        if (add) slots.push(slot);
        else if (index >= 0) slots.splice(index, 1);
        model.layout.contentSlots = slots.sort((left, right) => left - right);
        model.layout.emptySlots = layout.emptySlots.filter(value => value !== slot);
        if (paintMode === 'empty') model.layout.emptySlots.push(slot);
        model.layout.emptySlots.sort((left, right) => left - right);
        changed(before, 'layout');
    }
    function move(key, slot) {
        prepare();
        if (!controls.includes(key)) return;
        const layout = resolve(model, scopeRows());
        if (slot < 0 || slot >= layout.size) return;
        const remaining = layout.contentSlots.filter(value => value !== slot);
        if (!remaining.length) return showAlert('Keep at least one shop item slot.', 'warning');
        const before = copy(model);
        const occupied = layout.controls.find(button => button.slot === slot && button.key !== key);
        if (occupied) model[occupied.key].enabled = false;
        model[key].enabled = true;
        model[key].slot = slot;
        model.layout.contentSlots = remaining;
        model.layout.emptySlots = layout.emptySlots.filter(value => value !== slot);
        changed(before, 'layout');
    }
    function icon(element, model) {
        const material = String(model.material || 'STONE').toLowerCase();
        const image = document.createElement('img');
        image.width = 32; image.height = 32; image.alt = material;
        image.src = `${TEXTURE_API}${encodeURIComponent(material)}.png`;
        element.appendChild(image);
        if (Number(model.amount) > 1) {
            const amount = document.createElement('span');
            amount.className = 'slot-amount'; amount.textContent = model.amount;
            element.appendChild(amount);
        }
        setupTooltip(element, model.name || '', model.lore || []);
    }
    function decorate(element, layout, slot, page = 0, pages = 1, always = true) {
        const button = layout.controls.find(control => control.slot === slot);
        if (button) {
            element.classList.add('layout-reserved', 'layout-button-reserved');
            if (!always && (button.key === 'prevButton' && page <= 0 || button.key === 'nextButton' && page >= pages - 1)) return;
            icon(element, button.model);
            if (button.key === 'prevButton') element.onclick = () => changePage(-1);
            if (button.key === 'nextButton') element.onclick = () => changePage(1);
        } else if (layout.emptySlots.includes(slot)) {
            element.classList.add('layout-reserved', 'layout-empty');
        } else if (!layout.contentSlots.includes(slot)) {
            element.classList.add('layout-reserved', 'layout-filler-reserved');
            if (layout.filler?.enabled) icon(element, layout.filler);
        } else {
            const placeholder = layout.emptyArea === 'filler' ? layout.filler : layout.emptyArea === 'item' ? layout.emptyItem : null;
            if (placeholder?.enabled) icon(element, placeholder);
        }
    }
    function setEmptyArea(value) {
        if (!['air', 'filler', 'item'].includes(value)) return;
        prepare();
        const before = copy(model);
        model.layout.emptyArea = value;
        changed(before, 'layout');
    }
    function settingsHtml() {
        if (window.EditorPermissions && !EditorPermissions.canViewSharedGui() && !scope) scope = currentShopFile;
        sync();
        const layout = resolve(model, scopeRows());
        return `<div class="settings-group card-base full-width gui-layout-settings">
            <h3 class="group-title">Shop layout</h3>
            <div class="gui-layout-scope"><label>Layout for <select id="gui-layout-scope" class="input-base" onchange="GuiLayout.selectScope(this.value)">
                <option value="" ${!scope ? 'selected' : ''} ${window.EditorPermissions && !EditorPermissions.canViewSharedGui() ? 'disabled' : ''}>Shared defaults</option>
                ${Object.entries(discoveryModes).map(([mode, label]) => `<option value="discovery:${mode}" ${scope === 'discovery:' + mode ? 'selected' : ''} ${window.EditorPermissions && !EditorPermissions.canViewSharedGui() ? 'disabled' : ''}>${label}</option>`).join('')}
                ${Object.keys(allShops).map(file => `<option value="${escapeHtml(file)}" ${scope === file ? 'selected' : ''}>${escapeHtml(file.replace(/\.yml$/, ''))}</option>`).join('')}
            </select></label><p>${scope ? 'Changes apply only to this ' + (discoveryMode() ? 'menu' : 'shop') + '. Reset layout restores shared defaults.' : 'Shared defaults apply to shops and discovery menus without their own layout.'}</p></div>
            <div id="gui-layout-editor">
            <p>Select a button or filler item to edit it, or choose a paint tool to change slot types. Product icons are read-only examples; prices and shop items cannot be edited here.</p>
            ${!scope && !Number(model.layout.rows) ? '<p>Automatic shared layouts use the smallest inheriting inventory for slot design, so positions also fit smaller shops. Select a fixed row count to use the same larger inventory everywhere.</p>' : ''}
            <p>For an existing draft with invalid or overlapping slots, use <strong>Repair Slots</strong> for the affected layout, review the result, then save the draft. Repair keeps valid positions, moves conflicting buttons to available slots, and removes invalid item/air positions.</p>
            <div class="gui-layout-actions"><label>Inventory rows <select class="input-base" onchange="GuiLayout.setRows(this.value)">${[0,1,2,3,4,5,6].map(rows => `<option value="${rows}" ${rows === Number(model.layout.rows) ? 'selected' : ''}>${rows || (discoveryMode() ? 'Automatic (6 rows)' : 'Automatic (shop rows + navigation)')}</option>`).join('')}</select></label>
                <div class="gui-layout-action-buttons"><button class="btn btn-secondary" onclick="GuiLayout.edit('filler')">EDIT FILLER</button><button class="btn btn-secondary" onclick="GuiLayout.repair()" title="Remove invalid item/air positions and move invalid or conflicting buttons to available slots. Review the repaired preview before saving.">REPAIR SLOTS</button><button class="btn btn-secondary" onclick="GuiLayout.reset()">RESET LAYOUT</button></div></div>
            <div class="gui-layout-actions"><label>Unused item-area slots <select id="gui-empty-area" class="input-base" onchange="GuiLayout.setEmptyArea(this.value)">
                ${[['air', 'Leave empty (air)'], ['filler', 'Use filler item'], ['item', 'Use another item']].map(([value,label]) => `<option value="${value}" ${value === model.layout.emptyArea ? 'selected' : ''}>${label}</option>`).join('')}
            </select></label><div class="gui-layout-action-buttons"><button class="btn btn-secondary" onclick="GuiLayout.edit('emptyItem')">EDIT UNUSED-SLOT ITEM</button></div></div>
            <div class="gui-paint-tools" role="group" aria-label="Slot paint mode">
                <button type="button" class="btn btn-secondary ${paintMode === 'inspect' ? 'selected' : ''}" onclick="GuiLayout.setPaint('inspect')">SELECT / EDIT</button>
                <button type="button" class="btn btn-secondary ${paintMode === 'items' ? 'selected' : ''}" onclick="GuiLayout.setPaint('items')">ITEM AREA</button>
                <button type="button" class="btn btn-secondary ${paintMode === 'filler' ? 'selected' : ''}" onclick="GuiLayout.setPaint('filler')">FILLER</button>
                <button type="button" class="btn btn-secondary ${paintMode === 'empty' ? 'selected' : ''}" onclick="GuiLayout.setPaint('empty')">EMPTY / AIR</button>
                <button type="button" class="btn btn-secondary ${paintMode === 'buttons' ? 'selected' : ''}" onclick="GuiLayout.setPaint('buttons')">BUTTONS</button>
                <select aria-label="Button to paint" class="input-base" onchange="GuiLayout.chooseButton(this.value)">${controls.map((key,index) => `<option value="${key}" ${key === selectedButton ? 'selected' : ''}>${labels[index]}</option>`).join('')}</select>
            </div>
            <div class="gui-layout-workspace">
                <div class="gui-layout-chest"><h4>${escapeHtml(discoveryModes[discoveryMode()] || (scope ? scope.replace(/\.yml$/, '') : 'Shop preview'))}</h4>
                    <div id="gui-layout-preview" class="gui-layout-grid gui-layout-painting"></div>
                    <p class="gui-layout-legend"><span class="layout-content">Item area</span><span class="layout-filler">Filler</span><span class="layout-empty">Air</span><span class="layout-control">Buttons</span></p>
                    <p>${layout.capacity} items per page · ${discoveryMode() ? 'Empty-state layout preview; actual search results, favorites and recent items depend on the player in game. ' : ''}All enabled page buttons are shown. Air slots always stay empty.</p>
                </div>
                ${buttonSettingsHtml(layout)}
            </div>
        </div></div>`;
    }
    function buttonSettingsHtml(layout) {
        return `<div id="gui-button-editor"><h4>Buttons</h4><div class="gui-control-cards grid-list">${controls.map((key, index) => `<button class="shop-item" onclick="GuiLayout.edit('${key}')">
            <span class="gui-control-heading"><span class="item-title">${labels[index]}</span><small>${model[key].enabled === false ? 'Hidden' : 'Slot ' + (layout.controls.find(control => control.key === key)?.slot ?? 'automatic')}</small></span>
            <span class="gui-control-icon" data-control="${key}"></span>
            <span class="item-subtitle">${parseMinecraftColors(model[key].name || '')}</span>
            <small>Material: ${escapeHtml(model[key].material || 'STONE')}</small>
        </button>`).join('')}</div><p>Click to customize material, name, lore, slot and item flags. Drag visible buttons in the preview to move them.</p></div>`;
    }
    function renderDesigner() {
        sync();
        const preview = document.getElementById('gui-layout-preview');
        if (!preview) return;
        preview.replaceChildren();
        const layout = resolve(model, scopeRows());
        document.querySelectorAll('.gui-control-icon[data-control]').forEach(element => icon(element, model[element.dataset.control]));
        for (let slot = 0; slot < layout.size; slot++) {
            const control = layout.controls.find(button => button.slot === slot);
            const contentIndex = layout.contentSlots.indexOf(slot);
            const cell = document.createElement('button');
            cell.type = 'button';
            const kind = control ? 'control' : contentIndex >= 0 ? 'content' : layout.emptySlots.includes(slot) ? 'empty' : 'filler';
            cell.className = 'gui-slot gui-layout-cell layout-' + kind;
            cell.title = slot + ': ' + (control ? control.label : contentIndex >= 0 ? 'Item area (sample item, read-only)' : kind === 'empty' ? 'Air (always empty)' : 'Filler');
            const item = contentIndex >= 0 && !discoveryMode() ? items.find(row => row.slot === contentIndex) : null;
            if (discoveryMode() && contentIndex === Math.floor(layout.capacity / 2)) {
                const emptyNames = { search: 'No matching search results', favorites: 'No favorite items yet', recent: 'No recent items yet' };
                icon(cell, { material: 'GRAY_STAINED_GLASS_PANE', name: emptyNames[discoveryMode()], lore: ['Player-specific results appear in game.'] });
                cell.dataset.discoveryEmpty = discoveryMode();
            } else if (item) icon(cell, item);
            else decorate(cell, layout, slot);
            const number = document.createElement('span');
            number.className = 'gui-layout-slot-number';
            number.textContent = slot;
            cell.appendChild(number);
            cell.onclick = () => paint(slot);
            cell.ondragover = event => event.preventDefault();
            cell.ondrop = event => {
                event.preventDefault();
                const key = event.dataTransfer.getData('text/gui-control');
                if (controls.includes(key)) move(key, slot);
            };
            if (control) {
                cell.draggable = true;
                cell.ondragstart = event => event.dataTransfer.setData('text/gui-control', control.key);
            }
            preview.appendChild(cell);
        }
    }
    function edit(key) {
        sync();
        const filler = key === 'filler' || key === 'emptyItem';
        const button = filler ? model.layout[key] : model[key];
        if (!button) return;
        openEditModal({
            title: key === 'emptyItem' ? 'Edit unused item-area placeholder' : filler ? 'Edit filler item' : `Edit ${labels[controls.indexOf(key)]}`,
            fields: [
                { id: 'enabled', label: 'Enabled', type: 'checkbox', value: button.enabled },
                { id: 'material', label: 'Material', value: button.material },
                { id: 'name', label: 'Display name', value: messageEditorValue(button.name) },
                { id: 'lore', label: 'Lore (one line per entry)', type: 'textarea', value: (button.lore || []).map(line => messageEditorValue(line)).join('\n') },
                { id: 'amount', label: 'Display amount (1–64)', type: 'number', value: button.amount },
                ...(!filler ? [{ id: 'slot', label: 'Slot (-1 = automatic, otherwise 0-based)', type: 'number', value: button.slot }] : []),
                { id: 'hideAttributes', label: 'Hide attributes', type: 'checkbox', value: button.hideAttributes },
                { id: 'hideAdditional', label: 'Hide additional item information', type: 'checkbox', value: button.hideAdditional },
                { id: 'hideEnchants', label: 'Hide enchantments', type: 'checkbox', value: button.hideEnchants }
            ],
            onSave(data) {
                const amount = Number(data.amount);
                const slot = Number(data.slot);
                const layout = resolve(model, scopeRows());
                if (!Number.isInteger(amount) || amount < 1 || amount > 64 || !/^[A-Z0-9_]+$/i.test(data.material || '') || String(data.material).toUpperCase() === 'AIR') return showAlert('Choose an item material and an amount from 1 to 64.', 'warning');
                if (!filler && (!Number.isInteger(slot) || slot < -1 || slot >= layout.size)) return showAlert('Choose a slot inside the inventory, or -1 for automatic placement.', 'warning');
                const candidate = { ...button, enabled: !!data.enabled, material: data.material.toUpperCase(), amount,
                    name: preserveMessageReference(button.name, data.name), lore: String(data.lore || '').split('\n').map((line, index) => preserveMessageReference(button.lore?.[index], line)),
                    hideAttributes: !!data.hideAttributes, hideAdditional: !!data.hideAdditional, hideEnchants: !!data.hideEnchants };
                if (!filler) {
                    candidate.slot = slot;
                    const resolvedSlot = slot < 0 ? layout.size - 9 + controls.indexOf(key) : slot;
                    if (candidate.enabled && layout.controls.some(button => button.key !== key && button.slot === resolvedSlot)) return showAlert('Another button already uses that slot.', 'warning');
                    if (candidate.enabled && model.layout.contentSlots.length && model.layout.contentSlots.includes(resolvedSlot)) return showAlert('Remove that slot from the green item area first, or drag the button in the designer.', 'warning');
                    if (candidate.enabled && (model.layout.emptySlots || []).includes(resolvedSlot)) return showAlert('Remove that slot from the air area first, or drag the button in the designer.', 'warning');
                }
                const before = copy(model);
                prepare();
                Object.assign(filler ? model.layout[key] : model[key], candidate);
                changed(before, key);
            }
        });
    }
    return { resolve, current, effective, settingsHtml, renderDesigner, decorate, edit, setRows, reset, repair, paint, move, selectScope, setPaint, chooseButton, setEmptyArea, targetFile, rowsOverridden, updateRowsControl, isShopScope, isScopedLayout: () => !!scope, selectedSettings: () => { sync(); return model; } };
})();
