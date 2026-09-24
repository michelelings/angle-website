// Local-only browser QA with a saved public catalog; no database credentials.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
const catalog = JSON.parse(await readFile(process.argv[2], 'utf8'));
const root = resolve('public');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.otf': 'font/otf', '.png': 'image/png' };
createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1:4173');
    try {
        if (url.pathname.startsWith('/api/episodes')) {
            const referer = new URL(req.headers.referer || url);
            const count = Math.min(1000, Math.max(0, Number(referer.searchParams.get('count') ?? catalog.data.length)));
            const data = Array.from({ length: count }, (_, i) => ({ ...catalog.data[i % catalog.data.length], id: i < catalog.data.length ? catalog.data[i].id : `fixture-${i}` }));
            const id = url.pathname.split('/')[3];
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, data: id ? data.find(item => item.id === id) : data }));
            return;
        }
        const file = resolve(root, `.${url.pathname}`);
        if (!file.startsWith(root + sep) && file !== root) { res.writeHead(404).end(); return; }
        const path = extname(file) ? file : resolve(root, 'index.html');
        res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-store');
        res.end(await readFile(path));
    } catch { res.writeHead(404).end('Not found'); }
}).listen(4173, '127.0.0.1', () => console.log('Gallery QA: http://127.0.0.1:4173 (add ?count=1000 or ?count=3)'));
