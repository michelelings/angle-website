import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { ogImage } from '../lib/server/og';
import { socialImage } from '../lib/server/og-store';
import { fitTitle, lineCount } from '../lib/server/og-title';
import { pageMetadata } from '../lib/metadata';
import { readableArtworkColor } from '../lib/artwork-palette';
import type { Env } from '../worker/catalog';

function env(overrides: Partial<Env> = {}): Env {
  return { PUBLIC_ORIGIN: 'https://www.newsangle.co', ENVIRONMENT: 'test', ANGLE_API_ORIGIN: 'https://backend.example',
    ASSETS: { async fetch(request: Request) {
      const path = new URL(request.url).pathname;
      if (path.startsWith('/fonts/') || path === '/images/logo.svg') return new Response(await readFile(`public${path}`));
      return new Response('', { status: 404 });
    } }, ...overrides };
}
// Production serves backend artwork as WebP through the service binding.
function backend(cover: Buffer, type: string, requests: string[] = []): Env['ANGLE_BACKEND'] {
  return { fetch: async request => {
    const url = new URL(request.url);
    requests.push(url.pathname + url.search);
    return url.pathname === '/v2/media/cover' ? new Response(cover, { headers: { 'Content-Type': type } }) : new Response('', { status: 404 });
  } };
}
// A sharp-backed Images binding; nearest-neighbour sampling keeps the test palette exact.
function images(png: (image: sharp.Sharp) => sharp.Sharp, transforms: unknown[] = []): Env['IMAGES'] {
  return { input: stream => {
    const operations: { width?: number; height?: number; fit?: string }[] = [];
    const transformer = {
      transform(operation: { width?: number; height?: number; fit?: string }) { operations.push(operation); transforms.push(operation); return transformer; },
      async output({ format, quality }: { format: string; quality?: number }) {
        let image = sharp(Buffer.from(await new Response(stream).arrayBuffer()));
        for (const { width, height, fit } of operations) image = image.resize(width ?? null, height ?? null,
          { fit: fit === 'squeeze' ? 'fill' : 'inside', withoutEnlargement: fit === 'scale-down', kernel: 'nearest' });
        const bytes = await (format === 'image/png' ? png(image) : image.jpeg({ quality })).toBuffer();
        return { response: () => new Response(bytes, { headers: { 'Content-Type': format } }) };
      },
    };
    return transformer;
  } } as Env['IMAGES'];
}
const pixel = async (bytes: Buffer, left: number, top: number) =>
  [...await sharp(bytes).extract({ left, top, width: 1, height: 1 }).removeAlpha().raw().toBuffer()];
const channels = (color: string) => color.match(/\d+/g)!.map(Number);
const near = (actual: number[], expected: number[], message: string) =>
  assert.ok(actual.every((value, i) => Math.abs(value - expected[i]) <= 2), `${message}: ${actual} vs ${expected}`);

// Three bands give the palette an exact first-seen order: top, middle, bottom. The 64px
// sample only widens this portrait, so resizing cannot blend the bands into extra colors.
const bands = async (colors: number[][]) => sharp(Buffer.concat(colors.flatMap((color, i) =>
  Array(i ? 16 : 32).fill(Buffer.from(Array(48).fill(color).flat())))), { raw: { width: 48, height: 64, channels: 3 } }).webp({ lossless: true }).toBuffer();

