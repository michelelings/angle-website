import { ARTWORK_WIDTHS, artworkUrl, artworkVersion } from '../lib/artwork';
import { CatalogError, readCatalog, type Env } from './catalog';
import { publicCache } from './public-cache';

export async function artworkResponse(request: Request, id: string, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const width = Number(url.searchParams.get('w'));
  const version = url.searchParams.get('v');
  const error = (status: number) => new Response('Artwork unavailable', { status, headers: { 'Cache-Control': 'no-store' } });
  if (!/^[a-zA-Z0-9_-]+$/.test(id) || !ARTWORK_WIDTHS.some(value => value === width) || !version || version.length > 2048) return error(400);
  try {
    const response = await publicCache(env, `artwork/${id}/${width}/${encodeURIComponent(version)}`, 31536000, async () => {
      const episode = (await readCatalog(env)).find(episode => episode.id === id);
      if (!episode?.coverImage) return error(404);
      if (version !== artworkVersion(episode)) return new Response(null, {
        status: 307, headers: { Location: artworkUrl(episode, width), 'Cache-Control': 'no-store' },
      });
      if (!env.IMAGES) return error(503);
      // Resolve sources exclusively from the public catalog; never proxy a client URL.
      const source = await fetch(episode.coverImage, { redirect: 'error', signal: AbortSignal.timeout(10_000) });
      if (!source.ok || !source.body || !source.headers.get('content-type')?.startsWith('image/')) return error(502);
      const result = await env.IMAGES.input(source.body).transform({ width, fit: 'scale-down' })
        .output({ format: 'image/webp', quality: 82 });
      return new Response(result.response().body, { headers: { 'Content-Type': 'image/webp' } });
    });
    const result = new Response(response.body, response);
    if (result.status === 200) result.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return result;
  } catch (cause) {
    return error(cause instanceof CatalogError ? cause.status : 502);
  }
}
