import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// Dynamic API route handler
async function handleApiRoute(pathname, req, res) {
  let routeName = pathname.replace('/api/', '').replace(/\/$/, '');
  let dynamicParam = null;
  
  // Handle dynamic routes like /api/og-image/[id]
  if (routeName.startsWith('og-image/')) {
    const parts = routeName.split('/');
    if (parts.length === 2) {
      routeName = 'og-image/[id]';
      dynamicParam = parts[1];
    } else {
      routeName = 'og-image';
    }
  }
  
  const routePath = join(__dirname, 'api', `${routeName}.ts`);
  
  try {
    // Import the API handler dynamically
    const module = await import(`./api/${routeName}.ts`);
    const handler = module.default;
    
    // Create query params with dynamic parameter
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const query = Object.fromEntries(url.searchParams);
    if (dynamicParam) {
      query.id = dynamicParam;
    }
    
    // Create mock Vercel request/response objects
    const vercelReq = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      query: query,
    };
    
    const vercelRes = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value;
        res.setHeader(name, value);
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        res.writeHead(this.statusCode, { 'Content-Type': 'application/json', ...this.headers });
        res.end(JSON.stringify(data));
      },
      end(data) {
        res.writeHead(this.statusCode, this.headers);
        if (data) {
          res.end(data);
        } else {
          res.end();
        }
      },
    };
    
    const result = await handler(vercelReq, vercelRes);
    // Handle ImageResponse body if returned
    if (result && result.body) {
      res.writeHead(vercelRes.statusCode, { 'Content-Type': 'image/png', ...vercelRes.headers });
      res.end(result.body);
    }
  } catch (error) {
    console.error(`API Error [${pathname}]:`, error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
  }
}

// Static file handler
async function handleStaticFile(pathname, res) {
  // Default to index.html for root
  if (pathname === '/') pathname = '/index.html';
  
  const filePath = join(__dirname, 'public', pathname);
  const ext = extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  
  try {
    const content = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch {
    // Try with .html extension
    if (!ext) {
      try {
        const htmlPath = filePath + '.html';
        const content = await readFile(htmlPath);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
        return;
      } catch {}
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
}

// Create server
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;
  
  console.log(`${req.method} ${pathname}`);
  
  if (pathname.startsWith('/api/')) {
    await handleApiRoute(pathname, req, res);
  } else {
    await handleStaticFile(pathname, res);
  }
});

server.listen(PORT, () => {
  console.log(`\n  🚀 Dev server running at http://localhost:${PORT}\n`);
  console.log(`  Static files: /public`);
  console.log(`  API routes:   /api/*\n`);
});
