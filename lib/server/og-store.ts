import { ogImage, type SocialCard } from './og';
import { SOCIAL_IMAGE_VERSION } from '../site';
import type { Env } from '../../worker/catalog';

const headers = (source: 'stored' | 'rendered', cacheable: boolean) => ({
  'Content-Type': 'image/png',
  'Cache-Control': cacheable ? 'public, max-age=3600' : 'no-store',
  'X-Social-Image': source,
});

/**
 * Serves a social card from R2, rendering and storing it the first time. The key hashes
 * everything drawn on the card, so a changed title, cover or design renders exactly once.
 * Cards drawn without their artwork after a failed fetch are served but not stored.
 */
export async function socialImage(env: Env, name: string, card: SocialCard): Promise<Response> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(card))));
  const key = `${SOCIAL_IMAGE_VERSION}/${name}/${[...digest.slice(0, 12)].map(byte => byte.toString(16).padStart(2, '0')).join('')}.png`;
  const stored = await env.SOCIAL_IMAGES?.get(key).catch(() => null);
  if (stored) return new Response(stored.body, { headers: headers('stored', true) });
  const rendered = await ogImage(card, env);
  const complete = rendered.headers.get('X-Social-Card') === 'complete';
  const bytes = await rendered.arrayBuffer();
  if (complete) {
    await env.SOCIAL_IMAGES?.put(key, bytes, { httpMetadata: { contentType: 'image/png' } })
      .catch(cause => console.error('Social image not stored', { key, message: cause instanceof Error ? cause.message : String(cause) }));
  }
  return new Response(bytes, { headers: headers('rendered', complete) });
}
