// npm install --prefix target/rendering-tools --no-save playwright
// node src/test/web/tutorial-browser.cjs [--firefox]
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium, firefox } = require(path.resolve(__dirname, '../../../target/rendering-tools/node_modules/playwright'));
const { createPreviewServer } = require('./editor-preview-server.cjs');
const key = 'geniusshop:tutorial:v1:preview';
const copyValues = {
    'menu-title': 'Practice menu title', material: 'DIAMOND', price: '25',
    lore: 'Practice item', permission: 'tutorial.practice', 'item-commands': 'say Practice %player%',
    drag: '2', 'purchase-rows': '4', 'sell-maximum': '128', 'campaign-key': 'practice-sale',
    'campaign-multiplier': '0.9', 'command-name': 'practice-shop', 'gui-name': 'Practice back'
};

async function performTask(page, id, touch = false) {
    const save = () => page.locator('#edit-modal button[onclick="saveEditModal()"]').click();
    switch (id) {
        case 'menu-title': await page.locator('#preview-title-input').fill('Practice menu title'); break;
        case 'shop-select':
            if (touch) {
                await page.locator('#custom-shop-file-selector .custom-select-trigger').click();
                await page.locator('#custom-shop-file-selector .custom-select-option').last().click();
            } else {
                await page.locator('#custom-shop-file-selector .custom-select-trigger').focus();
                await page.keyboard.press('ArrowDown');
            }
            break;
        case 'shop-open': await page.locator('#preview-grid .gui-slot.filled').first().click(); break;
        case 'material': await page.locator('#modal-material').fill('DIAMOND'); break;
        case 'price':
            await page.locator('#modal-price').fill('7');
            await page.waitForTimeout(120);
            assert.equal(await page.locator('#editor-tutorial').getByRole('button', { name: 'Next', exact: true }).isDisabled(), true);
            await page.locator('#modal-price').fill('25'); break;
        case 'lore':
            await page.locator('#modal-enableLore').check();
            await page.locator('#modal-lore').fill('Practice item'); break;
        case 'dynamic': await page.locator('#modal-dynamicPricing').check(); break;
        case 'permission': await page.locator('#modal-permission').fill('tutorial.practice'); break;
        case 'item-commands':
            await page.locator('#modal-enableCommands').check();
            await page.locator('#modal-commands').fill('say Practice %player%'); break;
        case 'item-save': case 'campaign-save': case 'gui-save': await save(); break;
        case 'drag':
            if (touch) {
                await page.locator('#preview-grid .gui-slot.filled').first().click();
                await page.locator('#modal-slot').fill('2');
                await save();
            } else {
                await page.locator('#preview-grid .gui-slot.filled').first().dragTo(page.locator('#preview-grid .gui-slot').nth(2));
            }
            break;
        case 'item-add': await page.locator('#shop-tab button[onclick="addItem()"]').click(); break;
        case 'purchase-rows': await page.locator('#purchase-rows-input').fill('4'); await page.locator('#purchase-rows-input').press('Tab'); break;
        case 'sell-maximum': await page.locator('#sell-max-input').fill('128'); break;
        case 'campaign-open': await page.locator('#campaigns-tab button[onclick="addCampaignTemplate()"]').click(); break;
        case 'campaign-key': await page.locator('#modal-campaign-key').fill('practice-sale'); break;
        case 'campaign-multiplier': await page.locator('#modal-campaign-buy').fill('0.9'); break;
        case 'command-add': await page.locator('#commands-tab button[onclick="addCustomCommand()"]').click(); break;
        case 'command-name': await page.locator('[data-command-field="name"]').first().fill('practice-shop'); break;
        case 'customitem-add': await page.locator('#customitems-tab button[onclick="addCustomItem()"]').click(); break;
        case 'gui-open': await page.locator('#gui-settings-container [onclick="GuiLayout.edit(\'backButton\')"]').click(); break;
        case 'gui-name': await page.locator('#name').fill('Practice back'); break;
        default: throw new Error(`Missing browser action for task ${id}`);
    }
    await page.waitForFunction(() => !Array.from(document.querySelectorAll('#editor-tutorial button')).find(button => /^(Next|Finish)$/.test(button.textContent.trim()))?.disabled);
}

const snapshot = () => JSON.stringify({ items, currentShopSettings, currentShopFile, allShops, mainMenuSettings,
    loadedGuiShops, transactionSettings, guiSettings, globalCampaigns, customCommands, customItemsConfig,
    customItemsFileRaw, commandsFileRaw, unsavedChanges, activityLog, yaml: EditorYaml.writeShop() });

