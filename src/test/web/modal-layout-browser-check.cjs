const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium, firefox } = require(path.resolve(__dirname, '../../../target/rendering-tools/node_modules/playwright'));
const { start } = require('./sparse-preview-server.cjs');

async function check(type, name, width, motion) {
    const server = await start();
    const browser = await type.launch({ headless: true, ...(name === 'chrome' ? { channel: 'chrome' } : {}) });
    try {
        const page = await browser.newPage({ viewport: { width, height: 900 },
            reducedMotion: motion === 'reduced' ? 'reduce' : 'no-preference' });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(disabled => localStorage.setItem('animationsEnabled', disabled ? 'false' : 'true'), motion === 'off');
        await page.route('https://**/*', route => route.abort());
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.waitForFunction(() => typeof getEditorState === 'function' && !getEditorState('isLoadingFiles'));
        await page.evaluate(() => {
            globalCampaigns = [{ key: 'browser-sale', name: 'Browser sale', start: '2020-01-01 00:00',
                end: '2099-01-01 00:00', buyMultiplier: 0.5, sellMultiplier: 2 }];
            openShopItemModal(items[0].id);
        });
        await page.locator('#edit-modal').waitFor({ state: 'visible' });
        await page.waitForTimeout(300);
        const groupOrder = await page.locator('#modal-content .checkbox-group-title').allTextContents();
        assert.ok(groupOrder.indexOf('Stock & Reset') < groupOrder.indexOf('Display Flags'));
        assert.equal(await page.locator('#modal-content .checkbox-grid').count(), 0);
        const sections = await page.locator('.modal-option-section').evaluateAll(elements => elements.map(element => {
            const rect = element.getBoundingClientRect();
            const parent = element.parentElement.getBoundingClientRect();
            return { width: rect.width, parentWidth: parent.width };
        }));
        for (const section of sections) assert.ok(Math.abs(section.width - section.parentWidth) < 2);
        const order = await page.locator('#modal-content .form-group').evaluateAll(elements => elements.map(element => element.id));
        assert.equal(order.length, new Set(order).size, 'Rendered field IDs must be unique');
        assert.equal(await page.locator('#modal-enableDynamicPricing').count(), 1);
        assert.equal(await page.locator('#modal-name').getAttribute('type'), 'text');
        assert.equal(await page.locator('#modal-price').getAttribute('type'), 'number');
        assert.ok(order.indexOf('group-modal-name') < order.indexOf('group-modal-enableLore'));
        assert.ok(order.indexOf('group-modal-enableEnchantments') < order.indexOf('group-modal-price'));
        assert.ok(order.indexOf('group-modal-sellPrice') < order.indexOf('group-modal-enableDynamicPricing'));
        assert.ok(order.indexOf('group-modal-buyPriceFormula') < order.indexOf('group-modal-enableLimits'));
        assert.equal(await page.locator('#modal-campaignStart').count(), 0);
        await page.screenshot({ path: `target/item-editor-${name}-${width}-${motion}.jpg` });
        for (const id of ['modal-enableLimits', 'modal-stockResetEnabled', 'modal-enableLore',
            'modal-enableEnchantments', 'modal-campaignEnabled', 'modal-enableConditions', 'modal-enableCommands',
            'modal-enableDynamicPricing', 'modal-enablePermission', 'modal-enableIdentifiers']) {
            for (const checked of [true, false]) {
                const result = await page.evaluate(async ({ id, checked }) => {
                    const input = document.getElementById(id);
                    const content = document.getElementById('modal-content');
                    input.scrollIntoView({ block: 'center' });
                    await new Promise(requestAnimationFrame);
                    await new Promise(requestAnimationFrame);
                    content.scrollTop += input.getBoundingClientRect().top - content.getBoundingClientRect().top - 80;
                    await new Promise(requestAnimationFrame);
                    const before = input.getBoundingClientRect().top;
                    if (input.checked !== checked) input.click();
                    const animated = content.getAnimations({ subtree: true }).some(animation => animation.id === 'modal-field-reveal');
                    let drift = 0;
                    const trace = [];
                    const end = performance.now() + 260;
                    while (performance.now() < end) {
                        await new Promise(requestAnimationFrame);
                        drift = Math.max(drift, Math.abs(input.getBoundingClientRect().top - before));
                        if (trace.length < 3) trace.push({ before, top: input.getBoundingClientRect().top,
                            scroll: content.scrollTop, height: content.scrollHeight, client: content.clientHeight,
                            min: content.firstElementChild.style.minHeight, layoutHeight: content.firstElementChild.getBoundingClientRect().height,
                            spacer: content.querySelector('.modal-scroll-spacer')?.offsetHeight });
                    }
                    return { drift, animated, trace };
                }, { id, checked });
                assert.ok(result.drift < 3, `${name}/${width}/${motion}/${id}/${checked}: ${JSON.stringify(result)}`);
                if (motion !== 'on') assert.equal(result.animated, false);
                if (id === 'modal-enableLimits' && checked) {
                    assert.equal(result.animated, motion === 'on');
                    assert.equal(await page.locator('#group-modal-showStockResetTimer').isVisible(), false);
                    // Test the nested reset toggle before disabling its parent.
                    await page.locator('#modal-stockResetEnabled').check();
                    await page.locator('#group-modal-showStockResetTimer').waitFor({ state: 'visible' });
                    await page.locator('#modal-showStockResetTimer').check();
                    await page.locator('#modal-stockResetEnabled').uncheck();
                    assert.equal(await page.locator('#group-modal-showStockResetTimer').isVisible(), false);
                    assert.equal(await page.locator('#modal-showStockResetTimer').isChecked(), true);
                    await page.locator('#modal-stockResetEnabled').check();
                    await page.waitForTimeout(220);
                }
            }
            if (id === 'modal-enableLimits') {
                await page.locator('#modal-enableLimits').check();
                await page.waitForTimeout(220);
            }
        }
        const beforeReclaim = await page.evaluate(async () => {
            const input = document.getElementById('modal-enableIdentifiers');
            const content = document.getElementById('modal-content');
            input.click();
            await new Promise(resolve => setTimeout(resolve, 240));
            input.scrollIntoView({ block: 'center' });
            await new Promise(requestAnimationFrame);
            content.scrollTop += input.getBoundingClientRect().top - content.getBoundingClientRect().top - 80;
            await new Promise(requestAnimationFrame);
            const top = input.getBoundingClientRect().top;
            input.click();
            await new Promise(resolve => setTimeout(resolve, 260));
            return { drift: Math.abs(input.getBoundingClientRect().top - top),
                reserved: parseFloat(content.firstElementChild.style.minHeight), scroll: content.scrollTop };
        });
        assert.ok(beforeReclaim.drift < 3, 'Collapsing the last controls keeps the toggle steady');
        const afterUp = await page.evaluate(async () => {
            const content = document.getElementById('modal-content');
            content.scrollTop -= 100;
            await new Promise(requestAnimationFrame);
            await new Promise(requestAnimationFrame);
            return { reserved: parseFloat(content.firstElementChild.style.minHeight), scroll: content.scrollTop };
        });
        assert.ok(afterUp.reserved < beforeReclaim.reserved - 90, 'Scrolling up reclaims unused space');
        assert.ok(Math.abs(beforeReclaim.scroll - afterUp.scroll - 100) < 3, 'Reclaiming space does not move the viewport');
        await page.locator('#modal-content').hover();
        await page.mouse.wheel(0, 500);
        await page.waitForTimeout(200);
        assert.equal(await page.locator('#modal-content').evaluate(content => content.firstElementChild.style.minHeight), '',
            'Scrolling toward the bottom releases the temporary buffer');
        await page.screenshot({ path: `target/modal-reclaimed-${name}-${width}-${motion}.jpg` });
        await page.locator('#modal-enableLimits').check();
        await page.locator('#modal-stockResetEnabled').check();
        await page.locator('#modal-enableDynamicPricing').check();
        await page.locator('#modal-buyPriceFormula').fill('base * 2');
        assert.equal(await page.locator('#modal-dynamicPricing').isChecked(), false);
        await page.locator('#modal-campaignEnabled').check();
        await page.locator('#custom-modal-campaignKey .custom-select-trigger').click();
        await page.locator('#custom-modal-campaignKey .custom-select-option').getByText('browser-sale - Browser sale', { exact: true }).click();
        assert.match(await page.locator('#modal-side-preview-content').innerText(), /Buy:\s*\$50/);
        await page.locator('#edit-modal button[onclick="saveEditModal()"]').click();
        await page.locator('#edit-modal').waitFor({ state: 'hidden' });
        const saved = await page.evaluate(() => EditorYaml.parse(EditorYaml.writeShop()).items[0]);
        assert.equal(saved.campaign, 'browser-sale');
        assert.equal(saved['campaign-enabled'] ?? false, false);
        assert.equal(saved['buy-price-formula'], 'base * 2');
        assert.equal(saved['dynamic-pricing'] ?? false, false);
        await page.evaluate(() => openShopItemModal(items[0].id));
        assert.equal(await page.locator('#modal-campaignEnabled').isChecked(), true);
        assert.equal(await page.locator('#modal-enableDynamicPricing').isChecked(), true);
        assert.equal(await page.locator('#group-modal-buyPriceFormula').isVisible(), true);
        await page.locator('#modal-enableLimits').check();
        await page.waitForTimeout(220);
        await page.locator('#group-modal-enableLimits').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `target/modal-layout-${name}-${width}-${motion}.jpg` });
        assert.deepEqual(errors, []);
        console.log(`${name} ${width} ${motion}: stable toggles passed`);
    } finally {
        await browser.close();
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
}

(async () => {
    for (const [name, type] of [['chrome', chromium], ['firefox', firefox]]) {
        if (process.argv[2] && process.argv[2] !== name) continue;
        for (const width of [1440, 390]) {
            if (process.argv[3] && Number(process.argv[3]) !== width) continue;
            for (const motion of ['on', 'off', 'reduced']) {
                if (process.argv[4] && process.argv[4] !== motion) continue;
                await check(type, name, width, motion);
            }
        }
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
