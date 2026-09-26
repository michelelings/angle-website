import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { publicCache } from '../worker/public-cache';
import { artworkResponse, mediaArtworkResponse } from '../worker/artwork';
import { artworkProps, artworkUrl, artworkVariantUrl, progressiveArtworkProps } from '../lib/artwork';
import { mapV2Episode, readEpisode, type Env } from '../worker/catalog';
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

test('episode cache follows publication revisions, expires, and does not retain missing episodes', async t => {
  const cache = memoryCache(t); const env = environment();
  let revision = 'revision-one'; let details = 0; let status = 200;
  env.ANGLE_BACKEND = { async fetch(request) {
    const current = { ...row, revisionId: revision };
    if (new URL(request.url).pathname === '/v2/episodes/story') {
      assert.equal(new URL(request.url).searchParams.get('view'), 'website-v1');
      details++;
      return status === 200 ? Response.json(current) : new Response('', { status });
    }
    return Response.json({ catalogEpoch: 'angle-pipeline-v2', episodes: [current], nextOffset: null });
  } };
  const read = () => readEpisode(env, 'story', mapV2Episode({ ...row, revisionId: revision }));
  assert.equal((await read())?.revisionId, 'revision-one');
  await read();
  assert.equal(details, 1);
  revision = 'revision-two';
  // A fresh catalog item bypasses the old detail entry even before its TTL expires.
  assert.equal((await readEpisode(env, 'story', mapV2Episode({ ...row, revisionId: revision })))?.revisionId, revision);
  assert.equal(details, 2);
  cache.advance(61);
  await read();
  assert.equal(details, 3);
  cache.advance(61); status = 404;
  assert.equal(await read(), null);
  status = 200;
  assert.equal((await read())?.revisionId, revision);
  assert.equal(details, 5);
});

test('compact detail preserves solo-only transcript search, readable prose, and measured highlights', async () => {
  const env = environment();
  const compact = { ...row, availableModes: ['solo_eli'], renditions: { solo_eli: row.renditions.duo },
    transcripts: { solo: { chapters: [{ id: 'c1', title: 'Chapter', turns: [
      { id: 't1', text: 'Unique search phrase.' }, { id: 't2', text: 'Thanks for listening.' },
    ], segments: [{ id: 's1', turnIds: ['t1', 't2'] }] }] } },
    story: { version: 1, format: 'news', events: [], places: [] },
    companion: { keyFacts: [{ id: 'f1', text: 'Key fact' }] },
    playbackContext: { version: 1, contexts: { solo: [{ id: 'ctx', turnIds: ['t1'], keyFacts: [{ id: 'f1' }] }] },
      timelines: { solo_eli: [{ contextId: 'ctx', chapterId: 'c1', segmentId: 's1', start: 2, end: 12 }] } },
  };
  env.ANGLE_BACKEND = { async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname.includes('/v2/episodes/')) {
      assert.equal(url.searchParams.get('view'), 'website-v1');
      return Response.json(compact);
    }
    return Response.json({ catalogEpoch: 'angle-pipeline-v2', episodes: [compact], nextOffset: null });
  } };
  const detail = await readEpisode(env, 'story');
  assert.match(detail!.transcript!, /Unique search phrase/);
  assert.deepEqual(detail!.script?.[0].segments[0].paragraphs, ['Unique search phrase.']);
  assert.deepEqual(detail!.story?.moments, [{ start: 2, end: 12, eventIds: [], placeIds: [], keyFactIds: ['f1'], segment: 'c1/s1' }]);
  assert.match((await readSearchDocuments(env))[0].transcript, /Unique search phrase/);
});

