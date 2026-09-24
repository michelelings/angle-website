import { ImageResponse } from 'next/og';
import { createElement as h, type CSSProperties } from 'react';
import type { Env } from '../../worker/catalog';

export type SocialCard = {
  title: string;
  label?: string | null;
  coverImage?: string | null;
  duration?: number | null;
  artworks?: string[];
};
type Rendition = { socialArtwork?: string; socialBackground?: string };
const box = (style: CSSProperties, ...children: React.ReactNode[]) => h('div', { style: { display: 'flex', ...style } }, ...children);
const picture = (src: string, width: number, height: number, style: CSSProperties = {}) => h('img', { src, width, height, style });

async function asset(env: Env, path: string): Promise<ArrayBuffer> {
  const response = await env.ASSETS.fetch(new Request(new URL(path, env.PUBLIC_ORIGIN)));
  if (!response.ok) throw new Error(`Social asset unavailable: ${path}`);
  return response.arrayBuffer();
}
const dataUrl = (bytes: ArrayBuffer, type: string) => `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;

export async function ogImage(card: SocialCard, env: Env): Promise<Response> {
  const [serif, sans, logo, manifest] = await Promise.all([
    asset(env, '/fonts/RecklessCondensedS-Regular.woff'),
    asset(env, '/fonts/Inter-Regular.ttf'),
    asset(env, '/images/logo.svg'),
    asset(env, '/images/cover-renditions.json').then(bytes => JSON.parse(new TextDecoder().decode(bytes)) as Record<string, Rendition>).catch(() => ({} as Record<string, Rendition>)),
  ]);
  const covers = card.coverImage ? [card.coverImage] : (card.artworks || []).slice(0, 3);
  const images = await Promise.all(covers.map(async source => {
    try {
      const rendition = manifest[source];
      if (rendition?.socialArtwork) return dataUrl(await asset(env, rendition.socialArtwork), 'image/jpeg');
      // New episodes can appear between builds; retain their original artwork.
      const response = await fetch(source, { signal: AbortSignal.timeout(4000) });
      if (!response.ok || !/^image\/(png|jpeg)/.test(response.headers.get('content-type') || '')) return null;
      const bytes = await response.arrayBuffer();
      return bytes.byteLength <= 8 * 1024 * 1024 ? dataUrl(bytes, response.headers.get('content-type')!) : null;
    } catch { return null; }
  }));
  const artwork = images.filter((value): value is string => !!value);
  const backgroundPath = covers[0] && manifest[covers[0]]?.socialBackground;
  const background = backgroundPath ? await asset(env, backgroundPath).then(bytes => dataUrl(bytes, 'image/jpeg')).catch(() => null) : null;
  const episode = !!card.coverImage && artwork.length > 0;
  const titleSize = episode ? (card.title.length > 110 ? 50 : card.title.length > 80 ? 56 : 64) : (card.title.length > 65 ? 60 : 76);
  const textWidth = episode ? 658 : artwork.length ? 630 : 1010;
  const title = card.title.length > 190 ? card.title.slice(0, 187).trimEnd() + '…' : card.title;
  const duration = card.duration ? `${Math.floor(card.duration / 60)} min listen` : 'Listen to the story';
  const tree = box({ width: 1200, height: 630, position: 'relative', overflow: 'hidden', background: '#29324a', color: '#fff', fontFamily: 'Inter' },
    background ? picture(background, 1200, 630, { position: 'absolute', inset: 0 }) : box({ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(ellipse at 10% 5%, #ad654c 0%, transparent 65%), radial-gradient(ellipse at 95% 95%, #344ca2 0%, transparent 70%)' }),
    box({ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(110deg, rgba(14,18,35,0) 15%, rgba(14,18,35,0.3) 100%)' }),
    episode ? picture(artwork[0], 366, 488, { position: 'absolute', left: 48, top: 71, borderRadius: 14, objectFit: 'contain', boxShadow: '0 14px 48px rgba(0,0,0,0.22)' }) : null,
    !episode && artwork.length ? box({ position: 'absolute', right: -45, top: 118, width: 490, height: 460 },
      ...artwork.slice().reverse().map((image, index) => picture(image, 252, 336, { position: 'absolute', left: index * 88, top: index * 28, transform: `rotate(${index * 9 - 14}deg)`, borderRadius: 12, boxShadow: '0 12px 35px rgba(0,0,0,0.3)', objectFit: 'contain' }))) : null,
    box({ position: 'absolute', left: episode ? 462 : 64, top: 54, width: textWidth, height: 522, flexDirection: 'column' },
      box({ alignItems: 'center', gap: 14 }, picture(dataUrl(logo, 'image/svg+xml'), 46, 46),
        box({ fontFamily: 'Reckless', fontSize: 38, lineHeight: 1 }, 'Angle'),
        box({ marginLeft: 'auto', fontSize: 16, opacity: 0.72 }, 'newsangle.co')),
      box({ flex: 1, flexDirection: 'column', justifyContent: 'center', paddingTop: 22, paddingBottom: 20 },
        box({ fontSize: 16, letterSpacing: '1.8px', textTransform: 'uppercase', opacity: 0.8, marginBottom: 22 }, (card.label || 'Stories worth listening.').slice(0, 78)),
        box({ fontFamily: 'Reckless', fontSize: titleSize, lineHeight: 1.04, letterSpacing: '-0.8px', maxHeight: 325, overflow: 'hidden' }, title)),
      box({ borderTop: '1px solid rgba(255,255,255,0.23)', paddingTop: 24, alignItems: 'center', gap: 14, fontSize: 18 },
        box({ width: 38, height: 38, borderRadius: 38, background: '#fff', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
          h('svg', { width: 15, height: 18, viewBox: '0 0 15 18' }, h('path', { d: 'M2 1L14 9L2 17Z', fill: '#283143' }))),
        episode ? duration : 'A fresh perspective. Worth a listen.',
        episode ? box({ marginLeft: 'auto', fontSize: 16, opacity: 0.7 }, 'Stories worth listening.') : null)));
  return new ImageResponse(tree, { width: 1200, height: 630, fonts: [
    { name: 'Reckless', data: serif, weight: 400, style: 'normal' },
    { name: 'Inter', data: sans, weight: 400, style: 'normal' },
  ], headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' } });
}
