const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium, firefox } = require(path.resolve(__dirname, '../../../target/rendering-tools/node_modules/playwright'));
const { createDraftPreviewServer } = require('./draft-preview-server.cjs');

(async () => {
    const server = createDraftPreviewServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = process.argv.includes('--firefox') ? await firefox.launch({ headless: true }) :
            await chromium.launch({ channel: 'chrome', headless: true });
        const context = await browser.newContext({ viewport: process.argv.includes('--mobile') ? { width: 390, height: 844 } : { width: 1365, height: 900 } });
        const page = await context.newPage();
        page.setDefaultTimeout(10000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://**/*', route => route.abort());
        await page.addInitScript(() => {
            localStorage.setItem('geniusshop:tutorial:v1:preview', JSON.stringify({ firstRunHandled: true, autoNewFeatures: false, sections: {} }));
            localStorage.setItem('autoSaveEnabled', 'false');
        });
        await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !getEditorState('isLoadingFiles') && Object.keys(allShops).length > 0);
        const state = server.draftState;
        const baseline = { ...state.live };
        await page.evaluate(async () => {
            items[0].price = 123;
            await saveCurrentShop(true);
        });
        assert.deepEqual(state.live, baseline, 'Saving a draft never changes live files');
        assert.match(await page.locator('#draft-status').textContent(), /changed file/);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !getEditorState('isLoadingFiles') && items[0]?.price === 123);
        const stagedShop = state.workspace['shops/blocks.yml'];
        // Autosave remains draft-only even for a previous user's publish preference.
        await page.evaluate(() => {
            localStorage.setItem('autoSaveEnabled', 'true');
            localStorage.setItem('autoSaveMode', 'publish');
            items[0].price = 124;
            switchTab('shop');
            scheduleEditorAutoSave();
        });
        await page.waitForTimeout(2400);
        assert.equal(state.publishes, 0);
        assert.notEqual(state.workspace['shops/blocks.yml'], stagedShop);
        await page.evaluate(() => localStorage.setItem('autoSaveEnabled', 'false'));
        // A late save response belongs to its original file, not whichever shop is now visible.
        let releaseSave, saveRequested;
        const heldSave = new Promise(resolve => { releaseSave = resolve; });
        const requestStarted = new Promise(resolve => { saveRequested = resolve; });
        await page.route('**/api/file/shops/blocks.yml', async route => {
            const response = await route.fetch();
            saveRequested();
            await heldSave;
            await route.fulfill({ response });
        });
        await page.evaluate(() => {
            allShops['other.yml'] = 'rows: 3\nitems: []\n';
            items[0].price = 126;
            window.pendingDraftSave = saveCurrentShop(true);
            switchShop('other.yml');
        });
        await requestStarted;
        await page.evaluate(() => {
            switchShop('blocks.yml');
            items[0].price = 127;
            switchShop('other.yml');
        });
        releaseSave();
        await page.evaluate(() => window.pendingDraftSave);
        assert.equal(await page.evaluate(() => items.length), 0);
        await page.evaluate(() => switchShop('blocks.yml'));
        assert.equal(await page.evaluate(() => items[0].price), 127);
        await page.unroute('**/api/file/shops/blocks.yml');
        // Preserve local changes in multiple shop files when switching and reviewing.
        await page.evaluate(() => {
            allShops['other.yml'] = 'rows: 3\nitems: []\n';
            items[0].price = 125;
            switchShop('other.yml');
            switchShop('blocks.yml');
        });
        assert.equal(await page.evaluate(() => items[0].price), 125);
        await page.locator('button[onclick="publishChanges()"]').click();
        const review = page.locator('#draft-review');
        await review.getByText('Validation passed', { exact: true }).waitFor();
        assert.equal(state.publishes, 0, 'Opening review is not publishing');
        assert.deepEqual(state.live, baseline);
        assert.equal(await page.evaluate(() => getEditorState('autoSaveTimeout')), null);
        await review.locator('summary').filter({ hasText: 'shops/blocks.yml' }).click();
        const shopDiff = review.locator('details').filter({ has: page.locator('summary').filter({ hasText: 'shops/blocks.yml' }) });
        assert.equal(await shopDiff.locator('.draft-before pre').textContent(), baseline['shops/blocks.yml']);
        assert.ok(state.workspace['shops/other.yml']);
        const panelBox = await review.boundingBox();
        const viewport = page.viewportSize();
        assert.ok(panelBox.x >= 0 && panelBox.y >= 0 && panelBox.x + panelBox.width <= viewport.width + 1);
        assert.equal(await review.evaluate(node => node.scrollWidth <= node.clientWidth), true);
        await page.screenshot({ path: `target/drafts-${process.argv.includes('--firefox') ? 'firefox' : 'chrome'}-${viewport.width}.png` });
        // Reject a stale review without losing the persisted draft.
        state.version++;
        await review.getByRole('button', { name: 'Publish', exact: true }).click();
        await review.getByText(/Draft changed in another tab/).waitFor();
        assert.equal(await review.getByRole('button', { name: 'Publish', exact: true }).isDisabled(), true);
        assert.deepEqual(state.live, baseline);
        await review.getByRole('button', { name: 'Validate again', exact: true }).click();
        await review.getByText('Validation passed', { exact: true }).waitFor();
        // Failed publication reports rollback, retains the workspace, and requires a new review.
        state.failPublish = true;
        const beforeFailedPublish = { ...state.workspace };
        await review.getByRole('button', { name: 'Publish', exact: true }).click();
        await review.getByText(/previous live configuration was restored/).waitFor();
        assert.deepEqual(state.live, baseline);
        assert.deepEqual(state.workspace, beforeFailedPublish);
        state.failPublish = false;
        state.errors = ['main-menu.items.test: missing shop absent'];
        await review.getByRole('button', { name: 'Validate again', exact: true }).click();
        await review.getByText('Validation failed', { exact: true }).waitFor();
        assert.equal(await review.getByRole('button', { name: 'Publish', exact: true }).isDisabled(), true);
        state.errors = [];
        await review.getByRole('button', { name: 'Validate again', exact: true }).click();
        await review.getByText('Validation passed', { exact: true }).waitFor();
        await review.getByRole('button', { name: 'Publish', exact: true }).click();
        await review.waitFor({ state: 'hidden' });
        assert.equal(state.publishes, 1);
        assert.deepEqual(state.live, state.workspace);
        assert.equal(await page.locator('#draft-status').textContent(), 'Draft matches live');
        // Deletions are reviewed and persisted, not applied live until publication.
        await page.evaluate(async () => { await EditorDrafts.request('api/file/shops/other.yml', { method: 'DELETE' }); });
        assert.ok(state.live['shops/other.yml']);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !getEditorState('isLoadingFiles') && Object.keys(allShops).length > 0);
        await page.locator('button[onclick="publishChanges()"]').click();
        await review.getByText('Validation passed', { exact: true }).waitFor();
        assert.equal(await review.locator('.draft-kind.deleted').count(), 1);
        page.once('dialog', confirmation => confirmation.accept());
        await review.getByRole('button', { name: 'Discard draft', exact: true }).click();
        await review.waitFor({ state: 'hidden' });
        assert.deepEqual(state.live, state.workspace);
        assert.deepEqual(errors, []);
        console.log('Draft browser checks passed: persistence, draft-only autosave, full review, stale reviews, rollback errors, validation, explicit publish, deletions and discard.');
        await context.close();
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
