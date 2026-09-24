import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { ogImage } from '../lib/server/og';
import { pageMetadata } from '../lib/metadata';
import type { Env } from '../worker/catalog';

function env(files: Record<string, Uint8Array | string> = {}): Env {
  return { PUBLIC_ORIGIN: 'https://www.newsangle.co', ENVIRONMENT: 'test', ANGLE_API_ORIGIN: 'https://backend.example',
    ASSETS: { async fetch(request: Request) {
      const path = new URL(request.url).pathname;
      if (path in files) return new Response(files[path] as BodyInit);
      if (path.startsWith('/fonts/') || path === '/images/logo.svg') return new Response(await readFile(`public${path}`));
      return new Response('', { status: 404 });
    } },
  };
}
test('social artwork renders inside a 1200 by 630 PNG using local assets', async () => {
  const cover = await sharp({ create: { width: 300, height: 400, channels: 3, background: '#dc503c' } }).jpeg().toBuffer();
  const response = await ogImage({ title: 'A new perspective', label: 'Politics', coverImage: 'https://artwork.example/cover.png', duration: 623 }, env({
    '/images/cover-renditions.json': JSON.stringify({ 'https://artwork.example/cover.png': { socialArtwork: '/images/covers/test.jpg' } }),
    '/images/covers/test.jpg': cover,
  }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type')!, /image\/png/);
  const bytes = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, 1200); assert.equal(metadata.height, 630);
  const pixel = await sharp(bytes).extract({ left: 60, top: 90, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
  assert.ok(pixel[0] > 200 && pixel[1] < 100 && pixel[2] < 100, 'Portrait fills the top of its frame without bands');
});
test('missing artwork and manifest still produce a branded image with long text', async () => {
  const response = await ogImage({ title: 'International security and governance: understanding the decisions that shape our shared future', label: 'Stories worth listening.' }, env());
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal((await sharp(bytes).metadata()).width, 1200);
  assert.ok(bytes.length > 20_000);
});
test('Open Graph and Twitter use the same versioned preview image', () => {
  const metadata = pageMetadata('/business-and-technology', 'Business and technology', 'Stories', '/api/og-image/category/business-and-technology');
  const image = (metadata.openGraph!.images as { url: string }[])[0];
  assert.match(image.url, /\?v=artwork-2$/);
  assert.deepEqual(metadata.twitter!.images, [image.url]);
});
