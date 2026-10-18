const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const editorContext = require('./editor-test-context.cjs');
const resources = path.resolve(__dirname, '../../main/resources');
const web = path.join(resources, 'web');

function createPreviewServer({ apiHandler } = {}) {
    const read = file => fs.readFileSync(path.join(resources, file), 'utf8');
    const yaml = editorContext();
    yaml.set('languageSource', read('languages/en_US.yml'));
    const language = yaml.run('EditorYaml.parse(languageSource)');
    const files = {
        shops: { 'blocks.yml': read('shops/blocks.yml') },
        mainMenu: read('menus/main-menu.yml'), purchaseMenu: read('menus/purchase-menu.yml'),
        sellMenu: read('menus/sell-menu.yml'), guiSettings: read('menus/gui-settings.yml'),
        campaignsFile: 'campaigns: []\n', commandsFile: read('commands.yml'),
        customItemsFile: read('custom-items.yml'), serverInfo: { version: 'tutorial-preview', smartSpawnerEnabled: false }
    };
    return http.createServer((request, response) => {
        const url = new URL(request.url, 'http://localhost');
        if (url.pathname.startsWith('/api/')) {
            if (apiHandler && apiHandler(request, response, url, files)) return;
            // Preview is deliberately read-only. No configuration writes or live server access.
            if (request.method !== 'GET') {
                response.writeHead(405, { 'Content-Type': 'application/json' });
                return response.end('{"error":"Read-only preview"}');
            }
            const payload = url.pathname === '/api/files' ? files :
                url.pathname === '/api/language' ? { ...language, language: 'en_US' } :
                url.pathname === '/api/languages' ? ['en_US'] :
                url.pathname === '/api/activity-log' ? [] :
                url.pathname === '/api/database' ? { totals: {}, playerCounts: [], globalCounts: [], stockResets: [] } :
                { totals: {}, entries: [] };
            response.writeHead(200, { 'Content-Type': 'application/json' });
            return response.end(JSON.stringify(payload));
        }
        const file = path.resolve(web, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
        if (!file.startsWith(web + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
            response.writeHead(404);
            return response.end();
        }
        const type = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.ico': 'image/x-icon' }[path.extname(file)] || 'application/octet-stream';
        let content = fs.readFileSync(file);
        if (file.endsWith('index.html')) content = content.toString().replace('<head>', '<head><script>localStorage.setItem("sessionToken","preview");localStorage.setItem("username","Preview");</script>');
        response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
        response.end(content);
    });
}

module.exports = { createPreviewServer };
if (require.main === module) {
    createPreviewServer().listen(Number(process.argv[2] || 8798), '127.0.0.1', () => console.log('Read-only editor preview: http://127.0.0.1:' + (process.argv[2] || 8798)));
}
