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
        const once = server.state().yaml;
        await page.reload();
        await page.waitForFunction(() => !getEditorState('isLoadingFiles'));
        await open();
        await save();
        assert.equal(server.state().yaml, once);
        assert.equal(server.state().saves, 1, 'Unchanged second save should not write again');
        await open();
        await choose('modal-sellAddsToStock', 'Disabled');
        await choose('modal-allowSellStockOverflow', 'Disabled');
        await save();
        assert.equal((await item())['sell-adds-to-stock'], false);
        await open();
        await choose('modal-sellAddsToStock', 'Inherit shop (Enabled)');
        await choose('modal-allowSellStockOverflow', 'Inherit shop (Enabled)');
        await page.locator('#modal-stockResetEnabled').check();
        await choose('modal-stockResetType', 'Second Interval');
        await page.locator('#modal-stockResetInterval').fill('15');
        await save();
        assert.deepEqual(await item(), { material: 'GOLDEN_APPLE', price: 125, 'stock-reset': { enabled: true, type: 'second-interval', interval: 15 } });
        await open();
        await page.locator('#custom-modal-sellAddsToStock').scrollIntoViewIfNeeded();
        await page.waitForFunction(() => document.getElementById('toast-container').childElementCount === 0);
        await page.screenshot({ path: path.resolve(__dirname, `../../../target/sparse-${name}-${viewport.width}.jpg`), type: 'jpeg', quality: 65 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        assert.equal(overflow, false);
        assert.deepEqual(errors, []);
        console.log(`PASS ${name} ${viewport.width}: price-only modal save, POST/reload, inheritance, explicit false, sparse reset, repeated saves, layout`);
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
}
(async () => {
    for (const [type, name] of [[chromium, 'chrome'], [firefox, 'firefox']]) {
        for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) await check(type, name, viewport);
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
