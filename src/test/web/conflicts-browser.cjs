const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, firefox } = require(path.resolve(__dirname, '../../../target/rendering-tools/node_modules/playwright'));
const { createConflictPreviewServer } = require('./conflict-preview-server.cjs');

(async () => {
    const server = createConflictPreviewServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        const isFirefox = process.argv.includes('--firefox');
        const viewport = process.argv.includes('--narrow') ? { width: 320, height: 568 } : process.argv.includes('--mobile') ? { width: 390, height: 844 } : { width: 1365, height: 900 };
        browser = isFirefox ? await firefox.launch({ headless: true }) : await chromium.launch({ channel: 'chrome', headless: true });
        const errors = [];
        async function editor() {
            const context = await browser.newContext({ viewport });
            const page = await context.newPage();
            page.setDefaultTimeout(10000);
            page.on('pageerror', error => errors.push(error.message));
            await page.route('https://**/*', route => route.request().resourceType() === 'image' ? route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64') }) : route.abort());
            await page.addInitScript(() => {
                localStorage.setItem('autoSaveEnabled', 'false');
                localStorage.setItem('geniusshop:tutorial:v1:preview', JSON.stringify({ firstRunHandled: true, autoNewFeatures: false, sections: {} }));
            });
            await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => !isLoadingFiles && items.length > 0);
            const alignment = await page.evaluate(() => {
                const controls = ['#custom-language-selector .custom-select-trigger', '#editor-tutorial-help', '#user-info'].map(selector => document.querySelector(selector).getBoundingClientRect());
                return { centers: controls.map(rect => rect.y + rect.height / 2),
                    bounds: controls.map(rect => ({ x: rect.x, width: rect.width })),
                    header: document.querySelector('.header-top').getBoundingClientRect().toJSON(),
                    overflow: document.querySelector('.editor-topbar').scrollWidth > document.querySelector('.editor-topbar').clientWidth };
            });
            await page.locator('.editor-topbar').screenshot({ path: `target/header-inline-${viewport.width}.png` });
            assert.ok(Math.max(...alignment.centers) - Math.min(...alignment.centers) < 3, 'Language, Tutorial and User controls share one row');
            assert.equal(alignment.overflow, false, JSON.stringify(alignment));
            assert.ok(alignment.bounds[0].x + alignment.bounds[0].width <= alignment.bounds[1].x, JSON.stringify(alignment));
            await page.evaluate(() => switchTab('shop'));
            return page;
        }
        const a = await editor(), b = await editor();
        const state = server.previewState;
        const original = state.files.get('shops/blocks.yml');
        await b.evaluate(async () => { items[0].price = 20; await saveCurrentShop(true); });
        const savedByB = state.files.get('shops/blocks.yml');
        await a.evaluate(async () => {
            items[0].price = 30;
            mainMenuSettings.title = 'Unsaved menu title';
            setUnsavedChanges([{ target: 'shop-item', details: { shopFile: currentShopFile } }, { target: 'main-menu-settings' }]);
            try { await saveCurrentShop(false); } catch (error) { if (!error.isSaveConflict) throw error; }
        });
        const conflict = a.locator('#save-conflict');
        await conflict.waitFor({ state: 'visible' });
        assert.equal(state.files.get('shops/blocks.yml'), savedByB);
        assert.equal(await a.evaluate(() => items[0].price), 30);
        assert.equal(await a.evaluate(() => unsavedChanges.length), 2);
        assert.match(await conflict.locator('.conflict-comparison pre').nth(0).textContent(), /price: 5/);
        assert.match(await conflict.locator('.conflict-comparison pre').nth(1).textContent(), /price: 20/);
        assert.match(await conflict.locator('.conflict-comparison pre').nth(2).textContent(), /price: 30/);
        for (const column of await conflict.locator('.conflict-comparison pre').allTextContents()) {
            assert.match(column, /material: STONE/);
            assert.ok(!column.includes('COBBLESTONE'));
            assert.ok(!column.includes('sell-price:'));
        }
        assert.deepEqual((await conflict.locator('.conflict-line-changed').allTextContents()).map(line => line.trim()), ['price: 5', 'price: 20', 'price: 30']);
        await conflict.getByRole('button', { name: 'Show full files', exact: true }).click();
        assert.equal(await conflict.locator('.conflict-comparison pre').nth(0).textContent(), original.replace(/\r\n/g, '\n'));
        assert.equal(await conflict.locator('.conflict-comparison pre').nth(1).textContent(), savedByB.replace(/\r\n/g, '\n'));
        await conflict.getByRole('button', { name: 'Show differences only', exact: true }).click();
        const box = await conflict.boundingBox();
        assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1);
        assert.equal(await conflict.evaluate(node => node.scrollWidth <= node.clientWidth), true);
        await a.screenshot({ path: `target/conflicts-${isFirefox ? 'firefox' : 'chrome'}-${viewport.width}.png` });
        await conflict.getByRole('button', { name: 'Keep editing', exact: true }).click();
        const writes = state.writes;
        await a.evaluate(() => {
            items[0].price = 31;
            localStorage.setItem('autoSaveEnabled', 'true');
            localStorage.setItem('autoSaveMode', 'publish');
            scheduleEditorAutoSave();
        });
        await a.waitForTimeout(2150);
        assert.equal(state.writes, writes, 'Unresolved conflicts pause autosave, including publish mode');
        await a.locator('#save-conflict-notice').click();
        assert.match(await conflict.locator('.conflict-comparison pre').nth(2).textContent(), /price: 31/);
        const downloadEvent = a.waitForEvent('download');
        await conflict.getByRole('button', { name: 'Download local', exact: true }).click();
        const download = await downloadEvent;
        const downloaded = fs.readFileSync(await download.path(), 'utf8');
        assert.match(downloaded, /price: 31/);
        assert.match(downloaded, /COBBLESTONE/);
        await conflict.getByRole('button', { name: 'Reconcile', exact: true }).click();
        const reconciled = '# local reconciliation\n' + await a.locator('#conflict-merged').inputValue();
        await a.locator('#conflict-merged').fill(reconciled);
        await b.evaluate(async () => { items[0].price = 22; items[0].name = 'Remote name'; await saveCurrentShop(true); });
        await conflict.getByRole('button', { name: 'Save reconciled', exact: true }).click();
        await conflict.getByText(/server file changed again/).waitFor();
        assert.equal(await a.locator('#conflict-merged').inputValue(), reconciled);
        assert.match(await conflict.locator('.conflict-comparison pre').nth(1).textContent(), /Remote name/);
        const merged = '# reconciled both changes\n' + state.files.get('shops/blocks.yml').replace('price: 22', 'price: 34');
        await a.evaluate(() => localStorage.setItem('autoSaveEnabled', 'false'));
        await a.locator('#conflict-merged').fill(merged);
        await conflict.getByRole('button', { name: 'Save reconciled', exact: true }).click();
        await conflict.waitFor({ state: 'hidden' });
        assert.equal(await a.evaluate(() => items[0].price), 34);
        assert.equal(await a.evaluate(() => items[0].name), 'Remote name');
        assert.equal(await a.evaluate(() => mainMenuSettings.title), 'Unsaved menu title');
        assert.deepEqual(await a.evaluate(() => unsavedChanges.map(change => change.target)), ['main-menu-settings']);
        assert.equal(state.files.get('shops/blocks.yml'), merged);
        assert.equal(await a.locator('#save-conflict-notice').isVisible(), false);
        await a.evaluate(() => localStorage.setItem('autoSaveEnabled', 'false'));
        // An external file edit is detected, and targeted reload leaves unrelated local edits alone.
        state.files.set('shops/blocks.yml', merged.replace('price: 34', 'price: 40'));
        await a.evaluate(async () => { items[0].price = 35; try { await saveCurrentShop(true); } catch (error) { if (!error.isSaveConflict) throw error; } });
        a.once('dialog', confirmation => confirmation.accept());
        await conflict.getByRole('button', { name: 'Reload latest', exact: true }).click();
        await conflict.waitFor({ state: 'hidden' });
        assert.equal(await a.evaluate(() => items[0].price), 40);
        assert.equal(await a.evaluate(() => mainMenuSettings.title), 'Unsaved menu title');
        assert.equal(await a.evaluate(() => unsavedChanges.length), 1);
        // External deletion is a conflicting revision, not permission to recreate the file silently.
        state.files.delete('shops/blocks.yml');
        await a.evaluate(async () => { items[0].price = 41; try { await saveCurrentShop(true); } catch (error) { if (!error.isSaveConflict) throw error; } });
        assert.equal(await a.evaluate(() => items[0].price), 41);
        assert.equal(state.files.has('shops/blocks.yml'), false);
        a.once('dialog', confirmation => confirmation.accept());
        await conflict.getByRole('button', { name: 'Reload latest', exact: true }).click();
        await conflict.waitFor({ state: 'hidden' });
        assert.equal(await a.evaluate(() => Object.hasOwn(allShops, 'blocks.yml')), false);
        assert.equal(await a.evaluate(() => currentShopFile), 'misc.yml');
        // A name created by another admin after page load cannot be overwritten by new-shop creation.
        state.files.set('shops/collision.yml', 'rows: 3\nitems: [{material: STONE, price: 99}]\n');
        await a.evaluate(async () => {
            allShops['collision.yml'] = 'rows: 3\nitems: [{material: STONE, price: 77}]\n';
            switchShop('collision.yml');
            try { await saveCurrentShop(true); } catch (error) { if (!error.isSaveConflict) throw error; }
        });
        assert.match(state.files.get('shops/collision.yml'), /price: 99/);
        assert.equal(await a.evaluate(() => items[0].price), 77);
        a.once('dialog', confirmation => confirmation.accept());
        await conflict.getByRole('button', { name: 'Reload latest', exact: true }).click();
        await conflict.waitFor({ state: 'hidden' });
        assert.equal(await a.evaluate(() => items[0].price), 99);
        state.files.set('config.yml', JSON.stringify({ enabled: true, maxUnitPrice: 11 }, null, 2));
        await a.evaluate(async () => { economySafetySettings.maxUnitPrice = 12; try { await saveEconomySafetySettings(true); } catch (error) { if (!error.isSaveConflict) throw error; } });
        await conflict.getByRole('button', { name: 'Reconcile', exact: true }).click();
        await a.locator('#conflict-merged').fill(JSON.stringify({ enabled: true, maxUnitPrice: 13 }));
        await conflict.getByRole('button', { name: 'Save reconciled', exact: true }).click();
        await conflict.waitFor({ state: 'hidden' });
        assert.equal(await a.evaluate(() => economySafetySettings.maxUnitPrice), 13);
        assert.equal(JSON.parse(state.files.get('config.yml')).maxUnitPrice, 13);
        assert.equal(await a.evaluate(() => mainMenuSettings.title), 'Unsaved menu title');
        // An older successful response must not clear a conflict raised by a newer request.
        const c = await editor();
        await c.evaluate(() => switchShop('collision.yml'));
        let releaseOldSave, oldSaveStarted;
        const held = new Promise(resolve => { releaseOldSave = resolve; });
        const started = new Promise(resolve => { oldSaveStarted = resolve; });
        let first = true;
        await c.route('**/api/file/shops/collision.yml', async route => {
            if (!first) return route.continue();
            first = false;
            const response = await route.fetch();
            oldSaveStarted();
            await held;
            await route.fulfill({ response });
        });
        await c.evaluate(() => {
            items[0].price = 100;
            window.oldSave = EditorRevisions.request('api/file/shops/collision.yml', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: EditorYaml.writeShop() })
            });
        });
        await started;
        await c.evaluate(async () => {
            items[0].price = 101;
            try { await EditorRevisions.request('api/file/shops/collision.yml', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: EditorYaml.writeShop() })
            }); } catch (error) { if (!error.isSaveConflict) throw error; }
        });
        releaseOldSave();
        await c.evaluate(async () => { await window.oldSave; });
        assert.equal(await c.evaluate(() => EditorRevisions.hasPending()), true);
        assert.equal(await c.evaluate(() => items[0].price), 101);
        assert.equal(await c.locator('#save-conflict-notice').isVisible(), true);
        assert.deepEqual(errors, []);
        console.log(`Conflict checks passed in ${isFirefox ? 'Firefox' : 'Chrome'} at ${viewport.width}px: two admins, external edits/deletes, creation collisions, late responses, local downloads, repeated conflicts, reconciliation, targeted reload, economy settings and paused autosave.`);
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
