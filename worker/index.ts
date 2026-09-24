import { CatalogError, categoriesFor, categorySlug, readCatalog, readEpisode, resolveCategory, type Env, type Episode } from './catalog';

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const json = (data: unknown, status = 200) => Response.json(data, { status });
const failure = (message: string, status: number) => json({ success: false, error: message }, status);

function unavailable(title: string, status: number): Response {
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex"><title>${escapeHtml(title)} | Angle</title><style>body{background:#101010;color:#eee;font:20px system-ui;max-width:42rem;margin:15vh auto;padding:2rem}a{color:inherit}</style><h1>${escapeHtml(title)}</h1><p>${status === 404 ? 'This story is no longer available.' : 'Please try again in a moment.'}</p><a href="/">Browse current stories</a></html>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function page(request: Request, env: Env, path: string, title: string, description: string, imagePath: string, type = 'website', episode?: Episode): Promise<Response> {
  const template = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
  if (!template.ok) throw new Error('HTML asset unavailable');
  let html = await template.text();
  const origin = new URL(env.PUBLIC_ORIGIN).origin;
  const url = origin + path;
  const image = origin + imagePath;
  const tags: Record<string, string> = {
    'og:type': type, 'og:url': url, 'og:title': title, 'og:description': description,
    'og:image': image, 'twitter:url': url, 'twitter:title': title,
    'twitter:description': description, 'twitter:image': image,
  };
  for (const [key, value] of Object.entries(tags)) {
    html = html.replace(new RegExp(`<meta (property|name)="${key}" content="[^"]*">`),
      (_match, attribute) => `<meta ${attribute}="${key}" content="${escapeHtml(value)}">`);
  }
  html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${escapeHtml(title)}</title>`);
  html = html.replace(/<link rel="canonical"[^>]*>/g, '').replace(/<meta name="description"[^>]*>/g, '');
  html = html.replace('</head>', () => `<link rel="canonical" href="${escapeHtml(url)}"><meta name="description" content="${escapeHtml(description)}"></head>`);
  if (episode) {
    const transcript = episode.transcript?.split(/\s+/).slice(0, 600).join(' ') || '';
    const section = `<section id="episode-ssr-content" style="max-width:820px;margin:0 auto;padding:8px 20px 12px;color:#f5f5f5"><h1>${escapeHtml(episode.title)}</h1><p>${escapeHtml(description)}</p>${transcript ? `<details><summary>Read the transcript</summary><p>${escapeHtml(transcript)}</p></details>` : ''}</section>`;
    html = html.replace(/(<div class="filters"[^>]*>)/, () => section + '<div class="filters" id="filters">');
    const structured = {
      '@context': 'https://schema.org', '@type': 'PodcastEpisode', name: episode.title,
      url, description, datePublished: episode.createdAt, dateModified: episode.updatedAt || episode.createdAt,
      image: episode.coverImage || image, associatedMedia: {
        '@type': 'AudioObject', contentUrl: episode.audioUrl,
        ...(episode.duration !== null ? { duration: `PT${Math.round(episode.duration)}S` } : {}),
      },
    };
    const encoded = JSON.stringify(structured).replace(/</g, '\\u003c');
    html = html.replace('</head>', () => `<script type="application/ld+json">${encoded}</script></head>`);
  }
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function sitemap(env: Env, episodes: Episode[]): Response {
  const origin = new URL(env.PUBLIC_ORIGIN).origin;
  const paths = ['/', '/new', '/popular', ...categoriesFor(episodes).map(c => '/' + categorySlug(c)),
    ...episodes.map(e => '/episode/' + encodeURIComponent(e.id))];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...new Set(paths)].map(path => `<url><loc>${escapeHtml(origin + path)}</loc></url>`).join('')}</urlset>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (env.ENVIRONMENT === 'production' && url.hostname === 'newsangle.co') {
    return Response.redirect(new URL(path + url.search, env.PUBLIC_ORIGIN).href, 308);
  }
  if (request.method === 'OPTIONS' && path.startsWith('/api/')) return new Response(null, { status: 204 });
  if (!['GET', 'HEAD'].includes(request.method)) {
    const result = failure('Method not allowed', 405);
    result.headers.set('Allow', 'GET, HEAD, OPTIONS');
    return result;
  }
  if (path === '/sitemap_index.xml') return Response.redirect(new URL('/sitemap.xml', env.PUBLIC_ORIGIN).href, 301);
  if (path === '/home-v2' || path === '/home-v2.html') return env.ASSETS.fetch(new Request(new URL('/home-v2.html', request.url)));
  if (path === '/api/health') return json({ status: 'ok' });
  if (path === '/robots.txt') return new Response(env.ENVIRONMENT === 'production' && url.hostname === new URL(env.PUBLIC_ORIGIN).hostname
    ? `User-agent: *\nAllow: /\nSitemap: ${new URL(env.PUBLIC_ORIGIN).origin}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  if (path === '/' || path === '/index.html') return page(request, env, '/', 'Angle', 'Stories worth listening.', '/api/og-image');
  if (path === '/api/og-image') {
    const { ogImage } = await import('./og');
    return ogImage('Angle', 'Stories worth listening.');
  }
  if (/^\/(icons|images|fonts|js|styles)\//.test(path) || path === '/favicon.ico') {
    const asset = await env.ASSETS.fetch(request);
    if (asset.ok && /^\/images\/covers\/[a-f0-9]{24}-(500|1000|1500)\.webp$/.test(path)) {
      const immutable = new Response(asset.body, asset);
      immutable.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      return immutable;
    }
    return asset;
  }

  const idRoute = path.match(/^\/api\/episodes\/([^/]+)$/);
  const episodePage = path.match(/^\/(?:episode|api\/render\/episode)\/([^/]+)$/);
  const episodeImage = path.match(/^\/api\/og-image\/([^/]+)$/);
  const categoryImage = path.match(/^\/api\/og-image\/category\/([^/]+)$/);
  const categoryPage = path.match(/^\/(?:api\/render\/)?([^/.]+)$/);
  const isCatalogRoute = ['/api/episodes', '/api/categories', '/api/ready', '/api/sitemap', '/sitemap.xml'].includes(path);
  if (!isCatalogRoute && !idRoute && !episodePage && !episodeImage && !categoryImage && !categoryPage) {
    return path.startsWith('/api/') ? failure('Not found', 404) : unavailable('Page not found', 404);
  }
  const episodes = idRoute || episodePage || episodeImage ? [] : await readCatalog(env);
  if (path === '/api/ready') return json({ status: 'ok', catalog: 'reachable' });
  if (path === '/api/episodes') return json({ success: true, data: episodes });
  if (path === '/api/categories') return json({ success: true, data: categoriesFor(episodes) });
  if (path === '/sitemap.xml' || path === '/api/sitemap') return sitemap(env, episodes);
  const idMatch = idRoute || episodePage || episodeImage;
  if (idMatch) {
    let id: string;
    try { id = decodeURIComponent(idMatch[1]); } catch { return failure('Invalid episode ID', 400); }
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) return failure('Invalid episode ID', 400);
    const episode = await readEpisode(env, id);
    if (!episode) return episodePage ? unavailable('Episode unavailable', 404) : failure('Episode not found', 404);
    if (idRoute) return json({ success: true, data: episode });
    const description = episode.fullDescription || episode.description || 'Stories worth listening.';
    if (episodeImage) {
      const { ogImage } = await import('./og');
      return ogImage(episode.title, description, episode.category);
    }
    return page(request, env, `/episode/${id}`, `${episode.title} | Angle`, description, `/api/og-image/${id}`, 'article', episode);
  }
  const match = categoryImage || categoryPage;
  if (match) {
    let slug: string;
    try { slug = decodeURIComponent(match[1]); } catch { return unavailable('Page not found', 404); }
    const category = resolveCategory(slug, categoriesFor(episodes));
    if (!category) return categoryImage ? failure('Category not found', 404) : unavailable('Category not found', 404);
    const canonicalSlug = categorySlug(category);
    if (categoryPage && path !== '/' + canonicalSlug && !path.startsWith('/api/')) {
      return new Response(null, { status: 308, headers: { Location: '/' + canonicalSlug } });
    }
    const label = category === 'new' ? 'New' : category === 'popular' ? 'Popular' : category;
    const title = `${label} Stories | Angle`;
    const description = category === 'new' ? 'Latest stories worth listening.' : `${label} stories worth listening.`;
    if (categoryImage) {
      const { ogImage } = await import('./og');
      return ogImage(label + ' Stories', description);
    }
    return page(request, env, '/' + canonicalSlug, title, description, '/api/og-image/category/' + canonicalSlug);
  }
  return failure('Not found', 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    let response: Response;
    try { response = await route(request, env); }
    catch (error) {
      const status = error instanceof CatalogError ? error.status : 500;
      console.error(JSON.stringify({ message: 'Request failed', path: new URL(request.url).pathname, status, reason: error instanceof Error ? error.message : 'Unknown error' }));
      response = new URL(request.url).pathname.startsWith('/api/')
        ? failure('Service temporarily unavailable', status) : unavailable('Temporarily unavailable', status);
    }
    response = new Response(request.method === 'HEAD' ? null : response.body, response);
    response.headers.set('X-Content-Type-Options', 'nosniff');
    if (env.ENVIRONMENT !== 'production' || new URL(request.url).hostname !== new URL(env.PUBLIC_ORIGIN).hostname) response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    if (new URL(request.url).pathname.startsWith('/api/')) {
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (!response.headers.has('Cache-Control')) response.headers.set('Cache-Control',
      response.status >= 400 || new URL(request.url).pathname === '/api/ready'
        ? 'no-store' : 'no-cache');
    return response;
  },
};
