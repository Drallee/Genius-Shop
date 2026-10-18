const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium, firefox } = require(path.resolve(__dirname, '../../../target/rendering-tools/node_modules/playwright'));
const { createDraftPreviewServer } = require('./draft-preview-server.cjs');

(async () => {
    const mobile = process.argv.includes('--mobile');
    const browser = process.argv.includes('--firefox') ? await firefox.launch({ headless: true }) :
        await chromium.launch({ channel: 'chrome', headless: true });
    try {
        for (const role of process.argv.includes('--denied-only') ? [] : ['analytics', 'database', 'commands', 'drafts', 'publish', 'maintainer', 'admin']) {
            const permissions = role === 'maintainer' ? { drafts: true, publish: true } : { [role]: true };
            const server = createDraftPreviewServer({ permissions, readOnlyFiles: role === 'drafts' ? ['shops/blocks.yml'] : [] });
            await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
            const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1365, height: 900 } });
            try {
                const page = await context.newPage();
                const errors = [], denied = [];
                page.on('pageerror', error => errors.push(error.message));
                page.on('response', response => { if (response.status() === 403) denied.push(response.url()); });
                await page.route('https://**/*', route => route.abort());
                await page.addInitScript(() => {
                    localStorage.setItem('autoSaveEnabled', 'false');
                    localStorage.setItem('geniusshop:tutorial:v1:preview', JSON.stringify({ firstRunHandled: true, autoNewFeatures: false, sections: {} }));
                });
                await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'domcontentloaded' });
                await page.waitForFunction(() => !getEditorState('isLoadingFiles') && document.body.classList.contains('permissions-ready'));
                const expected = ['admin', 'publish', 'maintainer'].includes(role) ? ['mainmenu', 'shop', 'purchase', 'sell', 'campaigns', 'commands', 'customitems', 'salesanalytics', 'stockanalytics', 'dataeditor', 'guisettings'] :
                    role === 'analytics' ? ['salesanalytics', 'stockanalytics'] : role === 'database' ? ['dataeditor'] : role === 'commands' ? ['commands'] :
                    ['mainmenu', 'shop', 'purchase', 'sell', 'campaigns', 'commands', 'customitems', 'guisettings'];
                assert.deepEqual(await page.locator('.sidebar-tabs .tab:not([hidden])').evaluateAll(buttons => buttons.map(button => button.dataset.tab).sort()), expected.toSorted(), role);
                assert.equal(await page.locator('.sticky-footer-actions button[onclick="openActivityLogModal()"]').isVisible(), role === 'admin');
                const review = page.locator('button[onclick="publishChanges()"]');
                if (role === 'analytics' || role === 'database') assert.equal(await review.isVisible(), false);
                else {
                    assert.match(await review.textContent(), permissions.publish || permissions.admin ? /PUBLISH/ : /REVIEW DRAFT/);
                    if (role === 'drafts') {
                        await page.evaluate(() => switchTab('shop'));
                        assert.equal(await page.locator('#items-container').evaluate(node => node.inert), true);
                        assert.equal(await page.locator('.minecraft-preview-section').evaluate(node => node.inert), true);
                        await page.locator('#editor-permission-notice').waitFor({ state: 'visible' });
                        assert.equal(await page.locator('button[onclick="manualSave()"]').isVisible(), false);
                        await page.evaluate(() => EditorTutorial.open());
                        const tour = page.locator('#editor-tutorial');
                        assert.equal(await tour.getByRole('button', { name: /^Commands/ }).count(), 1);
                        await tour.getByRole('button', { name: /^Shop items/ }).click();
                        await page.waitForFunction(() => EditorTutorialPractice.isActive());
                        assert.equal(await page.locator('.minecraft-preview-section').evaluate(node => node.inert), false);
                        await page.keyboard.press('Escape');
                        assert.equal(await page.locator('#items-container').evaluate(node => node.inert), true);
                        await page.evaluate(() => switchTab('mainmenu'));
                    }
                    if (role === 'drafts' || role === 'maintainer' || role === 'commands' || role === 'admin') {
                        await review.click();
                        await page.locator('#draft-review').waitFor({ state: 'visible' });
                        await page.waitForFunction(() => !document.querySelector('#draft-review .draft-review-content').textContent.includes('Validating draft'));
                        assert.equal(await page.locator('#draft-publish').isVisible(), !!(permissions.publish || permissions.admin));
                        const writes = server.draftState.requests;
                        if (role !== 'admin') assert.ok(!writes.includes('/api/economy-safety'));
                        if (role === 'commands') assert.ok(writes.every(url => url === '/api/file/commands.yml'));
                        if (role === 'drafts') assert.ok(writes.includes('/api/file/commands.yml') && !writes.includes('/api/file/shops/blocks.yml'));
                        await page.locator('#draft-review button[aria-label="Close review"]').click();
                    }
                }
                await page.evaluate(() => switchTab('guisettings'));
                if (expected.includes('guisettings')) assert.equal(await page.getByText('Economy Safety Guards', { exact: true }).isVisible(), role === 'admin');
                if (!permissions.drafts && !permissions.admin && !permissions.publish) assert.notEqual(await page.evaluate(() => currentTab), 'guisettings');
                assert.deepEqual(errors, [], role + ': page errors');
                assert.deepEqual(denied, [], role + ': controls must not send forbidden requests');
                const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
                assert.equal(overflow, false, role + ': horizontal overflow');
                if (role === 'maintainer' || role === 'analytics') {
                    await page.screenshot({ path: path.resolve(__dirname, `../../../target/permissions-${role}-${mobile ? 'mobile' : 'desktop'}-${process.argv.includes('--firefox') ? 'firefox' : 'chrome'}.jpg`), quality: 65 });
                }
                if (role === 'maintainer') {
                    const local = await page.evaluate(() => { items[0].price = 987; return allShops[currentShopFile]; });
                    permissions.drafts = false;
                    permissions.database = true;
                    await page.evaluate(() => EditorPermissions.recheck());
                    assert.equal(await page.evaluate(() => EditorPermissions.can('drafts')), false);
                    assert.equal(await page.evaluate(() => EditorPermissions.can('database')), false, 'New grants require loading actual file models');
                    assert.equal(await page.evaluate(() => items[0].price), 987, 'Permission refresh preserves local edits');
                    assert.equal(await page.evaluate(() => allShops[currentShopFile]), local);
                    assert.equal(await page.locator('.minecraft-preview-section').evaluate(node => node.inert), true);
                }
                console.log(`PASS ${role} ${mobile ? 'mobile' : 'desktop'}`);
            } finally { await context.close(); await new Promise(resolve => server.close(resolve)); }
        }
        const server = createDraftPreviewServer();
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        try {
            const page = await browser.newPage();
            page.setDefaultTimeout(5000);
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('https://**/*', route => route.abort());
            await page.route('**/api/files?*', route => route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"Access denied"}' }));
            await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'domcontentloaded' });
            await page.locator('#alert-modal-content').getByText('Access denied', { exact: true }).waitFor({ state: 'visible' });
            assert.deepEqual(errors, []);
            assert.equal(await page.locator('#editor-tutorial-help').isDisabled(), true);
            console.log('PASS denied initial load');
            await page.close();
        } finally { await new Promise(resolve => server.close(resolve)); }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
