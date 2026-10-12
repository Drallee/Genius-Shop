const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const resources = path.resolve(__dirname, '../src/main/resources');
const web = path.join(resources, 'web');
const port = Number(process.argv[2] || 8766);
const yamlContext = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(web, 'vendor/yaml.min.js'), 'utf8'), yamlContext);
const yaml = yamlContext.ShopYamlLibrary;
function parse(content) {
    const document = yaml.parseDocument(content);
    if (document.errors.length) throw document.errors[0];
    return document.toJS();
}

// Preview mutations live only in this process; source configurations are never written.
const files = new Map();
for (const directory of ['shops', 'menus', 'languages']) {
    for (const filename of fs.readdirSync(path.join(resources, directory))) {
        if (filename.endsWith('.yml')) {
            files.set(`${directory}/${filename}`, fs.readFileSync(path.join(resources, directory, filename), 'utf8'));
        }
    }
}
for (const filename of ['config.yml', 'commands.yml', 'custom-items.yml']) {
    files.set(filename, fs.readFileSync(path.join(resources, filename), 'utf8'));
}
files.set('campaigns.yml', 'campaigns: []\n');
let activity = [];
let safety = {};
const database = { totals: {}, playerCounts: [], globalCounts: [], stockResets: [], generatedAt: new Date().toISOString() };
function shops() {
    return Object.fromEntries([...files].filter(([key]) => key.startsWith('shops/')).map(([key, value]) => [key.slice(6), value]));
}
function catalog() {
    return Object.fromEntries(Object.entries(shops()).map(([filename, content]) => {
        const shop = parse(content);
        return [filename.replace(/\.yml$/, ''), { name: shop['gui-name'], items: (shop.items || []).map((item, slot) => ({
            key: item['item-key'] || item.material, name: item.name || item.material, material: item.material, slot: item.slot ?? slot
        })) }];
    }));
}
function stock() {
    const entries = [];
    for (const [filename, content] of Object.entries(shops())) {
        (parse(content).items || []).forEach((item, slot) => {
            const limit = Number(item['global-limit']) || 0;
            if (limit > 0) entries.push({ shopKey: filename.replace(/\.yml$/, ''), itemKey: item['item-key'] || item.material,
                material: item.material, name: item.name, slot: item.slot ?? slot, globalLimit: limit,
                current: 0, remaining: limit, utilizationPct: 0 });
        });
    }
    return { totals: { fillPct: 100 }, entries, generatedAt: new Date().toISOString() };
}
function json(response, value, status = 200) {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(value));
}
async function body(request) {
    let content = '';
    for await (const chunk of request) {
        content += chunk;
        if (content.length > 5 * 1024 * 1024) throw new Error('Request too large');
    }
    return content ? JSON.parse(content) : {};
}
async function api(request, response, url) {
    const route = url.pathname;
    const method = request.method;
    if (route === '/api/files' && method === 'GET') return json(response, {
        shops: shops(), mainMenu: files.get('menus/main-menu.yml'), purchaseMenu: files.get('menus/purchase-menu.yml'),
        sellMenu: files.get('menus/sell-menu.yml'), guiSettings: files.get('menus/gui-settings.yml'),
        campaignsFile: files.get('campaigns.yml'), commandsFile: files.get('commands.yml'), commandCatalog: catalog(),
        customItemsFile: files.get('custom-items.yml'),
        serverInfo: { version: '1.6.0 preview', smartSpawnerEnabled: false, entityTypes: ['PIG', 'COW', 'ZOMBIE', 'SKELETON'] },
        economySafety: safety
    });
    if (route === '/api/languages') return json(response, [...files.keys()].filter(key => key.startsWith('languages/')).map(key => key.slice(10, -4)));
    if (route === '/api/language') {
        const language = url.searchParams.get('lang') || 'en_US';
        return json(response, { ...parse(files.get(`languages/${language}.yml`) || files.get('languages/en_US.yml')), language });
    }
    if (route === '/api/stock-analytics') return json(response, stock());
    if (route === '/api/activity-log' && method === 'GET') return json(response, activity);
    if (route === '/api/activity-log/clear' && method === 'POST') { activity = []; return json(response, { success: true }); }
    if (route === '/api/activity-log/rollback' && method === 'POST') {
        const payload = await body(request);
        const entry = activity.find(value => value.id === payload.id);
        if (!entry) return json(response, { error: 'Preview history entry not found' }, 404);
        if (entry.before === null) files.delete(entry.file); else files.set(entry.file, entry.before);
        return json(response, { success: true });
    }
    if (route === '/api/economy-safety') {
        if (method === 'POST') safety = (await body(request)).settings || {};
        return json(response, { success: true, settings: safety });
    }
    if (route === '/api/database') {
        if (method === 'GET') return json(response, database);
        const payload = await body(request);
        const table = { player_counts: 'playerCounts', global_counts: 'globalCounts', stock_resets: 'stockResets' }[payload.table];
        if (!table) return json(response, { error: 'Unknown preview table' }, 400);
        const { table: ignored, ...row } = payload;
        const keys = table === 'playerCounts' ? ['uuid', 'itemKey'] : table === 'globalCounts' ? ['itemKey'] : ['storedResetId'];
        const existing = database[table].findIndex(entry => keys.every(key => entry[key] === row[key]));
        if (existing >= 0) database[table].splice(existing, 1);
        if (method === 'POST') database[table].push(row);
        return json(response, { success: true, database });
    }
    if (route.startsWith('/api/file/')) {
        const filename = decodeURIComponent(route.slice('/api/file/'.length));
        if (!/^(shops\/[\w.-]+\.yml|menus\/[\w.-]+\.yml|campaigns\.yml|commands\.yml)$/.test(filename)) return json(response, { error: 'Invalid preview filename' }, 400);
        if (method === 'GET') return json(response, { content: files.get(filename) || '' });
        const before = files.get(filename) ?? null;
        if (method === 'DELETE') files.delete(filename);
        else if (method === 'POST') {
            const payload = await body(request);
            if (typeof payload.content !== 'string') return json(response, { error: 'YAML content required' }, 400);
            parse(payload.content);
            files.set(filename, payload.content);
        } else return json(response, { error: 'Method not supported' }, 405);
        activity.unshift({ id: String(Date.now()), file: filename, before, after: files.get(filename) ?? null,
            timestamp: Date.now(), action: method === 'DELETE' ? 'deleted' : 'updated', username: 'Preview' });
        return json(response, { success: true });
    }
    if (route === '/api/reload' || route === '/api/telemetry') return json(response, { success: true });
    return json(response, { error: 'This operation requires the live plugin' }, 404);
}

const mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const server = http.createServer(async (request, response) => {
    try {
        const url = new URL(request.url, `http://127.0.0.1:${port}`);
        if (url.pathname.startsWith('/api/')) return await api(request, response, url);
        const requested = ['/', '/preview.html', '/login.html'].includes(url.pathname) ? 'index.html' : decodeURIComponent(url.pathname).slice(1);
        const filename = path.resolve(web, requested);
        if (!filename.startsWith(web + path.sep)) return json(response, { error: 'Invalid path' }, 400);
        if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) return json(response, { error: 'Not found' }, 404);
        let content = fs.readFileSync(filename);
        if (requested === 'index.html') {
            content = content.toString('utf8').replace('<head>', '<head><script>localStorage.setItem("sessionToken","standalone-preview");localStorage.setItem("username","Preview");</script>');
            content = content.replace('<head>', '<head><script>document.addEventListener("DOMContentLoaded", function(){currentShopFile="weekend_market.yml";currentTab="shop";var previewLoadFiles=loadAllFiles;loadAllFiles=async function(isSilent){await previewLoadFiles(isSilent);switchTab("shop");};});</script>');
        }
        response.writeHead(200, { 'Content-Type': `${mimeTypes[path.extname(filename)] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store' });
        response.end(content);
    } catch (error) {
        json(response, { error: error.message }, 400);
    }
});
server.listen(port, '127.0.0.1', () => console.log(`Standalone editor: http://127.0.0.1:${port}/preview.html`));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
