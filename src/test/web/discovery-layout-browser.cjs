const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(path.resolve(__dirname, '../../../target/rendering-tools/node_modules/playwright'));
const { createDraftPreviewServer } = require('./draft-preview-server.cjs');

(async () => {
    const server = createDraftPreviewServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
        const mobile = process.argv.includes('--mobile');
        const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1365, height: 1000 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://**/*', route => route.abort());
        await page.addInitScript(() => {
            localStorage.setItem('autoSaveEnabled', 'false');
            localStorage.setItem('geniusshop:tutorial:v1:preview', JSON.stringify({ firstRunHandled: true, autoNewFeatures: false, sections: {} }));
        });
        await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !getEditorState('isLoadingFiles') && Object.keys(allShops).length > 0);
        const before = { ...server.draftState.workspace };
        await page.evaluate(() => switchTab('guisettings'));
        for (const [mode, rows] of [['search', 3], ['favorites', 4], ['recent', 5]]) {
            await page.locator('#gui-layout-scope').selectOption('discovery:' + mode);
            await page.evaluate(rows => GuiLayout.setRows(rows), rows);
            assert.equal(await page.locator('#gui-layout-preview > button').count(), rows * 9);
            assert.equal(await page.evaluate(() => GuiLayout.targetFile()), 'menus/gui-settings.yml');
            const previewBottom = await page.locator('.gui-layout-chest').evaluate(node => node.getBoundingClientRect().bottom);
            assert.ok(await page.locator('#gui-button-editor').evaluate(node => node.getBoundingClientRect().top) >= previewBottom, 'Button cards belong below the preview');
            assert.equal(await page.locator('.gui-control-cards .gui-control-icon img').count(), 6);
            assert.equal(await page.locator('.gui-control-cards button').filter({ hasText: 'Material:' }).count(), 6);
            assert.equal(await page.locator('#gui-layout-preview [data-discovery-empty="' + mode + '"]').count(), 1);
            assert.equal(await page.locator('#gui-layout-preview img[alt="stone"]').count(), 0, 'Discovery menus must not borrow last shop products');
            assert.equal(await page.getByRole('heading', { name: 'Item Lore Price Lines', exact: true }).isVisible(), true);
            assert.equal(await page.getByRole('heading', { name: 'Special Item Lines', exact: true }).isVisible(), true);
            assert.equal(await page.getByRole('heading', { name: 'Economy Safety Guards', exact: true }).isVisible(), true);
        }
        const aligned = await page.locator('.gui-layout-actions').evaluateAll(groups => groups.every(group => {
            const input = group.querySelector('select').getBoundingClientRect();
            return Array.from(group.querySelectorAll('button')).every(button => {
                const bounds = button.getBoundingClientRect();
                return Math.abs(bounds.bottom - input.bottom) <= 2 || bounds.top >= input.bottom;
            });
        }));
        assert.equal(aligned, true, 'Layout action buttons must align with inputs or wrap below');
        await page.locator('#gui-layout-scope').selectOption('discovery:search');
        await page.getByRole('button', { name: 'SELECT / EDIT', exact: true }).click();
        await page.locator('#gui-layout-preview > button').nth(0).click();
        assert.equal(await page.locator('#edit-modal').isVisible(), false, 'Sample product clicks must not edit products');
        await page.locator('#gui-layout-preview > button').nth(18).click();
        await page.locator('#material').fill('PAPER');
        await page.locator('#edit-modal button[onclick="saveEditModal()"]').click();
        assert.equal(await page.locator('#gui-layout-preview img[alt="paper"]').count(), 1);
        await page.getByRole('button', { name: 'EDIT FILLER', exact: true }).click();
        await page.locator('#enabled').check();
        await page.locator('#edit-modal button[onclick="saveEditModal()"]').click();
        await page.getByRole('button', { name: 'FILLER', exact: true }).click();
        await page.locator('#gui-layout-preview > button').nth(1).click();
        assert.equal(await page.locator('#gui-layout-preview > button').nth(1).locator('img[alt="yellow_stained_glass_pane"]').count(), 1);
        await page.getByRole('button', { name: 'EMPTY / AIR', exact: true }).click();
        await page.locator('#gui-layout-preview > button').nth(2).click();
        assert.equal(await page.locator('#gui-layout-preview > button').nth(2).locator('img').count(), 0);
        await page.getByRole('button', { name: 'SELECT / EDIT', exact: true }).click();
        const colors = await page.locator('#gui-layout-preview > button').evaluateAll(nodes => [0, 1, 2, 18].map(slot => getComputedStyle(nodes[slot]).backgroundColor));
        assert.equal(new Set(colors).size, 4, 'Item area, filler, air and buttons stay distinct in Select / Edit mode');
        await page.evaluate(async () => { await saveCurrentTabChanges(true); });
        const after = server.draftState.workspace;
        for (const file of Object.keys(before).filter(file => file !== 'menus/gui-settings.yml')) assert.equal(after[file], before[file], file + ' must be unchanged');
        assert.match(after['menus/gui-settings.yml'], /discovery:/);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !getEditorState('isLoadingFiles') && guiSettings.discovery?.search?.rows === 3);
        await page.evaluate(() => switchTab('guisettings'));
        for (const [mode, rows] of [['favorites', 4], ['recent', 5], ['search', 3]]) {
            await page.locator('#gui-layout-scope').selectOption('discovery:' + mode);
            assert.equal(await page.locator('#gui-layout-preview > button').count(), rows * 9);
        }
        assert.equal(await page.locator('#gui-layout-preview img[alt="paper"]').count(), 1);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
        await page.screenshot({ path: path.resolve(__dirname, '../../../target/discovery-layout-' + (mobile ? 'mobile' : 'desktop') + '.png'), fullPage: true });
        await page.getByRole('button', { name: 'RESET LAYOUT', exact: true }).click();
        assert.equal(await page.evaluate(() => guiSettings.discovery.search), null);
        assert.equal(await page.evaluate(() => guiSettings.discovery.favorites.rows), 4);
        await page.evaluate(() => { GuiLayout.selectScope(currentShopFile); updateGuiSetting('itemLore', 'buyPriceLine', 'Restored global setting'); });
        await page.locator('button[onclick="manualSave()"]').click();
        await page.locator('#save-confirmation-modal').waitFor({ state: 'visible' });
        assert.ok((await page.locator('#save-confirmation-content').innerText()).includes('Restored global setting'));
        await page.locator('#save-confirmation-modal button[onclick="confirmSave()"]').click();
        await page.waitForFunction(() => !isSaving);
        assert.match(server.draftState.workspace['menus/gui-settings.yml'], /Restored global setting/);
        await page.locator('#save-confirmation-modal').waitFor({ state: 'hidden' });
        await page.evaluate(() => { closeAlertModal(); EditorShortcuts.open(); });
        const modalBounds = await page.locator('#editor-shortcuts').boundingBox();
        const viewport = page.viewportSize();
        assert.ok(Math.abs(modalBounds.x + modalBounds.width / 2 - viewport.width / 2) < 2);
        assert.ok(Math.abs(modalBounds.y + modalBounds.height / 2 - viewport.height / 2) < 2);
        await page.screenshot({ path: path.resolve(__dirname, '../../../target/shortcuts-centered-' + (mobile ? 'mobile' : 'desktop') + '.png') });
        await page.locator('#editor-shortcuts button[aria-label="Close shortcuts"]').click();
        assert.deepEqual(errors, []);
        console.log('PASS independent discovery layouts, safe preview edits, isolated saves, reload and reset ' + (mobile ? 'mobile' : 'desktop'));
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
