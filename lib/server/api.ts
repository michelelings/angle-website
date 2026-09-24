import { CatalogError, readCatalog, readEpisode, categoriesFor, resolveCategory, type Env } from '../../worker/catalog';
import { ogImage } from './og';
import { sitemapResponse } from './sitemap';
import { readSearchDocuments } from './search';
const failure = (message: string, status: number) => Response.json({ success: false, error: message }, { status });
export async function apiResponse(path: string[], env: Env): Promise<Response> {
  try {
    const key = path.join('/');
    if (key === 'health') return Response.json({ status: 'ok' });
    if (key === 'search-index') return Response.json({ data: await readSearchDocuments(env) }, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
    });
    if (key === 'episodes') return Response.json({ success: true, data: await readCatalog(env) });
    if (key === 'categories') return Response.json({ success: true, data: categoriesFor(await readCatalog(env)) });
    if (key === 'ready') { await readCatalog(env); return Response.json({ status: 'ok', catalog: 'reachable' }); }
    if (key === 'sitemap') return sitemapResponse(await readCatalog(env));
    if (key === 'og-image') return ogImage('Angle', 'Stories worth listening.');
    if (path[0] === 'og-image' && path[1] === 'category' && path.length === 3) {
      const category = resolveCategory(path[2], categoriesFor(await readCatalog(env)));
      if (!category) return failure('Category not found', 404);
      const label = category === 'new' ? 'New' : category === 'popular' ? 'Popular' : category;
      return ogImage(`${label} Stories`, `${label} stories worth listening.`);
    }
    if (['episodes', 'og-image'].includes(path[0]) && path.length === 2) {
      if (!/^[a-zA-Z0-9_-]+$/.test(path[1])) return failure('Invalid episode ID', 400);
      const episode = await readEpisode(env, path[1]);
      if (!episode) return failure('Episode not found', 404);
      return path[0] === 'episodes' ? Response.json({ success: true, data: episode })
        : ogImage(episode.title, episode.fullDescription || episode.description || 'Stories worth listening.', episode.category);
    }
    return failure('Not found', 404);
  } catch (error) {
    const status = error instanceof CatalogError ? error.status : 500;
    console.error(JSON.stringify({ message: 'API request failed', path: path.join('/'), status }));
    return failure(status === 500 ? 'Internal server error' : 'Catalog is unavailable', status);
  }
}
