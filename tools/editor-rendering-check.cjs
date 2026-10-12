const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { chromium } = require('../target/rendering-tools/node_modules/playwright');

const label = process.argv[2] || 'after';
const baselineRef = process.argv[3] || 'HEAD';
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'target', 'editor-rendering');
const baselinePaths = new Set(['index.html', 'style.css', 'navigation.css', 'editor-design.css', 'js/events.js', 'js/api.js', 'js/navigation.js']);
fs.mkdirSync(output, { recursive: true });
const server = spawn(process.execPath, [path.join(__dirname, 'preview-server.cjs'), '8796'], { windowsHide: true });
const ready = new Promise((resolve, reject) => {
    server.stdout.once('data', resolve);
    server.once('error', reject);
    server.once('exit', code => reject(new Error(`Preview server exited: ${code}`)));
});

async function measure(browser, viewport, collapsed) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({ collapsed }) => {
        localStorage.setItem('sessionToken', 'standalone-preview');
        localStorage.setItem('username', 'Preview');
        localStorage.setItem('editor-navigation-collapsed', String(collapsed));
        window.renderMetrics = { shifts: [], lcp: 0, ready: 0 };
        const ready = setInterval(() => {
            if (typeof isLoadingFiles !== 'undefined' && !isLoadingFiles && document.querySelector('#preview-grid .gui-slot')) {
                window.renderMetrics.ready = performance.now();
                clearInterval(ready);
            }
        }, 10);
        new PerformanceObserver(list => {
            for (const entry of list.getEntries()) {
                if (!entry.hadRecentInput) window.renderMetrics.shifts.push({
                    value: entry.value, time: entry.startTime,
                    sources: entry.sources.map(source => ({
                        node: source.node?.id || source.node?.className,
                        previous: source.previousRect.toJSON(), current: source.currentRect.toJSON()
                    }))
                });
            }
        }).observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver(list => {
            const entry = list.getEntries().at(-1);
            window.renderMetrics.lcp = entry.startTime;
            window.renderMetrics.lcpElement = entry.element?.outerHTML;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
    }, { collapsed });
    await page.route('**/*', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.hostname === '127.0.0.1') {
            const relative = url.pathname.slice(1);
            if (label === 'before' && baselinePaths.has(relative)) {
                const body = execFileSync('git', ['show', `${baselineRef}:src/main/resources/web/${relative}`], { cwd: root });
                if (relative !== 'index.html') await new Promise(resolve => setTimeout(resolve, 120));
                return route.fulfill({ contentType: relative.endsWith('.html') ? 'text/html' : relative.endsWith('.css') ? 'text/css' : 'text/javascript', body });
            }
            // Test the production HTML, without the preview server's initial-tab override.
            if (url.pathname === '/index.html') return route.fulfill({
                contentType: 'text/html', body: fs.readFileSync(path.join(root, 'src/main/resources/web/index.html'), 'utf8')
            });
            await new Promise(resolve => setTimeout(resolve, 120));
            return route.continue();
        }
        // Reuse identical remote assets across runs, including fonts and item textures.
        const key = require('node:crypto').createHash('sha256').update(request.url()).digest('hex');
        const cache = path.join(output, `${key}.json`);
        let response;
        if (fs.existsSync(cache)) response = JSON.parse(fs.readFileSync(cache, 'utf8'));
        else {
            try {
                const remote = await context.request.get(request.url(), { timeout: 15000 });
                response = { status: remote.status(), contentType: remote.headers()['content-type'], body: (await remote.body()).toString('base64') };
                fs.writeFileSync(cache, JSON.stringify(response));
            } catch (error) { return route.abort(); }
        }
        await new Promise(resolve => setTimeout(resolve, 120));
        return route.fulfill({ status: response.status, contentType: response.contentType, body: Buffer.from(response.body, 'base64') });
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Tracing.start', { categories: 'devtools.timeline,loading,blink.user_timing', transferMode: 'ReturnAsStream' });
    await page.goto('http://127.0.0.1:8796/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof isLoadingFiles !== 'undefined' && !isLoadingFiles && document.querySelectorAll('#preview-grid .gui-slot').length > 0);
    await page.waitForTimeout(1500);
    const metrics = await page.evaluate(() => ({
        ...window.renderMetrics,
        fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
        resources: performance.getEntriesByType('resource').map(entry => ({ name: entry.name, blocking: entry.renderBlockingStatus, duration: entry.duration })),
        overflow: document.documentElement.scrollWidth > innerWidth
    }));
    // CLS uses the largest session window: at most 5s, with no gaps over 1s.
    let start = 0, previous = 0, sum = 0, cls = 0;
    for (const shift of metrics.shifts) {
        if (shift.time - previous > 1000 || shift.time - start > 5000) { start = shift.time; sum = 0; }
        sum += shift.value;
        cls = Math.max(cls, sum);
        previous = shift.time;
    }
    metrics.cls = cls;
    metrics.errors = errors;
    const name = `${label}-${viewport.width}${collapsed ? '-collapsed' : ''}`;
    await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
    const complete = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
    await cdp.send('Tracing.end');
    const { stream } = await complete;
    let trace = '';
    while (true) {
        const chunk = await cdp.send('IO.read', { handle: stream });
        trace += chunk.data;
        if (chunk.eof) break;
    }
    await cdp.send('IO.close', { handle: stream });
    fs.writeFileSync(path.join(output, `${name}-trace.json`), trace);
    fs.writeFileSync(path.join(output, `${name}.json`), JSON.stringify(metrics, null, 2));
    console.log(JSON.stringify({ name, fcp: metrics.fcp, lcp: metrics.lcp, ready: metrics.ready, cls, blocking: metrics.resources.filter(r => r.blocking === 'blocking').map(r => r.name), errors, overflow: metrics.overflow }));
    if (label !== 'before') {
        assert.deepEqual(errors, []);
        assert.equal(metrics.overflow, false);
        assert.ok(cls <= 0.10, `CLS ${cls} exceeds 0.10`);
        assert.ok(metrics.resources.filter(r => r.blocking === 'blocking').every(r => !r.name.includes('/js/')));
        assert.equal(await page.evaluate(() => [...document.querySelectorAll('script[src]')].every(script => script.defer)), true);
        await verifyWorkflows(page, viewport, collapsed);
        assert.deepEqual(errors, []);
    }
    await context.close();
}

async function verifyWorkflows(page, viewport, collapsed) {
    if (viewport.width > 900) {
        await page.locator('#navigation-toggle').click();
        assert.equal(await page.evaluate(() => document.body.classList.contains('navigation-collapsed')), !collapsed);
        assert.equal(await page.evaluate(() => document.documentElement.dataset.navigationCollapsed), String(!collapsed));
    } else {
        await page.locator('#navigation-toggle').click();
        assert.equal(await page.evaluate(() => document.body.classList.contains('navigation-open')), true);
        await page.locator('.sidebar-close').click();
    }
    for (const tab of ['shop', 'purchase', 'sell', 'campaigns', 'commands', 'customitems', 'guisettings', 'mainmenu']) {
        await page.evaluate(tab => switchTab(tab), tab);
        assert.equal(await page.locator(`#${tab}-tab`).isVisible(), true);
    }
    await page.evaluate(() => {
        switchTab('shop');
        switchShop('weekend_market.yml');
    });
    assert.equal(await page.locator('#preview-grid .gui-slot').count(), 36);
    const post = page.waitForRequest(request => request.method() === 'POST' && request.url().includes('/api/file/shops/weekend_market.yml'));
    const title = `&aRendering check ${viewport.width} ${collapsed}`;
    await page.evaluate(title => {
        localStorage.setItem('autoSaveEnabled', 'true');
        updateCurrentTitle(title);
    }, title);
    const saved = await post;
    assert.match(saved.postDataJSON().content, /Rendering check/);
    await page.waitForFunction(() => !isSaving);
    await page.evaluate(() => loadAllFiles(true));
    assert.equal(await page.evaluate(() => currentShopSettings.guiName), title);
    // Textures must load, not just leave correctly sized empty slots.
    await page.waitForFunction(() => [...document.querySelectorAll('#preview-grid img')].every(img => img.complete && img.naturalWidth > 0));
    await page.goto('http://127.0.0.1:8796/preview.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !isLoadingFiles && currentTab === 'shop');
    assert.equal(await page.evaluate(() => currentShopFile), 'weekend_market.yml');
    assert.equal(await page.locator('#preview-grid .gui-slot').count(), 36);
}

(async () => {
    let browser;
    try {
        await ready;
        browser = await chromium.launch({ channel: 'chrome', headless: true });
        for (const [viewport, collapsed] of [[{ width: 1440, height: 900 }, false], [{ width: 390, height: 844 }, false], [{ width: 1440, height: 900 }, true]]) {
            await measure(browser, viewport, collapsed);
        }
    } finally {
        await browser?.close();
        server.kill();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
