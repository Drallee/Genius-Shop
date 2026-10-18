// In-memory publishing demo. Never writes project files or contacts a Minecraft server.
const { createPreviewServer } = require('./editor-preview-server.cjs');
const { createHash } = require('node:crypto');
const revision = content => content == null ? 'missing' : createHash('sha256').update(content).digest('hex');
const keys = { mainMenu: 'menus/main-menu.yml', purchaseMenu: 'menus/purchase-menu.yml',
    sellMenu: 'menus/sell-menu.yml', guiSettings: 'menus/gui-settings.yml', campaignsFile: 'campaigns.yml',
    commandsFile: 'commands.yml', customItemsFile: 'custom-items.yml' };

function createDraftPreviewServer({ permissions = null, readOnlyFiles = [] } = {}) {
    const state = { live: null, workspace: null, version: 0, publishes: 0, errors: [], failPublish: false, requests: [] };
    const changes = () => [...new Set([...Object.keys(state.live), ...Object.keys(state.workspace)])].sort()
        .filter(file => state.live[file] !== state.workspace[file]).map(file => ({ file,
            kind: state.workspace[file] == null ? 'deleted' : state.live[file] == null ? 'added' : 'modified',
            before: state.live[file] ?? null, after: state.workspace[file] ?? null }));
    const status = () => ({ revision: String(state.version), changedFiles: changes().length });
    const review = () => ({ token: String(state.version), draft: status(), changes: changes(), errors: state.errors });
    const server = createPreviewServer({ apiHandler(request, response, url, base) {
        if (!state.live) {
            state.live = Object.fromEntries(Object.entries(keys).map(([key, file]) => [file, base[key]]));
            Object.entries(base.shops).forEach(([file, source]) => { state.live['shops/' + file] = source; });
            state.workspace = { ...state.live };
        }
        const send = (code, body) => { response.writeHead(code, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(body)); };
        const can = key => !permissions || permissions.admin || permissions[key];
        const fileAllowed = file => file === 'commands.yml' ? can('commands') :
            file === 'config.yml' || file === 'discord.yml' || file.startsWith('languages/') ? can('admin') : can('drafts');
        if (url.pathname === '/api/permissions') { send(200, permissions || base.permissions); return true; }
        const forbidden = url.pathname === '/api/database' && !can('database') ||
            url.pathname === '/api/stock-analytics' && !can('analytics') ||
            url.pathname === '/api/activity-log' && !can('admin') ||
            url.pathname === '/api/economy-safety' && !can('admin') ||
            url.pathname === '/api/draft/publish' && !can('publish') ||
            url.pathname.startsWith('/api/file/') && !fileAllowed(decodeURIComponent(url.pathname.slice('/api/file/'.length)));
        if (forbidden) { send(403, { message: 'Editor permission denied' }); return true; }
        if (url.pathname === '/api/files') {
            const payload = { ...base, shops: {}, revisions: {}, draft: status(), permissions: permissions || base.permissions, readOnlyFiles };
            Object.entries(state.workspace).forEach(([file, content]) => { if (fileAllowed(file)) payload.revisions[file] = revision(content); });
            Object.entries(keys).forEach(([key, file]) => { if (fileAllowed(file)) payload[key] = state.workspace[file]; else delete payload[key]; });
            Object.entries(state.workspace).forEach(([file, content]) => { if (file.startsWith('shops/') && fileAllowed(file)) payload.shops[file.slice(6)] = content; });
            if (state.workspace['config.yml']) payload.economySafety = JSON.parse(state.workspace['config.yml']);
            send(200, payload);
            return true;
        }
        if (url.pathname === '/api/draft/review') { send(200, review()); return true; }
        if (request.method === 'GET' && url.pathname.startsWith('/api/file/')) {
            const file = decodeURIComponent(url.pathname.slice('/api/file/'.length));
            const content = state.workspace[file];
            send(content == null ? 404 : 200, { content, revision: revision(content), draft: status() });
            return true;
        }
        if (request.method === 'GET') return false;
        state.requests.push(url.pathname);
        let body = '';
        request.on('data', part => { body += part; });
        request.on('end', () => {
            try {
                const input = body ? JSON.parse(body) : {};
                const expected = request.headers['x-draft-revision'];
                if (url.pathname === '/api/draft/discard' && expected !== String(state.version)) return send(409, { message: 'Draft changed in another tab' });
                const file = url.pathname.startsWith('/api/file/') ? decodeURIComponent(url.pathname.slice('/api/file/'.length)) :
                    url.pathname === '/api/economy-safety' ? 'config.yml' : null;
                if (file) {
                    if (!request.headers['x-file-revision']) return send(428, { message: 'File revision required' });
                    if (request.headers['x-file-revision'] !== revision(state.workspace[file])) return send(409, {
                        fileName: file, content: state.workspace[file] ?? null, revision: revision(state.workspace[file]) });
                }
                if (url.pathname.startsWith('/api/file/')) {
                    const file = decodeURIComponent(url.pathname.slice('/api/file/'.length));
                    if (request.method === 'DELETE') delete state.workspace[file];
                    else state.workspace[file] = input.content;
                } else if (url.pathname === '/api/economy-safety') {
                    state.workspace['config.yml'] = JSON.stringify(input.settings);
                } else if (url.pathname === '/api/draft/publish') {
                    if (input.token !== String(state.version)) return send(409, { message: 'The reviewed configuration changed. Review it again.' });
                    if (state.failPublish) return send(500, { message: 'Publish failed. The previous live configuration was restored; your draft is retained.' });
                    if (state.errors.length) return send(400, { message: state.errors.join('; ') });
                    state.live = { ...state.workspace };
                    state.publishes++;
                } else if (url.pathname === '/api/draft/discard') {
                    state.workspace = { ...state.live };
                } else return send(405, { message: 'Unsupported preview action' });
                state.version++;
                send(200, { success: true, draft: status(), economySafety: input.settings,
                    revision: file ? revision(state.workspace[file]) : undefined });
            } catch (error) { send(400, { message: error.message }); }
        });
        return true;
    } });
    server.draftState = state;
    return server;
}

module.exports = { createDraftPreviewServer };
if (require.main === module) {
    const role = process.argv[3] || 'admin';
    if (!['admin', 'analytics', 'drafts', 'commands', 'database', 'publish', 'maintainer'].includes(role)) throw new Error('Unknown preview role: ' + role);
    const permissions = role === 'maintainer' ? { drafts: true, publish: true } : { [role]: true };
    createDraftPreviewServer({ permissions }).listen(Number(process.argv[2] || 8799), '127.0.0.1', () =>
        console.log('In-memory draft preview: http://127.0.0.1:' + (process.argv[2] || 8799)));
}
