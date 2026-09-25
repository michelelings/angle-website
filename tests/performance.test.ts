import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { publicCache } from '../worker/public-cache';
import { artworkResponse } from '../worker/artwork';
import { artworkProps, artworkUrl } from '../lib/artwork';
import { mapV2Episode, type Env } from '../worker/catalog';
import { readSearchDocuments } from '../lib/server/search';

const row = { id: 'story', title: 'Story', excerpt: 'Summary', coverUrl: 'https://media.example/cover.png', createdAt: '2026-09-25T08:00:00Z', availableModes: ['duo'], renditions: { duo: { url: 'https://media.example/audio.mp3', durationSeconds: 62 } } };
function environment(): Env {
  return { PUBLIC_ORIGIN: 'https://www.newsangle.co', ENVIRONMENT: 'production', ANGLE_API_ORIGIN: 'https://backend.example',
    ASSETS: { fetch: async () => new Response('', { status: 404 }) },
    ANGLE_BACKEND: { fetch: async request => Response.json(new URL(request.url).pathname.includes('/v2/episodes/') ? row : { catalogEpoch: 'angle-pipeline-v2', episodes: [row], nextOffset: null }) } };
}
function memoryCache(t: TestContext) {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'caches');
  let now = 0;
  const values = new Map<string, { response: Response; expires: number }>();
  const cache = {
    async match(request: Request) {
      const value = values.get(request.url);
      return value && value.expires > now ? value.response.clone() : undefined;
    },
    async put(request: Request, response: Response) {
      const seconds = Number(/max-age=(\d+)/.exec(response.headers.get('cache-control') || '')?.[1]);
      values.set(request.url, { response: response.clone(), expires: now + seconds });
    },
  };
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: { open: async () => cache } });
  t.after(() => { if (saved) Object.defineProperty(globalThis, 'caches', saved); else Reflect.deleteProperty(globalThis, 'caches'); });
  return { advance: (seconds: number) => { now += seconds; }, values };
}

test('public cache reuses successful data, expires it, and never caches failures', async t => {
  const cache = memoryCache(t); const env = environment(); let calls = 0;
  const load = async () => Response.json({ version: ++calls });
  assert.equal((await (await publicCache(env, 'catalog', 60, load)).json()).version, 1);
  assert.equal((await (await publicCache(env, 'catalog', 60, load)).json()).version, 1);
  cache.advance(61);
  assert.equal((await (await publicCache(env, 'catalog', 60, load)).json()).version, 2);
  let failures = 0;
  for (let i = 0; i < 2; i++) await publicCache(env, 'failure', 60, async () => { failures++; return new Response('', { status: 502 }); });
  assert.equal(failures, 2);
  await assert.rejects(publicCache(env, 'throws', 60, async () => { throw new Error('unavailable'); }));
});

test('search documents reuse the built index and refresh after five minutes', async t => {
  const cache = memoryCache(t); const env = environment(); let requests = 0;
  const original = env.ANGLE_BACKEND!.fetch;
  env.ANGLE_BACKEND!.fetch = async request => { requests++; return original(request); };
  await readSearchDocuments(env);
  assert.equal(requests, 2);
  await readSearchDocuments(env);
  assert.equal(requests, 2);
  cache.advance(301);
  await readSearchDocuments(env);
  assert.equal(requests, 4);
});

test('artwork validates requests, resizes once per version and width, and caches WebP', async t => {
  const cache = memoryCache(t); const env = environment(); const episode = mapV2Episode(row);
  let transforms = 0; let downloads = 0;
  const transformer: ImageTransformer = {
    transform(options) { assert.equal(options.width, 540); assert.equal(options.fit, 'scale-down'); transforms++; return this; },
    draw() { return this; },
    async output(options) {
      assert.equal(options.format, 'image/webp');
      return { response: () => new Response('webp'), image: () => new Response('webp').body!, contentType: () => 'image/webp' };
    },
  };
  env.IMAGES = { input: () => transformer };
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    assert.equal(url, row.coverUrl); downloads++;
    return new Response('png', { headers: { 'Content-Type': 'image/png' } });
  });
  const request = new Request(new URL(artworkUrl(episode, 540), env.PUBLIC_ORIGIN));
  const first = await artworkResponse(request, episode.id, env);
  assert.equal(first.status, 200); assert.equal(first.headers.get('content-type'), 'image/webp');
  assert.match(first.headers.get('cache-control')!, /immutable/);
  await first.text();
  assert.equal((await artworkResponse(request, episode.id, env)).status, 200);
  assert.equal(downloads, 1); assert.equal(transforms, 1);
  const invalid = new Request(env.PUBLIC_ORIGIN + '/api/artwork/story?w=999&v=x');
  assert.equal((await artworkResponse(invalid, episode.id, env)).status, 400);
  assert.equal((await artworkResponse(request, 'bad!', env)).status, 400);
  const old = new Request(env.PUBLIC_ORIGIN + '/api/artwork/story?w=540&v=old');
  const redirected = await artworkResponse(old, episode.id, env);
  assert.equal(redirected.status, 307); assert.equal(redirected.headers.get('location'), artworkUrl(episode, 540));
  assert.equal(downloads, 1);
  assert.ok(![...cache.values.keys()].some(key => key.endsWith('/old')));
  assert.notEqual(artworkUrl({ ...episode, coverImage: row.coverUrl + '?v=2' }, 540), artworkUrl(episode, 540));
  assert.ok(artworkProps(episode).srcSet?.includes('1080w'));
});

test('failed image transformations are not cached and allow a later recovery', async t => {
  memoryCache(t); const env = environment(); const episode = mapV2Episode(row);
  const request = new Request(new URL(artworkUrl(episode, 540), env.PUBLIC_ORIGIN));
  assert.equal((await artworkResponse(request, episode.id, env)).status, 503);
  env.IMAGES = { input() { throw new Error('failed'); } };
  t.mock.method(globalThis, 'fetch', async () => new Response('png', { headers: { 'Content-Type': 'image/png' } }));
  const failed = await artworkResponse(request, episode.id, env);
  assert.equal(failed.status, 502); assert.equal(failed.headers.get('cache-control'), 'no-store');
});

test('artwork from the backend origin uses its service binding instead of public Worker fetch', async t => {
  memoryCache(t); const env = environment();
  const backendRow = { ...row, coverUrl: env.ANGLE_API_ORIGIN + '/v2/media/cover' };
  const episode = mapV2Episode(backendRow); let mediaCalls = 0;
  env.ANGLE_BACKEND = { async fetch(request) {
    if (new URL(request.url).pathname === '/v2/media/cover') {
      mediaCalls++; return new Response('png', { headers: { 'Content-Type': 'image/png' } });
    }
    return Response.json({ catalogEpoch: 'angle-pipeline-v2', episodes: [backendRow], nextOffset: null });
  } };
  const transformer: ImageTransformer = {
    transform() { return this; }, draw() { return this; },
    async output() { return { response: () => new Response('webp'), image: () => new Response('webp').body!, contentType: () => 'image/webp' }; },
  };
  env.IMAGES = { input: () => transformer };
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Must use service binding'); });
  const response = await artworkResponse(new Request(new URL(artworkUrl(episode, 540), env.PUBLIC_ORIGIN)), episode.id, env);
  assert.equal(response.status, 200); assert.equal(mediaCalls, 1);
});