for (const [variant, encode] of [
  ['RGB', (image: sharp.Sharp) => image.png()],
  ['RGBA', (image: sharp.Sharp) => image.ensureAlpha().png()],
  ['palette', (image: sharp.Sharp) => image.png({ palette: true, colours: 3, dither: 0 })],
] as const) {
  test(`backend WebP artwork is converted and colors the page mesh (${variant} sample)`, async () => {
    const [top, middle, bottom] = [[220, 80, 60], [40, 90, 160], [60, 150, 90]];
    const requests: string[] = [], transforms: unknown[] = [];
    const response = await ogImage({ title: 'A new perspective', category: 'Politics', coverImage: 'https://backend.example/v2/media/cover', duration: 623 },
      env({ ANGLE_BACKEND: backend(await bands([top, middle, bottom]), 'image/webp', requests), IMAGES: images(encode, transforms) }));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type')!, /image\/png/);
    assert.deepEqual(requests, ['/v2/media/cover?size=medium']);
    assert.deepEqual(transforms, [{ width: 800, fit: 'scale-down' }, { width: 64, height: 64, fit: 'squeeze' }]);
    const bytes = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, 1200); assert.equal(metadata.height, 630);
    near(await pixel(bytes, 60, 60), top, 'Portrait fills the top of its frame');
    // Neither radial gradient reaches the bottom centre, leaving the second mesh color.
    near(await pixel(bytes, 600, 629), channels(readableArtworkColor({ r: middle[0], g: middle[1], b: middle[2] })), 'Mesh base color');
  });
}
test('without the Images binding, JPEG artwork is used directly and WebP falls back to a text card', async () => {
  const defaultBase = [38, 57, 74];
  const jpeg = await sharp({ create: { width: 300, height: 400, channels: 3, background: '#dc503c' } }).jpeg().toBuffer();
  const direct = Buffer.from(await (await ogImage({ title: 'A new perspective', coverImage: 'https://backend.example/v2/media/cover' },
    env({ ANGLE_BACKEND: backend(jpeg, 'image/jpeg') }))).arrayBuffer());
  near(await pixel(direct, 60, 60), [220, 80, 60], 'JPEG artwork');
  near(await pixel(direct, 600, 629), defaultBase, 'Default mesh base color');
  const webp = await sharp({ create: { width: 300, height: 400, channels: 3, background: '#dc503c' } }).webp().toBuffer();
  const fallback = Buffer.from(await (await ogImage({ title: 'A new perspective', category: 'Politics', coverImage: 'https://backend.example/v2/media/cover' },
    env({ ANGLE_BACKEND: backend(webp, 'image/webp') }))).arrayBuffer());
  assert.equal((await sharp(fallback).metadata()).width, 1200);
  const corner = await pixel(fallback, 60, 60);
  assert.ok(corner[0] < 150, `No artwork is drawn: ${corner}`);
});
test('titles use at most three lines and shorten with an ellipsis inside the title area', async () => {
  const box = { width: 590, height: 327, lines: 3, max: 92, min: 56, lineHeight: 0.98 };
  const long = 'Why the drone operators who once flew every mission by hand are now asked to supervise swarms they can no longer see, steer or recall in time';
  assert.deepEqual(fitTitle('No Hands on the Stick', box), { size: 92, text: 'No Hands on the Stick' });
  assert.deepEqual(fitTitle('Technology\nstories.', box), { size: 92, text: 'Technology\nstories.' });
  const shortened = fitTitle(long, box);
  assert.equal(shortened.size, 56);
  assert.match(shortened.text, /^Why the drone operators .*[^\s,]…$/);
  const kept = shortened.text.slice(0, -1).split(' ').length;
  assert.ok(lineCount(shortened.text, box.width * 0.97 / 56)! <= 3);
  assert.ok(lineCount(`${long.split(' ').slice(0, kept + 1).join(' ')}…`, box.width * 0.97 / 56)! > 3, 'Keeps every word that fits');
  const word = fitTitle('Counterintelligencemisadventures', box);
  assert.equal(lineCount(word.text, box.width * 0.97 / word.size), 1, 'Words never break');
  const gray = await sharp({ create: { width: 300, height: 400, channels: 3, background: '#555' } }).jpeg().toBuffer();
  for (const title of [long, 'Counterintelligencemisadventures', 'WHAT WAS WON, WHAT WAS WORN: MMM WWW MWMW WMWM MW WMW MMMM WWWW', `${'International security and governance '.repeat(6)}`]) {
    const bytes = Buffer.from(await (await ogImage({ title, category: 'Security', coverImage: 'https://backend.example/v2/media/cover', duration: 600 },
      env({ ANGLE_BACKEND: backend(gray, 'image/jpeg') }))).arrayBuffer());
    const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let top = Infinity, bottom = -1, right = -1;
    // White title pixels stay between the logo row and the footer rule, within 90% of the column.
    for (let y = 108; y < 513; y++) for (let x = 496; x < info.width; x++) {
      const i = (y * info.width + x) * 3;
      if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) { top = Math.min(top, y); bottom = Math.max(bottom, y); right = Math.max(right, x); }
    }
    assert.ok(top >= 112 && bottom <= 508 && right <= 1086, `${title.slice(0, 30)}… spans y ${top}–${bottom}, x to ${right}`);
  }
});
// An in-memory stand-in for the R2 bucket.
function bucket() {
  const objects = new Map<string, ArrayBuffer>();
  return { objects, binding: {
    get: async (key: string) => objects.has(key) ? { body: new Response(objects.get(key)).body } : null,
    put: async (key: string, value: ArrayBuffer) => { objects.set(key, value); },
  } as unknown as Env['SOCIAL_IMAGES'] };
}
test('social images render once, are stored in R2 and are served from storage afterwards', async () => {
  const store = bucket(), requests: string[] = [];
  const cover = await bands([[220, 80, 60], [40, 90, 160], [60, 150, 90]]);
  const context = env({ ANGLE_BACKEND: backend(cover, 'image/webp', requests), IMAGES: images(image => image.png()), SOCIAL_IMAGES: store.binding });
  const card = { title: 'A new perspective', category: 'Politics', coverImage: 'https://backend.example/v2/media/cover', duration: 623 };
  const first = await socialImage(context, 'episode/story', card);
  assert.equal(first.headers.get('X-Social-Image'), 'rendered');
  assert.equal(first.headers.get('Cache-Control'), 'public, max-age=3600');
  const bytes = Buffer.from(await first.arrayBuffer());
  assert.deepEqual([...store.objects.keys()].map(key => key.replace(/[0-9a-f]{24}/, 'hash')), ['artwork-4/episode/story/hash.png']);
  const second = await socialImage(context, 'episode/story', card);
  assert.equal(second.headers.get('X-Social-Image'), 'stored');
  assert.deepEqual(Buffer.from(await second.arrayBuffer()), bytes);
  assert.equal(requests.length, 1, 'Stored cards need no artwork');
  assert.equal((await socialImage(context, 'episode/story', { ...card, title: 'A corrected title' })).headers.get('X-Social-Image'), 'rendered');
  assert.equal(store.objects.size, 2, 'Changed content is stored under a new key');
});
test('cards drawn without their artwork are served but not stored', async () => {
  const store = bucket();
  const context = env({ ANGLE_BACKEND: backend(Buffer.alloc(0), 'image/webp'), IMAGES: images(image => image.png()), SOCIAL_IMAGES: store.binding });
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await socialImage(context, 'episode/story', { title: 'A new perspective', coverImage: 'https://backend.example/v2/media/missing' });
    assert.equal(response.headers.get('X-Social-Image'), 'rendered');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
  assert.equal(store.objects.size, 0);
});
test('missing artwork still produces a branded image with long text', async () => {
  const response = await ogImage({ title: 'International security and governance: understanding the decisions that shape our shared future', category: 'Greenland security announcement status decision channels and local stakes' }, env());
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal((await sharp(bytes).metadata()).width, 1200);
  assert.ok(bytes.length > 20_000);
});
test('Open Graph and Twitter use the same versioned preview image', () => {
  const metadata = pageMetadata('/business-and-technology', 'Business and technology', 'Stories', '/api/og-image/category/business-and-technology');
  const image = (metadata.openGraph!.images as { url: string }[])[0];
  assert.match(image.url, /\?v=artwork-4$/);
  assert.deepEqual(metadata.twitter!.images, [image.url]);
});