test('native media artwork skips the catalog, uses a fixed origin, and caches converted variants', async t => {
  memoryCache(t); const env = environment(); const requests: string[] = [];
  env.ANGLE_BACKEND = { async fetch(request) {
    requests.push(request.url);
    assert.equal(new URL(request.url).origin, env.ANGLE_API_ORIGIN);
    assert.equal(new URL(request.url).pathname, '/v2/media/cover');
    return new Response('png', { headers: { 'Content-Type': 'image/png' } });
  } };
  const widths: number[] = [];
  env.IMAGES = { input: () => ({
    transform(options) { widths.push(options.width!); return this; }, draw() { return this; },
    async output() { return { response: () => new Response('webp'), image: () => new Response('webp').body!, contentType: () => 'image/webp' }; },
  }) };
  for (const size of ['small', 'medium', 'small']) {
    const response = await mediaArtworkResponse(new Request(`${env.PUBLIC_ORIGIN}/api/artwork/media/cover?size=${size}&url=https://untrusted.example`), 'cover', env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/webp');
  }
  assert.equal(requests.length, 2);
  assert.deepEqual(widths, [400, 960]);
  assert.equal((await mediaArtworkResponse(new Request(`${env.PUBLIC_ORIGIN}/?size=small`), '../private', env)).status, 400);
  const episode = mapV2Episode({ ...row, coverUrl: 'https://angle-api.footy.workers.dev/v2/media/cover' });
  assert.deepEqual(progressiveArtworkProps(episode), { src: '/api/artwork/media/cover?size=small', fullSrc: '/api/artwork/media/cover?size=medium' });
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
      assert.equal(request.redirect, 'manual');
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

test('prepared WebP variants are streamed directly without a transformation binding', async t => {
  memoryCache(t); const env = environment();
  const nativeRow = { ...row, coverUrl: env.ANGLE_API_ORIGIN + '/v2/media/cover' };
  const episode = mapV2Episode(nativeRow);
  const requested: string[] = [];
  env.ANGLE_BACKEND = { async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/v2/media/cover') {
      requested.push(url.searchParams.get('size')!);
      return new Response('prepared-' + url.searchParams.get('size'), { headers: { 'Content-Type': 'image/webp' } });
    }
    return Response.json({ catalogEpoch: 'angle-pipeline-v2', episodes: [nativeRow], nextOffset: null });
  } };
  const props = progressiveArtworkProps(episode);
  assert.equal(props.src, artworkVariantUrl(episode, 'small'));
  assert.equal(props.fullSrc, artworkVariantUrl(episode, 'medium'));
  for (const size of ['small', 'medium', 'original'] as const) {
    const response = await artworkResponse(new Request(new URL(artworkVariantUrl(episode, size), env.PUBLIC_ORIGIN)), episode.id, env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'image/webp');
    assert.equal(await response.text(), 'prepared-' + size);
  }
  assert.deepEqual(requested, ['small', 'medium', 'original']);
});

test('historical PNGs become small WebP previews and full-resolution WebP originals', async t => {
  memoryCache(t); const env = environment(); const episode = mapV2Episode(row);
  const transforms: unknown[] = [], qualities: unknown[] = [];
  env.IMAGES = { input: () => ({
    transform(options) { transforms.push(options); return this; },
    draw() { return this; },
    async output(options) { qualities.push(options.quality); return {
      response: () => new Response('converted'), image: () => new Response('converted').body!, contentType: () => 'image/webp',
    }; },
  }) };
  t.mock.method(globalThis, 'fetch', async () => new Response('png', { headers: { 'Content-Type': 'image/png' } }));
  for (const size of ['small', 'original'] as const) {
    const response = await artworkResponse(new Request(new URL(artworkVariantUrl(episode, size), env.PUBLIC_ORIGIN)), episode.id, env);
    assert.equal(response.headers.get('Content-Type'), 'image/webp');
    await response.text();
  }
  assert.deepEqual(transforms, [{ width: 400, height: 400, fit: 'scale-down' }]);
  assert.deepEqual(qualities, [82, 90]);
  for (const query of ['size=huge', 'size=original&w=540']) {
    const response = await artworkResponse(new Request(`${env.PUBLIC_ORIGIN}/api/artwork/story?${query}&v=x`), 'story', env);
    assert.equal(response.status, 400);
  }
});
