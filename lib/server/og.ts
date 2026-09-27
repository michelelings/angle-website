import { ImageResponse } from 'next/og';
import { createElement as h, type CSSProperties } from 'react';
import { extractPalette, MmcqQuantizer, validateOptions } from 'colorthief/internals';
import { artworkPaletteOptions, readableArtworkColor } from '../artwork-palette';
import { categoryLabel } from '../catalog-copy';
import { decodePng } from './png';
import { fitTitle } from './og-title';
import type { Env } from '../../worker/catalog';

export type SocialCard = {
  /** Line breaks start a new line. */
  title: string;
  category?: string | null;
  coverImage?: string | null;
  duration?: number | null;
  artworks?: string[];
};
type Artwork = { image: string; mesh: string[] | null };
// The website's mesh before an artwork palette is known (@property initial values in app/episode.css).
const defaultMesh = ['rgb(49, 73, 75)', 'rgb(38, 57, 74)', 'rgb(81, 67, 53)'];
const box = (style: CSSProperties, ...children: React.ReactNode[]) => h('div', { style: { display: 'flex', ...style } }, ...children);
const picture = (src: string, width: number, height: number, style: CSSProperties = {}) => h('img', { src, width, height, style });

async function asset(env: Env, path: string): Promise<ArrayBuffer> {
  const response = await env.ASSETS.fetch(new Request(new URL(path, env.PUBLIC_ORIGIN)));
  if (!response.ok) throw new Error(`Social asset unavailable: ${path}`);
  return response.arrayBuffer();
}
const dataUrl = (bytes: ArrayBuffer, type: string) => `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;

// Same palette as the episode page: colorthief on a 64px sample, darkened for white text.
async function meshColors(png: Uint8Array<ArrayBuffer>): Promise<string[] | null> {
  const pixels = await decodePng(png);
  if (!pixels) console.warn('Social artwork sample is not a supported PNG');
  const palette = pixels && extractPalette(pixels.data, pixels.width, pixels.height, validateOptions(artworkPaletteOptions), new MmcqQuantizer());
  return palette?.length ? defaultMesh.map((fallback, i) => palette[i] ? readableArtworkColor(palette[i].rgb()) : fallback) : null;
}

// Backend artwork is WebP, which Satori cannot decode, so the Images binding converts it.
async function loadArtwork(url: string, env: Env): Promise<Artwork | null> {
  try {
    const source = new URL(url);
    const backend = source.origin === new URL(env.ANGLE_API_ORIGIN).origin;
    if (backend && /^\/v2\/media\/[a-zA-Z0-9_-]+$/.test(source.pathname)) source.searchParams.set('size', 'medium');
    const init = { redirect: 'manual' as const, signal: AbortSignal.timeout(4000) };
    const response = backend && env.ANGLE_BACKEND ? await env.ANGLE_BACKEND.fetch(new Request(source, init)) : await fetch(source, init);
    const type = response.headers.get('content-type')?.split(';')[0] || '';
    if (!response.ok || !response.body || !type.startsWith('image/') || Number(response.headers.get('content-length')) > 8 * 1024 * 1024) {
      console.error('Social artwork unavailable', { status: response.status, type });
      await response.body?.cancel();
      return null;
    }
    const images = env.IMAGES;
    if (!images) {
      if (type !== 'image/png' && type !== 'image/jpeg') { await response.body.cancel(); return null; }
      const bytes = await response.arrayBuffer();
      return bytes.byteLength <= 8 * 1024 * 1024 ? { image: dataUrl(bytes, type), mesh: null } : null;
    }
    const [art, sample] = response.body.tee();
    const [jpeg, mesh] = await Promise.all([
      images.input(art).transform({ width: 800, fit: 'scale-down' }).output({ format: 'image/jpeg', quality: 88 })
        .then(result => result.response().arrayBuffer()),
      images.input(sample).transform({ width: 64, height: 64, fit: 'squeeze' }).output({ format: 'image/png' })
        .then(result => result.response().arrayBuffer()).then(bytes => meshColors(new Uint8Array(bytes))).catch(() => null),
    ]);
    return { image: dataUrl(jpeg, 'image/jpeg'), mesh };
  } catch (cause) {
    console.error('Social artwork failed', { message: cause instanceof Error ? cause.message : String(cause) });
    return null;
  }
}

export async function ogImage(card: SocialCard, env: Env): Promise<Response> {
  const covers = card.coverImage ? [card.coverImage] : (card.artworks || []).slice(0, 3);
  const [[serif, medium, semibold, logo], loaded] = await Promise.all([
    Promise.all(['/fonts/RecklessCondensedS-Regular.woff', '/fonts/Inter-Medium.ttf', '/fonts/Inter-SemiBold.ttf', '/images/logo.svg'].map(path => asset(env, path))),
    Promise.all(covers.map(cover => loadArtwork(cover, env))),
  ]);
  const artwork = loaded.filter((value): value is Artwork => !!value);
  // A card drawn without its artwork or colors after a failed fetch must not be stored.
  const complete = artwork.length === covers.length && (!artwork.length || !!artwork[0].mesh);
  const [mesh1, mesh2, mesh3] = artwork[0]?.mesh || defaultMesh;
  // Satori blends `transparent` through black; fading each color out matches the browser.
  const clear = (color: string) => color.replace('rgb(', 'rgba(').replace(')', ', 0)');
  const episode = !!card.coverImage && artwork.length > 0;
  const textWidth = episode ? 655.5 : artwork.length ? 630 : 1010;
  // At most three lines within 90% of the space between the logo row and the footer
  // (534px column less 60px, 42px padding and 69px), leaving the title room on every side.
  const titleColumn = textWidth * 0.9;
  const { size: fontSize, text: title } = fitTitle(card.title.slice(0, 200),
    { width: titleColumn, height: (534 - 60 - 42 - 69) * 0.9, lines: 3, max: 92, min: 56, lineHeight: 0.98 });
  const duration = card.duration ? `${Math.floor(card.duration / 60)} min listen` : 'Listen to the story';
  // Background mirrors .artwork-mesh in app/episode.css.
  const tree = box({ width: 1200, height: 630, position: 'relative', overflow: 'hidden', color: '#fff', fontFamily: 'Inter', backgroundColor: mesh2,
    backgroundImage: `radial-gradient(ellipse at 0% 10%, ${mesh1} 0%, ${clear(mesh1)} 75%), radial-gradient(ellipse at 95% 0%, ${mesh3} 0%, ${clear(mesh3)} 75%)` },
    episode ? picture(artwork[0].image, 400.5, 534, { position: 'absolute', left: 48, top: 48, borderRadius: 14, objectFit: 'contain', boxShadow: '0 14px 48px rgba(0,0,0,0.22)' }) : null,
    !episode && artwork.length ? box({ position: 'absolute', right: -115, top: 118, width: 490, height: 460 },
      ...artwork.slice().reverse().map(({ image }, index) => picture(image, 252, 336, { position: 'absolute', left: index * 88, top: index * 28, transform: `rotate(${index * 9 - 14}deg)`, borderRadius: 12, boxShadow: '0 12px 35px rgba(0,0,0,0.3)', objectFit: 'contain' }))) : null,
    box({ position: 'absolute', left: episode ? 496.5 : 64, top: 48, width: textWidth, height: 534, flexDirection: 'column' },
      // Logo and category (or the Angle name), as on the website's artwork.
      box({ alignItems: 'center', gap: 16, height: 60 },
        picture(dataUrl(logo, 'image/svg+xml'), 48, 48),
        box({ minWidth: 0, fontSize: 36, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, card.category ? categoryLabel(card.category) : 'Angle')),
      box({ flex: 1, flexDirection: 'column', justifyContent: 'center', paddingTop: 22, paddingBottom: 20 },
        ...title.split('\n').map(line => box({ width: titleColumn, fontFamily: 'Reckless', fontSize, lineHeight: 0.98, textWrap: 'balance' }, line))),
      box({ borderTop: '1px solid rgba(255,255,255,0.23)', paddingTop: 24, alignItems: 'center', gap: 16, fontSize: 30, fontWeight: 500 },
        box({ width: 44, height: 44, borderRadius: 44, background: '#fff', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
          h('svg', { width: 15, height: 18, viewBox: '0 0 15 18' }, h('path', { d: 'M2 1L14 9L2 17Z', fill: mesh2 }))),
        episode ? duration : 'A fresh perspective. Worth a listen.',
        episode ? box({ marginLeft: 'auto', fontSize: 26, opacity: 0.8 }, 'Stories worth listening.') : null)));
  return new ImageResponse(tree, { width: 1200, height: 630, fonts: [
    { name: 'Reckless', data: serif, weight: 400, style: 'normal' },
    { name: 'Inter', data: medium, weight: 500, style: 'normal' },
    { name: 'Inter', data: semibold, weight: 600, style: 'normal' },
  ], headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600', 'X-Social-Card': complete ? 'complete' : 'partial' } });
}
