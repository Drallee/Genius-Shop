const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(path.resolve(__dirname, '../../../target/rendering-tools/node_modules/playwright'));
const { createDraftPreviewServer } = require('./draft-preview-server.cjs');

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        for (const role of ['admin', 'shop-view', 'shop-drafts', 'publish']) {
            const permissions = role === 'admin' ? { admin: true } : role === 'publish' ? { publish: true } :
                { sections: { shop: { view: true, edit: role === 'shop-drafts' } } };
            const server = createDraftPreviewServer({ permissions });
            await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
            const context = await browser.newContext({ viewport: process.argv.includes('--mobile') ? { width: 390, height: 844 } : { width: 1365, height: 1000 } });
            try {
                const page = await context.newPage();
                const errors = [];
                page.on('pageerror', error => errors.push(error.message));
                await page.route('https://**/*', route => route.abort());
                await page.addInitScript(() => {
                    localStorage.setItem('autoSaveEnabled', 'false');
                    localStorage.setItem('geniusshop:tutorial:v1:preview', JSON.stringify({ firstRunHandled: true, autoNewFeatures: false, sections: {} }));
                });
                await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'domcontentloaded' });
                await page.waitForFunction(() => !getEditorState('isLoadingFiles') && document.body.classList.contains('permissions-ready'));
                await page.evaluate(() => switchTab('shop'));
                assert.equal(await page.evaluate(() => EditorPermissions.canSaveTab('shop')), ['admin','shop-drafts'].includes(role));
                if (role.startsWith('shop-')) {
                    assert.deepEqual(await page.locator('.sidebar-tabs .tab:not([hidden])').evaluateAll(buttons => buttons.map(button => button.dataset.tab)), ['shop', 'guisettings']);
                    if (role === 'shop-drafts') {
                        await page.evaluate(async () => { items[0].price = 123; await saveCurrentShop(true); });
                        assert.match(server.draftState.workspace['shops/blocks.yml'], /price: 123/);
                        assert.ok(server.draftState.requests.every(url => url === '/api/file/shops/blocks.yml'));
                    }
                    await page.evaluate(() => switchTab('guisettings'));
                    assert.equal(await page.locator('#gui-layout-editor').evaluate(node => node.inert), role === 'shop-view');
                    assert.equal(await page.locator('#gui-layout-scope option[value=""]').evaluate(option => option.disabled), true);
                    if (role === 'shop-drafts') {
                        await page.evaluate(async () => { GuiLayout.setRows(3); await saveCurrentTabChanges(true); });
                        assert.match(server.draftState.workspace['shops/blocks.yml'], /layout:/);
                        assert.ok(server.draftState.requests.every(url => url === '/api/file/shops/blocks.yml'));
                    } else {
                        assert.equal(await page.locator('#editor-permission-notice').isVisible(), true);
                        assert.notEqual(await page.locator('#editor-permission-notice').evaluate(node => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)');
                    }
                } else if (role === 'publish') {
                    assert.equal(await page.locator('.minecraft-preview-section').evaluate(node => node.inert), true);
                    await page.evaluate(() => switchTab('dataeditor'));
                    await page.waitForFunction(() => document.querySelector('#data-editor-sections button'));
                    assert.equal(await page.locator('#data-editor-sections button:not([disabled])').count(), 0);
                    await page.evaluate(() => switchTab('guisettings'));
                    assert.equal(await page.locator('#gui-layout-editor').evaluate(node => node.inert), true);
                } else {
                    await page.evaluate(() => switchTab('guisettings'));
                    assert.equal(await page.locator('.gui-control-cards button').count(), 6);
                    await page.evaluate(() => {
                        guiSettings.layout.rows = 3;
                        guiSettings.layout.contentSlots = [10,11,12,13,14,15,16];
                        renderGuiSettings();
                    });
                    assert.equal(await page.locator('#gui-layout-preview .layout-content').count(), 7);
                    assert.equal(await page.locator('#gui-layout-preview > button').count(), 27);
                    await page.getByRole('button', { name: 'EDIT FILLER', exact: true }).click();
                    await page.locator('#enabled').check();
                    await page.locator('#material').fill('YELLOW_STAINED_GLASS_PANE');
                    await page.locator('#edit-modal button[onclick="saveEditModal()"]').click();
                    assert.equal(await page.locator('#gui-layout-preview img[alt="yellow_stained_glass_pane"]').count(), 14);
                    await page.evaluate(() => { guiSettings.searchButton.slot = 0; renderGuiSettings(); });
                    await page.locator('.gui-control-cards button').first().click();
                    assert.equal(await page.locator('#slot').inputValue(), '0');
                    await page.locator('#material').fill('PAPER');
                    await page.locator('#name').fill('&6Find items');
                    await page.locator('#lore').fill('&7Search our catalog');
                    await page.locator('#amount').fill('2');
                    await page.locator('#slot').fill('24');
                    await page.locator('#hideAdditional').uncheck();
                    await page.locator('#edit-modal button[onclick="saveEditModal()"]').click();
                    assert.equal(await page.evaluate(() => guiSettings.searchButton.name), '&6Find items');
                    assert.equal(await page.evaluate(() => guiSettings.searchButton.hideAdditional), false);
                    await page.locator('#gui-layout-preview > button').nth(24).dragTo(page.locator('#gui-layout-preview > button').nth(25));
                    assert.equal(await page.evaluate(() => guiSettings.searchButton.slot), 25);
                    await page.evaluate(async () => saveGuiSettingsYaml(true));
                    assert.match(server.draftState.workspace['menus/gui-settings.yml'], /content-slots:/);
                    await page.reload({ waitUntil: 'domcontentloaded' });
                    await page.waitForFunction(() => !getEditorState('isLoadingFiles') && guiSettings.searchButton.slot === 25);
                    await page.evaluate(() => switchTab('shop'));
                    assert.equal(await page.locator('#preview-grid > .gui-slot').count(), 27);
                    assert.equal(await page.locator('#preview-grid > .gui-slot').nth(25).locator('img').getAttribute('alt'), 'paper');
                    assert.equal(await page.locator('#preview-grid > .gui-slot').nth(0).locator('img').getAttribute('alt'), 'yellow_stained_glass_pane');
                    assert.equal(await page.locator('#preview-grid > .gui-slot').nth(10).getAttribute('draggable'), 'true');
                    await page.evaluate(() => switchTab('guisettings'));
                    await page.screenshot({ path: path.resolve(__dirname, `../../../target/gui-layout-${process.argv.includes('--mobile') ? 'mobile' : 'desktop'}.png`), fullPage: true });
                    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
                    await page.evaluate(() => switchTab('campaigns'));
                    assert.equal((await page.locator('button[onclick="addCampaignTemplate()"] .btn-icon').textContent()).trim(), '+');
                    await page.evaluate(() => switchTab('commands'));
                    assert.equal((await page.locator('button[onclick="addCustomCommand()"] .btn-icon').textContent()).trim(), '+');
                }
                assert.deepEqual(errors, [], role);
                console.log(`PASS ${role} layout and permissions`);
            } finally { await context.close(); await new Promise(resolve => server.close(resolve)); }
        }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
