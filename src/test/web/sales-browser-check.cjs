const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium, firefox } = require(path.resolve(__dirname, '../../../target/rendering-tools/node_modules/playwright'));
const { start, report } = require('./sales-preview-server.cjs');

async function check(browserType, name, viewport) {
    const browser = await browserType.launch({ headless: true, ...(name === 'chrome' ? { channel: 'chrome' } : {}) });
    const server = await start();
    const page = await browser.newPage({ viewport });
    const failures = [];
    page.on('pageerror', error => failures.push(error.message));
    await page.route('https://**/*', route => route.abort());
    try {
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.waitForFunction(() => typeof getEditorState === 'function' && !getEditorState('isLoadingFiles'));
        if (viewport.width < 901) await page.locator('#navigation-toggle').click();
        await page.locator('[data-tab="salesanalytics"]').click();
        await page.locator('#sales-results').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#sales-totals tr').count(), 3);
        assert.equal(await page.locator('#sales-popular tr').count(), 3);
        assert.equal(await page.locator('.minecraft-preview-section').isVisible(), false);
        assert.equal(await page.locator('.sticky-footer-actions').isVisible(), false);
        await page.locator('#sales-shop').selectOption('id:blocks');
        await page.locator('#sales-results').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#sales-popular tr').count(), 2);
        await page.locator('#sales-item').selectOption('id:stone');
        await page.locator('#sales-price-content').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#sales-prices tr').count(), 24);
        const chart = await page.locator('#sales-chart').evaluate(canvas => {
            const chart = Chart.getChart(canvas);
            const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
            let painted = 0;
            for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) painted++;
            return { painted, series: chart.data.datasets.length, labels: chart.data.labels.length, gaps: chart.data.datasets[0].data.filter(value => value === null).length };
        });
        assert.ok(chart.painted > 2000, JSON.stringify(chart));
        assert.equal(chart.series, 2);
        assert.equal(chart.labels, 30);
        assert.equal(chart.gaps, 18);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        assert.equal(overflow, false, 'Page must not overflow horizontally');
        await page.waitForFunction(() => document.getElementById('toast-container').childElementCount === 0);
        await page.locator('#sales-title').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.resolve(__dirname, `../../../target/sales-${name}-${viewport.width}.jpg`), type: 'jpeg', quality: 65 });
        await page.locator('#sales-chart').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.resolve(__dirname, `../../../target/sales-chart-${name}-${viewport.width}.jpg`), type: 'jpeg', quality: 65 });

        // A late response must not replace a report for newer filters, even if abort is ignored.
        await page.evaluate(() => {
            window.realSalesFetch = window.fetch;
            window.fetch = (url, options) => String(url).includes('api/sales-analytics') ? new Promise(resolve => {
                const delay = String(url).includes('shop=blocks') ? 250 : 10;
                realSalesFetch(url, { ...options, signal: undefined }).then(response => setTimeout(() => resolve(response), delay));
            }) : realSalesFetch(url, options);
        });
        await page.locator('#sales-filters button').click();
        await page.locator('#sales-shop').selectOption('id:minerals');
        await page.locator('#sales-results').waitFor({ state: 'visible' });
        await page.waitForTimeout(350);
        assert.equal(await page.locator('#sales-shop').inputValue(), 'id:minerals');
        assert.match(await page.locator('#sales-popular').textContent(), /diamond/);
        assert.doesNotMatch(await page.locator('#sales-popular').textContent(), /stone/);
        await page.evaluate(() => { window.fetch = window.realSalesFetch; });

        // Server errors hide previous totals; refresh recovers.
        await page.route('**/api/sales-analytics?**', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Ledger unavailable.' }) }));
        await page.locator('#sales-filters button').click();
        await page.waitForFunction(() => document.getElementById('sales-status').dataset.error === 'true');
        assert.equal(await page.locator('#sales-results').isVisible(), false);
        assert.match(await page.locator('#sales-status').textContent(), /Ledger unavailable/);
        await page.unroute('**/api/sales-analytics?**');
        await page.locator('#sales-filters button').click();
        await page.locator('#sales-results').waitFor({ state: 'visible' });

        // Untrusted historical keys render as literal text, never HTML.
        await page.route('**/api/sales-analytics?**', route => {
            const response = report(new URLSearchParams(new URL(route.request().url()).search));
            response.popular[0].item = '<img src=x onerror="window.salesXss=true">';
            route.fulfill({ json: response });
        });
        await page.locator('#sales-filters button').click();
        await page.locator('#sales-results').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#sales-popular img').count(), 0);
        assert.match(await page.locator('#sales-popular').textContent(), /<img/);
        await page.unroute('**/api/sales-analytics?**');

        await page.locator('#sales-through').fill('2020-01-02');
        await page.locator('#sales-from').fill('2020-01-01');
        await page.locator('#sales-filters button').click();
        await page.locator('#sales-results').waitFor({ state: 'visible' });
        assert.match(await page.locator('#sales-popular').textContent(), /No completed/);
        assert.equal(await page.locator('#sales-price-content').isVisible(), false);
        await page.route('**/api/sales-analytics?**', route => route.fulfill({ status: 401, json: {} }));
        await page.locator('#sales-filters button').click();
        await page.waitForFunction(() => document.getElementById('sales-status').dataset.error === 'true');
        assert.match(await page.locator('#sales-status').textContent(), /Sign in again/);
        assert.deepEqual(failures, [], `Browser errors: ${failures.join(', ')}`);
        console.log(`PASS ${name} ${viewport.width}x${viewport.height}: filters, chart pixels/gaps, races, errors, recovery, XSS, empty, session, layout`);
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
}

(async () => {
    fs.mkdirSync(path.resolve(__dirname, '../../../target'), { recursive: true });
    for (const [type, name] of [[chromium, 'chrome'], [firefox, 'firefox']]) {
        for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) await check(type, name, viewport);
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
