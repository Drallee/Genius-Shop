const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

function report(query) {
    const now = new Date();
    const through = query.get('through') || now.toISOString().slice(0, 10);
    const from = query.get('from') || new Date(now.getTime() - 29 * 86400000).toISOString().slice(0, 10);
    const shop = query.has('shop') ? query.get('shop') : null;
    const item = query.has('item') ? query.get('item') : null;
    const trades = [];
    for (let day = 0; day < 12; day++) {
        const date = new Date(now.getTime() - day * 86400000).toISOString().slice(0, 10);
        for (const [store, product, base] of [['blocks', 'stone', 8], ['blocks', 'oak_log', 15], ['minerals', 'diamond', 220]]) {
            for (const type of ['PURCHASE', 'SALE', 'WAND_SALE']) {
                const quantity = 16 + day * 2;
                const unit = base * (type === 'PURCHASE' ? 1.5 : 0.8) + day;
                trades.push({ day: date, shop: store, item: product, type, quantity, unit, total: quantity * unit });
            }
        }
    }
    const filtered = trades.filter(row => row.day >= from && row.day <= through && (shop === null || row.shop === shop) && (item === null || row.item === item));
    const totals = {};
    for (const type of ['PURCHASE', 'SALE', 'WAND_SALE']) {
        const rows = filtered.filter(row => row.type === type);
        totals[type] = { operations: rows.length, lines: rows.length, quantity: rows.reduce((n, r) => n + r.quantity, 0), money: rows.reduce((n, r) => n + r.total, 0) };
    }
    const grouped = new Map();
    for (const row of filtered) {
        const key = `${row.shop}/${row.item}`;
        if (!grouped.has(key)) grouped.set(key, { shop: row.shop, item: row.item, purchases: 0, sales: 0, turnover: 0 });
        const group = grouped.get(key);
        group[row.type === 'PURCHASE' ? 'purchases' : 'sales'] += row.quantity;
        group.turnover += row.total;
    }
    const priceGroups = new Map();
    if (shop !== null && item !== null) {
        for (const row of filtered) {
            const direction = row.type === 'PURCHASE' ? 'BUY' : 'SELL';
            const key = `${row.day}/${direction}`;
            if (!priceGroups.has(key)) priceGroups.set(key, { day: row.day, direction, quantity: 0, total: 0, minimum: row.unit, maximum: row.unit });
            const price = priceGroups.get(key);
            price.quantity += row.quantity;
            price.total += row.total;
            price.minimum = Math.min(price.minimum, row.unit);
            price.maximum = Math.max(price.maximum, row.unit);
        }
    }
    const inflow = totals.SALE.money + totals.WAND_SALE.money;
    return { filter: { from, through, shop, item }, generatedAt: now.toISOString(), totals,
        playerInflow: inflow, playerOutflow: totals.PURCHASE.money, netPlayerInflow: inflow - totals.PURCHASE.money,
        shops: ['blocks', 'minerals'], items: shop === 'minerals' ? ['diamond'] : shop === 'blocks' ? ['oak_log', 'stone'] : ['diamond', 'oak_log', 'stone'],
        popular: [...grouped.values()].sort((a, b) => b.purchases + b.sales - a.purchases - a.sales), matchingItems: grouped.size, popularLimit: 50,
        prices: [...priceGroups.values()].map(price => ({ ...price, average: price.total / price.quantity })).sort((a, b) => a.day.localeCompare(b.day) || a.direction.localeCompare(b.direction)) };
}

function start(port = 0, resources = path.resolve(__dirname, '../../main/resources')) {
    const root = path.join(resources, 'web');
    const read = file => fs.readFileSync(path.join(resources, file), 'utf8');
    const server = http.createServer((request, response) => {
        const url = new URL(request.url, 'http://localhost');
        const json = (value, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); };
        if (url.pathname.startsWith('/api/')) {
            if (request.method !== 'GET') return json({ message: 'Read-only preview.' }, 405);
            if (url.pathname === '/api/sales-analytics') return json(report(url.searchParams));
            if (url.pathname === '/api/activity-log') return json([]);
            if (url.pathname === '/api/languages') return json(['en_US']);
            if (url.pathname === '/api/language') return json({ language: 'en_US' });
            if (url.pathname === '/api/files') return json({ shops: { 'blocks.yml': read('shops/blocks.yml') },
                mainMenu: read('menus/main-menu.yml'), purchaseMenu: read('menus/purchase-menu.yml'), sellMenu: read('menus/sell-menu.yml'),
                guiSettings: read('menus/gui-settings.yml'), customItemsFile: read('custom-items.yml'), commandsFile: read('commands.yml'),
                serverInfo: { version: 'Sales preview / sample data', materials: ['STONE', 'DIAMOND', 'OAK_LOG'], entityTypes: [] } });
            return json({});
        }
        const filename = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
        if (!filename.startsWith(root + path.sep)) { response.writeHead(403); return response.end(); }
        try {
            let content = fs.readFileSync(filename);
            if (filename.endsWith('index.html')) content = content.toString().replace('</head>', `<script>localStorage.setItem('sessionToken','preview');localStorage.setItem('username','Preview');document.addEventListener('DOMContentLoaded',()=>{document.querySelector('.sales-badge').textContent='Sample data / UTC';});</script></head>`);
            response.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' })[path.extname(filename)] || 'application/octet-stream' });
            response.end(content);
        } catch { response.writeHead(404); response.end('Not found'); }
    });
    return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server)));
}

module.exports = { start, report };
if (require.main === module) start(Number(process.argv[2] || 8803)).then(server => console.log(`Sample-data preview: http://127.0.0.1:${server.address().port}`));
