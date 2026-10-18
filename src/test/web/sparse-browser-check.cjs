const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium, firefox } = require(path.resolve(__dirname, '../../../target/rendering-tools/node_modules/playwright'));
const { start } = require('./sparse-preview-server.cjs');

async function check(type, name, viewport) {
    const server = await start();
    const browser = await type.launch({ headless: true, ...(name === 'chrome' ? { channel: 'chrome' } : {}) });
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => route.abort());
    const open = () => page.evaluate(() => openShopItemModal(items[0].id));
    const choose = async (id, label) => {
        const control = page.locator(`#custom-${id}`);
        await control.locator('.custom-select-trigger').click();
        await control.locator('.custom-select-option').getByText(label, { exact: true }).click();
    };
    const save = async () => {
        await page.locator('#edit-modal button[onclick="saveEditModal()"]').click();
        await page.locator('#edit-modal').waitFor({ state: 'hidden' });
        await page.evaluate(() => saveCurrentShop(true));
    };
    const item = () => page.evaluate(source => EditorYaml.parse(source).items[0], server.state().yaml);
    try {
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.waitForFunction(() => typeof getEditorState === 'function' && !getEditorState('isLoadingFiles'));
        if (viewport.width < 901) await page.locator('#navigation-toggle').click();
        await page.locator('[data-tab="shop"]').click();
        await open();
        assert.equal(await page.locator('#modal-sellAddsToStock').inputValue(), '');
        assert.equal(await page.locator('#modal-allowSellStockOverflow').inputValue(), '');
        await page.locator('#modal-price').fill('125');
        await save();
        assert.deepEqual(await item(), { material: 'GOLDEN_APPLE', price: 125 });
        assert.match(server.state().yaml, /# Keep this comment/);
        await page.evaluate(() => openActivityDetailModal(activityLog.find(entry => entry.target === 'shop-item').id));
        const itemPanels = await page.locator('.activity-comparison pre').allTextContents();
        assert.match(itemPanels[0], /material: GOLDEN_APPLE/);
        assert.match(itemPanels[0], /price: 100/);
        assert.match(itemPanels[1], /price: 125/);
        for (const panel of itemPanels) assert.doesNotMatch(panel, /itemKey|item-key|campaign-enabled|stock-reset|"material"|fileName|buy-price-per-item/);
        assert.equal(await page.evaluate(() => currentViewedEntry.beforeData.buyPricePerItem), true);
        assert.equal(await page.evaluate(() => currentViewedEntry.details.comparison.before.price), 100);
        await page.screenshot({ path: path.resolve(__dirname, `../../../target/item-history-${name}-${viewport.width}.jpg`), type: 'jpeg', quality: 65 });
        await page.evaluate(() => closeActivityDetailModal());
        await page.locator('#activity-detail-modal').waitFor({ state: 'hidden' });
        const once = server.state().yaml;
        await page.reload();
        await page.waitForFunction(() => !getEditorState('isLoadingFiles'));
        await open();
        await save();
        assert.equal(server.state().yaml, once);
        assert.equal(server.state().saves, 1, 'Unchanged second save should not write again');
        await open();
        await page.locator('#modal-enableLimits').check();
        await choose('modal-sellAddsToStock', 'Disabled');
        await choose('modal-allowSellStockOverflow', 'Disabled');
        await save();
        assert.equal((await item())['sell-adds-to-stock'], false);
        await open();
        await page.locator('#modal-enableLimits').check();
        await choose('modal-sellAddsToStock', 'Inherit shop (Enabled)');
        await choose('modal-allowSellStockOverflow', 'Inherit shop (Enabled)');
        await page.locator('#modal-stockResetEnabled').check();
        await choose('modal-stockResetType', 'Second Interval');
        await page.locator('#modal-stockResetInterval').fill('15');
        await save();
        assert.deepEqual(await item(), { material: 'GOLDEN_APPLE', price: 125, 'stock-reset': { enabled: true, type: 'second-interval', interval: 15 } });
        await open();
        await page.locator('#modal-enableLimits').check();
        await page.locator('#custom-modal-sellAddsToStock').scrollIntoViewIfNeeded();
        await page.waitForFunction(() => document.getElementById('toast-container').childElementCount === 0);
        await page.screenshot({ path: path.resolve(__dirname, `../../../target/sparse-${name}-${viewport.width}.jpg`), type: 'jpeg', quality: 65 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        assert.equal(overflow, false);
        await page.evaluate(() => {
            closeEditModal();
            const before = 'items:\n  - {material: STONE, amount: 16}\n  - {material: COBBLESTONE, amount: 32}\n  - {material: DIRT, amount: 32}\n';
            activityLog = [{ id: 100, action: 'updated', target: 'file', timestamp: Date.now(),
                beforeData: { fileName: 'shops/blocks.yml', content: before },
                afterData: { fileName: 'shops/blocks.yml', content: before.replace('amount: 16', 'amount: 32') } }];
            openActivityDetailModal(100);
        });
        const panels = await page.locator('.activity-comparison pre').allTextContents();
        assert.equal(panels.length, 2);
        assert.match(panels[0], /amount: 16/);
        assert.match(panels[1], /amount: 32/);
        for (const panel of panels) {
            assert.match(panel, /STONE/);
            assert.doesNotMatch(panel, /COBBLESTONE|DIRT|\\n|"amount"|fileName/);
        }
        assert.equal(await page.evaluate(() => currentViewedEntry.beforeData.content.includes('COBBLESTONE')), true);
        assert.equal(await page.evaluate(() => currentViewedEntry === activityLog[0]), true);
        await page.screenshot({ path: path.resolve(__dirname, `../../../target/activity-${name}-${viewport.width}.jpg`), type: 'jpeg', quality: 65 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        assert.deepEqual(errors, []);
        console.log(`PASS ${name} ${viewport.width}: sparse saves, inheritance, repeated saves, changed-item history, intact rollback snapshots, layout`);
    } finally {
        await browser.close();
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
}
(async () => {
    for (const [type, name] of [[chromium, 'chrome'], [firefox, 'firefox']]) {
        if (process.argv[2] && process.argv[2] !== name) continue;
        for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
            if (process.argv[3] && Number(process.argv[3]) !== viewport.width) continue;
            await check(type, name, viewport);
        }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