(async () => {
    const server = createPreviewServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}`;
    let browser;
    try {
        browser = process.argv.includes('--firefox') ? await firefox.launch({ headless: true }) :
            await chromium.launch({ channel: 'chrome', headless: true });
        for (const viewport of (process.argv.includes('--mobile') ? [{ width: 390, height: 844 }] : process.argv.includes('--narrow') ? [{ width: 320, height: 568 }] : [{ width: 1365, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 568 }])) {
            const context = await browser.newContext({ viewport });
            const page = await context.newPage();
            page.setDefaultTimeout(10000);
            const errors = [], writes = [];
            page.on('pageerror', error => errors.push(error.message));
            page.on('request', request => {
                if (request.url().startsWith(url + '/api/') && request.method() !== 'GET') writes.push(request.url());
            });
            await page.route('https://**/*', route => route.request().resourceType() === 'image' ?
                route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64') }) : route.abort());
            await page.addInitScript(() => { localStorage.setItem('autoSaveEnabled', 'true'); localStorage.setItem('autoSaveMode', 'publish'); });
            await page.addInitScript(() => {
                window.copiedTutorialValues = [];
                Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
                    writeText: async value => {
                        if (window.rejectTutorialClipboard) throw new Error('Clipboard denied');
                        window.copiedTutorialValues.push(value);
                    }
                } });
                const originalCopy = document.execCommand.bind(document);
                document.execCommand = command => {
                    if (command !== 'copy') return originalCopy(command);
                    if (window.rejectTutorialFallback) return false;
                    window.copiedTutorialValues.push(document.activeElement.value);
                    return true;
                };
                window.tutorialClicks = [];
                document.addEventListener('click', event => {
                    if (event.target.closest('#editor-tutorial')) window.tutorialClicks.push({ tag: event.target.tagName,
                        text: event.target.textContent.slice(0, 50), step: document.getElementById('editor-tutorial').dataset.step });
                }, true);
            });
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            const tour = page.locator('#editor-tutorial');
            await tour.waitFor({ state: 'visible' });
            await page.keyboard.press('Escape');
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => !document.getElementById('editor-tutorial-help').disabled);
            assert.equal(await tour.isVisible(), false);
            // Existing unsaved drafts and object references must survive every practice action.
            await page.evaluate(() => {
                items[0].name = 'Existing unsaved draft';
                setUnsavedChanges([{ target: 'shop-item', details: { shopFile: currentShopFile } }]);
                window.originalTutorialItems = items;
            });
            const baseline = await page.evaluate(snapshot);
            const preferences = await page.evaluate(() => [localStorage.getItem('autoSaveEnabled'), localStorage.getItem('autoSaveMode')]);
            await page.locator('#editor-tutorial-help').click();
            await tour.getByRole('button', { name: 'Replay full walkthrough', exact: true }).click();
            const visited = [], practiced = [];
            for (let step = 0; step < 65 && await tour.isVisible(); step++) {
                const previousStep = await tour.getAttribute('data-step');
                const title = await page.locator('#tutorial-title').textContent();
                visited.push(title);
                const box = await page.locator('.tutorial-panel').boundingBox();
                assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, JSON.stringify({ viewport, box, title }));
                assert.equal(await page.locator('.tutorial-panel').evaluate(element => element.scrollWidth <= element.clientWidth), true);
                const task = await tour.getAttribute('data-task');
                if (process.argv.includes('--trace')) console.log(`${viewport.width}: ${previousStep} ${task || title}`);
                const next = tour.getByRole('button', { name: /^(Next|Finish)$/ });
                if (task) {
                    if (!practiced.includes(task)) assert.equal(await next.isDisabled(), true, task);
                    if (copyValues[task]) {
                        const value = copyValues[task];
                        assert.equal(await tour.locator('mark code').textContent(), value);
                        const beforeCopy = await page.evaluate(snapshot);
                        // Exercise both clipboard APIs and a denied-copy message without editing fields.
                        await page.evaluate(task => {
                            window.rejectTutorialClipboard = ['material', 'permission'].includes(task);
                            window.rejectTutorialFallback = task === 'permission';
                        }, task);
                        await tour.getByRole('button', { name: `Copy ${value}`, exact: true }).click();
                        await page.waitForFunction(() => !!document.querySelector('.tutorial-copy-status').textContent);
                        if (task === 'permission') {
                            assert.match(await tour.locator('.tutorial-copy-status').textContent(), /Could not copy/);
                        } else {
                            assert.equal(await tour.locator('.tutorial-copy-status').textContent(), 'Copied');
                            assert.equal(await page.evaluate(() => window.copiedTutorialValues.at(-1)), value);
                        }
                        assert.equal(await page.evaluate(snapshot), beforeCopy);
                        assert.equal(await next.isDisabled(), true, `Copy must not complete ${task}`);
                        assert.equal(await tour.locator('.tutorial-copy-source').count(), 0);
                    }
                    if (practiced.length === 0) {
                        const blocked = await page.evaluate(async () => {
                            try { await fetch('api/file/shops/__tutorial_practice__.yml', { method: 'POST', body: '{}' }); return false; }
                            catch (error) { return error.message.includes('Practice only'); }
                        });
                        assert.equal(blocked, true);
                        await page.keyboard.press('Control+s');
                        await page.keyboard.press('Control+Enter');
                        assert.equal(await page.locator('#save-confirmation-modal').isVisible(), false);
                    }
                    if (['material', 'drag', 'permission'].includes(task)) {
                        assert.equal(await tour.evaluate(element => element.classList.contains('tutorial-has-target')), true);
                        assert.equal(await tour.evaluate(element => getComputedStyle(element, '::before').backgroundColor), 'rgba(0, 0, 0, 0)');
                        assert.equal(await tour.evaluate(element => getComputedStyle(element, '::backdrop').backgroundColor), 'rgba(0, 0, 0, 0)');
                        await page.screenshot({ path: `target/tutorial-practice-${process.argv.includes('--firefox') ? 'firefox' : 'chrome'}-${viewport.width}-${task}.png` });
                    }
                    try { await performTask(page, task, viewport.width < 900); }
                    catch (error) {
                        await page.screenshot({ path: 'target/tutorial-practice-failure.png' });
                        console.log(await page.evaluate(() => ({
                            task: document.getElementById('editor-tutorial').dataset.task,
                            panel: document.querySelector('.tutorial-panel').getBoundingClientRect().toJSON(),
                            spotlight: document.querySelector('.tutorial-spotlight').getBoundingClientRect().toJSON(),
                            save: document.querySelector('#edit-modal button[onclick="saveEditModal()"]').getBoundingClientRect().toJSON()
                        })));
                        throw error;
                    }
                    practiced.push(task);
                } else assert.equal(await next.isDisabled(), false);
                if (!task) {
                    await page.waitForTimeout(1100);
                    assert.equal(await tour.getAttribute('data-step'), previousStep, 'Information waits for Next');
                    await next.click();
                }
                await page.waitForFunction(previous => {
                    const dialog = document.getElementById('editor-tutorial');
                    return !dialog.open || dialog.dataset.step !== previous;
                }, previousStep).catch(async error => {
                    console.log({ task, previousStep, clicks: await page.evaluate(() => window.tutorialClicks?.slice(-6)), errors });
                    await page.screenshot({ path: 'target/tutorial-next-failure.png' });
                    throw error;
                });
            }
            assert.deepEqual(errors, []);
            assert.equal(await tour.isVisible(), false, visited.join(', '));
            for (const task of ['shop-open', 'material', 'price', 'lore', 'item-save', 'drag', 'item-add', 'campaign-save', 'command-name', 'customitem-add', 'gui-save']) assert.ok(practiced.includes(task), task);
            assert.ok(visited.includes('Inspect stock') && visited.includes('Persistent counters'));
            assert.equal(await page.locator('#edit-modal').isVisible(), false);
            assert.equal(await page.evaluate(snapshot), baseline);
            assert.equal(await page.evaluate(() => items === window.originalTutorialItems), true);
            assert.deepEqual(await page.evaluate(() => [localStorage.getItem('autoSaveEnabled'), localStorage.getItem('autoSaveMode')]), preferences);
            assert.equal(await page.evaluate(() => currentTab), 'mainmenu');
            const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
            assert.equal(Object.keys(stored.sections).length, 12);
            assert.ok(Object.values(stored.sections).every(section => section.status === 'completed'));
            if (viewport.width > 900) {
                // Back cancels pending advancement, and revisiting a finished task stays readable.
                await page.locator('#editor-tutorial-help').click();
                await tour.getByRole('button', { name: /^Main menu/ }).click();
                await tour.getByRole('button', { name: 'Next', exact: true }).click();
                await performTask(page, 'menu-title');
                await tour.getByRole('button', { name: 'Back', exact: true }).click();
                await page.waitForTimeout(1200);
                assert.equal(await page.locator('#tutorial-title').textContent(), 'Main menu buttons');
                await tour.getByRole('button', { name: 'Next', exact: true }).click();
                await page.waitForTimeout(1200);
                assert.equal(await page.locator('#tutorial-title').textContent(), 'Edit the preview title');
                await page.keyboard.press('Escape');
                assert.equal(await page.evaluate(snapshot), baseline);
                // A pending live autosave is paused, then rescheduled only after originals are restored.
                await page.evaluate(() => scheduleEditorAutoSave());
                await page.locator('#editor-tutorial-help').click();
                await tour.getByRole('button', { name: /^Shop items/ }).click();
                await page.waitForTimeout(2100);
                assert.equal(await page.evaluate(() => getEditorState('autoSaveTimeout')), null);
                assert.deepEqual(writes, []);
                await page.keyboard.press('Escape');
                assert.equal(await page.evaluate(() => !!getEditorState('autoSaveTimeout')), true);
                await page.evaluate(() => { clearTimeout(getEditorState('autoSaveTimeout')); setEditorState('autoSaveTimeout', null); });
                assert.equal(await page.evaluate(snapshot), baseline);
            }
            // Escape while changing an item restores the original draft and closes only our editor.
            await page.locator('#editor-tutorial-help').click();
            await tour.getByRole('button', { name: /^Shop items/ }).click();
            for (const task of ['shop-select', 'shop-open', 'material']) {
                await performTask(page, task);
                await tour.getByRole('button', { name: 'Next', exact: true }).click();
            }
            await page.keyboard.press('Escape');
            assert.equal(await page.evaluate(snapshot), baseline);
            assert.equal(await page.locator('#edit-modal').isVisible(), false);
            // Practice remains available in an empty real shop without adding real entries.
            await page.evaluate(() => { items = []; });
            const empty = await page.evaluate(snapshot);
            await page.locator('#editor-tutorial-help').click();
            await tour.getByRole('button', { name: /^Shop items/ }).click();
            assert.equal(await page.evaluate(() => items.length), 2);
            await page.keyboard.press('Escape');
            assert.equal(await page.evaluate(snapshot), empty);
            await page.evaluate(() => { items = window.originalTutorialItems; });
            // An already-open dialog is not replaced, and its unsaved input survives.
            await page.evaluate(() => {
                switchTab('shop'); openShopItemModal(items[0].id);
                window.existingDialog = currentModalData;
                document.getElementById('modal-name').value = 'Unsaved dialog';
                EditorTutorial.open();
            });
            await tour.getByRole('button', { name: /^Shop items/ }).click();
            assert.equal(await page.locator('#tutorial-title').textContent(), 'Practice is waiting');
            await page.keyboard.press('Escape');
            assert.equal(await page.evaluate(() => currentModalData === window.existingDialog), true);
            assert.equal(await page.locator('#modal-name').inputValue(), 'Unsaved dialog');
            await page.evaluate(() => { closeEditModal(true); switchTab('mainmenu'); });
            // Returning users receive only changed sections and can dismiss or disable them.
            await page.evaluate(key => { const saved = JSON.parse(localStorage.getItem(key)); delete saved.sections.commands; localStorage.setItem(key, JSON.stringify(saved)); }, key);
            await page.reload({ waitUntil: 'domcontentloaded' });
            await tour.waitFor({ state: 'visible' });
            assert.equal(await page.locator('#tutorial-title').textContent(), 'Custom commands');
            await tour.getByRole('button', { name: 'Skip section', exact: true }).click();
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => !document.getElementById('editor-tutorial-help').disabled);
            assert.equal(await tour.isVisible(), false);
            await page.locator('#editor-tutorial-help').click();
            await tour.getByRole('checkbox').uncheck();
            await page.keyboard.press('Escape');
            await page.evaluate(key => { const saved = JSON.parse(localStorage.getItem(key)); delete saved.sections.shop; localStorage.setItem(key, JSON.stringify(saved)); }, key);
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => !document.getElementById('editor-tutorial-help').disabled);
            assert.equal(await tour.isVisible(), false);
            await page.locator('#editor-tutorial-help').click();
            await tour.getByRole('button', { name: /^Shop items/ }).click();
            await tour.getByRole('button', { name: 'Skip section', exact: true }).click();
            const skipped = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).sections.shop.status, key);
            assert.equal(skipped, 'dismissed');
            // Hidden and disabled sections stay out of manual replay.
            await page.evaluate(() => {
                document.querySelector('[data-tab="commands"]').hidden = true;
                document.querySelector('[data-tab="dataeditor"]').disabled = true;
                document.querySelector('#customitems-tab').remove();
            });
            await page.locator('#editor-tutorial-help').click();
            for (const name of [/^Commands/, /^Stored data/, /^Custom items/]) assert.equal(await tour.getByRole('button', { name }).count(), 0);
            await page.keyboard.press('Escape');
            assert.deepEqual(errors, []);
            assert.deepEqual(writes, [], 'Practice must never send server writes, including with publish autosave enabled');
            console.log(`Interactive tutorial passed at ${viewport.width}x${viewport.height}: ${visited.length} steps, ${practiced.length} tasks, original drafts restored, zero writes.`);
            await context.close();
        }
        const denied = await browser.newPage();
        await denied.route('https://**/*', route => route.abort());
        await denied.route('**/api/files?*', route => route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"Access denied"}' }));
        await denied.goto(url, { waitUntil: 'domcontentloaded' });
        await denied.getByText('Access denied', { exact: true }).waitFor({ state: 'visible' });
        assert.equal(await denied.locator('#editor-tutorial-help').isDisabled(), true);
        await denied.close();
        console.log('Authorization failure passed.');
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
