import { ARTWORK_WIDTHS, artworkUrl, artworkVariantUrl, artworkVersion, type ArtworkSize } from '../lib/artwork';
import { CatalogError, readCatalog, type Env } from './catalog';
import { publicCache } from './public-cache';

export async function artworkResponse(request: Request, id: string, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const width = Number(url.searchParams.get('w'));
  const size = url.searchParams.get('size') as ArtworkSize | null;
  const version = url.searchParams.get('v');
  const error = (status: number) => new Response('Artwork unavailable', { status, headers: { 'Cache-Control': 'no-store' } });
  if (!/^[a-zA-Z0-9_-]+$/.test(id) || (size ? !['small', 'medium', 'original'].includes(size) || url.searchParams.has('w') : !ARTWORK_WIDTHS.some(value => value === width)) || !version || version.length > 2048) return error(400);
  try {
    const response = await publicCache(env, `artwork/${id}/${size || width}/${encodeURIComponent(version)}`, 31536000, async () => {
      const episode = (await readCatalog(env)).find(episode => episode.id === id);
      if (!episode?.coverImage) return error(404);
      if (version !== artworkVersion(episode)) return new Response(null, {
        status: 307, headers: { Location: size ? artworkVariantUrl(episode, size) : artworkUrl(episode, width), 'Cache-Control': 'no-store' },
      });
      // Resolve sources exclusively from the public catalog; never proxy a client URL.
      const sourceUrl = new URL(episode.coverImage);
      const nativeVariant = size && sourceUrl.origin === new URL(env.ANGLE_API_ORIGIN).origin && /^\/v2\/media\/[a-zA-Z0-9_-]+$/.test(sourceUrl.pathname);
      if (!env.IMAGES && !nativeVariant) return error(503);
      if (nativeVariant) sourceUrl.searchParams.set('size', size);
      const options = { redirect: 'manual' as const, signal: AbortSignal.timeout(10_000) };
      const source = env.ANGLE_BACKEND && sourceUrl.origin === new URL(env.ANGLE_API_ORIGIN).origin
        ? await env.ANGLE_BACKEND.fetch(new Request(sourceUrl, options))
        : await fetch(sourceUrl.href, options);
      if (!source.ok || !source.body || !source.headers.get('content-type')?.startsWith('image/')) {
        console.error('Artwork source unavailable', { id, status: source.status });
        await source.body?.cancel();
        return error(502);
      }
      if (nativeVariant && source.headers.get('content-type')?.split(';')[0] === 'image/webp') {
        return new Response(source.body, { headers: { 'Content-Type': 'image/webp' } });
      }
      if (!env.IMAGES) { await source.body.cancel(); return error(503); }
      // Historical PNG releases lack prepared variants. Keep the browser payload
      // small and WebP; the original variant retains its full pixel dimensions.
      let image = env.IMAGES.input(source.body);
      if (size !== 'original') image = image.transform(size
        ? { width: size === 'small' ? 400 : 960, height: size === 'small' ? 400 : 960, fit: 'scale-down' }
        : { width, fit: 'scale-down' });
      const result = await image.output({ format: 'image/webp', quality: size === 'original' ? 90 : 82 });
      return new Response(result.response().body, { headers: { 'Content-Type': 'image/webp' } });
    });
    const result = new Response(response.body, response);
    if (result.status === 200) result.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return result;
  } catch (cause) {
    console.error('Artwork optimization failed', { id, width, message: cause instanceof Error ? cause.message : String(cause) });
    return error(cause instanceof CatalogError ? cause.status : 502);
  }
}
