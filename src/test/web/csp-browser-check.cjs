const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium, firefox } = require(path.resolve(__dirname, '../../../target/rendering-tools/node_modules/playwright'));
const { start } = require('./sparse-preview-server.cjs');

async function check(type, name, width) {
    const server = await start();
    const browser = await type.launch({ headless: true, ...(name === 'chrome' ? { channel: 'chrome' } : {}) });
    try {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => {
            window.cspViolations = [];
            document.addEventListener('securitypolicyviolation', event => {
                window.cspViolations.push({ blockedURI: event.blockedURI, directive: event.effectiveDirective,
                    source: event.sourceFile, line: event.lineNumber });
            });
        });
        await page.route('https://**/*', route => route.abort());
        await page.route('http://127.0.0.1:*/**', async route => {
            if (route.request().resourceType() !== 'document') return route.continue();
            const response = await route.fetch();
            await route.fulfill({ response, headers: { ...response.headers(),
                'Content-Security-Policy': "script-src 'self' 'unsafe-inline'" } });
        });
        const response = await page.goto(`http://127.0.0.1:${server.address().port}/`);
        assert.equal(response.headers()['content-security-policy'], "script-src 'self' 'unsafe-inline'");
        await page.waitForFunction(() => typeof getEditorState === 'function' && !getEditorState('isLoadingFiles'));
        if (width < 901) await page.locator('#navigation-toggle').click();
        await page.locator('[data-tab="shop"]').click();
        await page.locator('#preview-grid .gui-slot.filled').first().click();
        await page.locator('#modal-price').fill('125');
        await page.locator('#edit-modal button[onclick="saveEditModal()"]').click();
        await page.locator('#edit-modal').waitFor({ state: 'hidden' });
        assert.equal(await page.evaluate(() => items[0].price), 125);
        assert.match(await page.evaluate(() => EditorYaml.writeShop()), /price: 125/);
        // Exercise the state store with the same API used by the UI.
        assert.equal(await page.evaluate(() => {
            const store = EditorStateStore.createStore({ value: 0 });
            let changes = 0;
            store.subscribe(() => changes++);
            store.patch({ value: 1 });
            return store.get('value') === 1 && changes === 1;
        }), true);
        assert.deepEqual(await page.evaluate(() => window.cspViolations), []);
        assert.deepEqual(errors, []);
        console.log(`${name} ${width}: load, YAML edit and state updates pass with unsafe-eval blocked`);
    } finally {
        await browser.close();
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
}

(async () => {
    for (const [name, type] of [['chrome', chromium], ['firefox', firefox]]) {
        for (const width of [1440, 390]) await check(type, name, width);
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
