// Isolated in-memory API for save-conflict tests and demos. Never writes project or server configuration.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { createHash } = require('node:crypto');
const editorContext = require('./editor-test-context.cjs');
const resources = path.resolve(__dirname, '../../main/resources');
const web = path.join(resources, 'web');
const payloads = { mainMenu: 'menus/main-menu.yml', purchaseMenu: 'menus/purchase-menu.yml',
    sellMenu: 'menus/sell-menu.yml', guiSettings: 'menus/gui-settings.yml', campaignsFile: 'campaigns.yml',
    commandsFile: 'commands.yml', customItemsFile: 'custom-items.yml' };

function createConflictPreviewServer() {
    const read = file => fs.readFileSync(path.join(resources, file), 'utf8');
    const parser = editorContext();
    const parse = source => { parser.set('source', source); return parser.run('EditorYaml.parse(source)'); };
    const language = parse(read('languages/en_US.yml'));
    const files = new Map(Object.values(payloads).map(file => [file, file === 'campaigns.yml' ? 'campaigns: []\n' : read(file)]));
    files.set('shops/blocks.yml', read('shops/blocks.yml'));
    files.set('shops/misc.yml', read('shops/misc.yml'));
    files.set('config.yml', JSON.stringify({ enabled: true, maxUnitPrice: 10 }, null, 2));
    const revision = file => files.has(file) ? createHash('sha256').update(files.get(file)).digest('hex') : 'missing';
    const state = { files, revision, writes: 0 };
    const server = http.createServer((request, response) => {
        const url = new URL(request.url, 'http://localhost');
        const send = (code, data) => { response.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(data)); };
        if (url.pathname === '/api/files') {
            const data = { shops: {}, revisions: {}, economySafety: JSON.parse(files.get('config.yml')),
                permissions: { admin: true }, readOnlyFiles: [],
                serverInfo: { version: 'conflict-preview', smartSpawnerEnabled: false } };
            files.forEach((content, file) => {
                data.revisions[file] = revision(file);
                if (file.startsWith('shops/')) data.shops[file.slice(6)] = content;
            });
            Object.entries(payloads).forEach(([key, file]) => { data[key] = files.get(file); });
            return send(200, data);
        }
        if (url.pathname === '/api/language') return send(200, { ...language, language: 'en_US' });
        if (url.pathname === '/api/languages') return send(200, ['en_US']);
        if (url.pathname === '/api/activity-log') return send(200, []);
        if (url.pathname === '/api/database') return send(200, { totals: {}, playerCounts: [], globalCounts: [], stockResets: [] });
        if (url.pathname.startsWith('/api/file/') || url.pathname === '/api/economy-safety') {
            const file = url.pathname === '/api/economy-safety' ? 'config.yml' : decodeURIComponent(url.pathname.slice(10));
            if (request.method === 'GET') {
                if (!files.has(file)) return send(404, { revision: 'missing', fileName: file });
                return send(200, file === 'config.yml' ? { ...JSON.parse(files.get(file)), revision: revision(file) } : { content: files.get(file), revision: revision(file) });
            }
            let body = '';
            request.on('data', chunk => { body += chunk; });
            request.on('end', () => {
                const expected = request.headers['x-file-revision'];
                if (!expected) return send(428, { message: 'Originally loaded revision required' });
                if (expected !== revision(file)) return send(409, { message: 'This file changed since it was loaded.',
                    fileName: file, revision: revision(file), content: files.get(file) ?? null });
                try {
                    const data = body ? JSON.parse(body) : {};
                    if (request.method === 'DELETE') files.delete(file);
                    else if (file === 'config.yml') files.set(file, JSON.stringify({ ...JSON.parse(files.get(file)), ...data.settings }, null, 2));
                    else { parse(data.content); files.set(file, data.content); }
                    state.writes++;
                    send(200, { success: true, revision: revision(file), economySafety: file === 'config.yml' ? JSON.parse(files.get(file)) : undefined });
                } catch (error) { send(400, { message: error.message }); }
            });
            return;
        }
        if (url.pathname.startsWith('/api/')) return send(200, { totals: {}, entries: [] });
        const file = path.resolve(web, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
        if (!file.startsWith(web + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); return response.end(); }
        const type = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.ico': 'image/x-icon' }[path.extname(file)] || 'application/octet-stream';
        let content = fs.readFileSync(file);
        if (file.endsWith('index.html')) content = content.toString().replace('<head>', '<head><script>localStorage.setItem("sessionToken","preview");localStorage.setItem("username","Preview");</script>');
        response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
        response.end(content);
    });
    server.previewState = state;
    return server;
}

module.exports = { createConflictPreviewServer };
if (require.main === module) createConflictPreviewServer().listen(Number(process.argv[2] || 8801), '127.0.0.1', () => console.log('In-memory conflict preview on port ' + (process.argv[2] || 8801)));
