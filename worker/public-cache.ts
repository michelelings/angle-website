import type { Env } from './catalog';

// Explicit Workers Cache API storage: Cache-Control alone does not populate it.
// No request cookies, authorization, or module-scoped I/O are retained.
export async function publicCache(env: Env, key: string, ttl: number, load: () => Promise<Response>): Promise<Response> {
  const enabled = env.ENVIRONMENT === 'production' && typeof caches !== 'undefined';
  if (!enabled) return load();
  const request = new Request(new URL(`/__angle_cache/v1/${encodeURIComponent(env.ANGLE_API_ORIGIN)}/${key}`, env.PUBLIC_ORIGIN));
  const cache = await caches.open('angle-public-v1').catch(() => null);
  const hit = await cache?.match(request).catch(() => undefined);
  if (hit) return hit;
  const response = await load();
  if (cache && response.status === 200) {
    const stored = new Response(response.clone().body, response);
    stored.headers.set('Cache-Control', `public, max-age=${ttl}`);
    await cache.put(request, stored).catch(() => { console.warn('Public cache write failed'); });
  }
  return response;
}
