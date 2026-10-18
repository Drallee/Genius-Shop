const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../main/resources/web');
const resources = path.dirname(root);
const original = '# Minimal item / sample data\ngui-name: Sample Shop\nrows: 3\nsell-adds-to-stock: true\nallow-sell-stock-overflow: true\nitems:\n  - material: GOLDEN_APPLE # Keep this comment\n    price: 100\n';

function start(port = 0) {
    let yaml = original;
    let saves = 0;
    const read = name => fs.readFileSync(path.join(resources, name), 'utf8');
    const server = http.createServer(async (request, response) => {
        const url = new URL(request.url, 'http://localhost');
        const json = (data, code = 200) => { response.writeHead(code, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(data)); };
        if (url.pathname.startsWith('/api/')) {
            if (url.pathname === '/api/file/shops/sample.yml' && request.method === 'POST') {
                let body = '';
                for await (const chunk of request) body += chunk;
                try { yaml = JSON.parse(body).content; saves++; return json({ success: true }); }
                catch { return json({ error: 'Invalid JSON' }, 400); }
            }
            if (url.pathname === '/api/files') return json({ shops: { 'sample.yml': yaml },
                mainMenu: read('menus/main-menu.yml'), purchaseMenu: read('menus/purchase-menu.yml'), sellMenu: read('menus/sell-menu.yml'),
                guiSettings: read('menus/gui-settings.yml'), commandsFile: 'commands: {}\n', customItemsFile: 'items: {}\n',
                serverInfo: { version: 'Sparse-save preview / sample data', materials: ['GOLDEN_APPLE', 'STONE'], entityTypes: [] } });
            if (url.pathname === '/api/activity-log') return json([]);
            if (url.pathname === '/api/languages') return json(['en_US']);
            if (url.pathname === '/api/language') return json({ language: 'en_US' });
            return json({});
        }
        const filename = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
        if (!filename.startsWith(root + path.sep)) return json({}, 403);
        try {
            let data = fs.readFileSync(filename);
            if (filename.endsWith('index.html')) data = data.toString().replace('</head>', "<script>localStorage.setItem('sessionToken','preview');localStorage.setItem('username','Sample');localStorage.setItem('autoSaveEnabled','false');</script></head>");
            response.writeHead(200, { 'Content-Type': ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png' })[path.extname(filename)] || 'application/octet-stream' });
            response.end(data);
        } catch { response.writeHead(404); response.end(); }
    });
    server.state = () => ({ yaml, saves });
    return new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(server)));
}
module.exports = { start, original };
if (require.main === module) start(Number(process.argv[2] || 8804)).then(server => console.log(`In-memory sample preview: http://127.0.0.1:${server.address().port}`));
