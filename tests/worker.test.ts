import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import worker from '../worker/index';
import { parseCatalog, type Env } from '../worker/catalog';

const episode = { id: 'new-episode', title: 'Science & <Stories>', description: 'A "new" story',
  createdAt: '2026-09-24T08:00:00Z', category: 'Science & Technology', coverImage: 'https://media.example/cover.webp', audioUrl: 'https://media.example/audio.mp3',
  duration: 0, private_notes: 'must never be public' };
function env(rows: unknown[] = []): Env {
  return {
    PUBLIC_ORIGIN: 'https://www.newsangle.co', ENVIRONMENT: 'preview',
    ANGLE_API_ORIGIN: 'https://backend.example',
    ANGLE_BACKEND: { async fetch(request: Request) {
      const mapped = rows.map((row: any) => ({ ...row, excerpt: row.description, coverUrl: row.coverImage,
        availableModes: ['duo'], renditions: { duo: { durationSeconds: row.duration, url: row.audioUrl } } }));
      const path = new URL(request.url).pathname;
      if (path.startsWith('/v2/episodes/')) {
        const match = mapped.find(row => row.id === path.split('/').pop());
        return match ? Response.json(match) : new Response('Not found', { status: 404 });
      }
      return Response.json({ catalogEpoch: 'angle-pipeline-v2', episodes: mapped, nextOffset: null });
    } } as Fetcher,
    ASSETS: { async fetch(request: Request) {
      return new URL(request.url).pathname === '/index.html'
        ? new Response(await readFile(new URL('../legacy/index.html', import.meta.url), 'utf8'))
        : new Response('Not found', { status: 404 });
    } } as Fetcher,
  };
}
const request = (path: string, bindings = env(), method = 'GET') => worker.fetch(new Request('https://preview.example' + path, { method }), bindings);

test('gallery module and generated covers reach static assets without catalog access', async () => {
  const bindings = env();
  bindings.ANGLE_API_ORIGIN = '';
  bindings.ASSETS = { async fetch(input: Request) {
    return new Response(new URL(input.url).pathname);
  } } as Fetcher;
  for (const path of ['/js/gallery.js', '/js/story-dialog.js', '/styles/paper-ink.css', '/images/cover-renditions.json', '/images/covers/example-1000.webp']) {
    const response = await request(path, bindings);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), path);
  }
  const cover = await request('/images/covers/0123456789abcdef01234567-1000.webp', bindings);
  assert.equal(cover.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
  assert.notEqual((await request('/images/cover-renditions.json', bindings)).headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
});

test('empty catalog is valid and home/new do not require historical episodes', async () => {
  assert.deepEqual(await (await request('/api/episodes')).json(), { success: true, data: [] });
  assert.deepEqual(await (await request('/api/categories')).json(), { success: true, data: [] });
  assert.equal((await request('/new')).status, 200);
  const home = await request('/');
  assert.equal(home.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.match(await home.text(), /0 stories worth listening/);
});

test('catalog projects public fields, filters drafts, preserves zero and rejects malformed payloads', () => {
  const rows = parseCatalog({ success: true, data: [episode, { ...episode, id: 'draft', status: 'draft' }] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].duration, 0);
  assert.equal('private_notes' in rows[0], false);
  assert.throws(() => parseCatalog({ success: false, data: [] }));
  assert.throws(() => parseCatalog({ success: true, data: [{ ...episode, id: '../../bad' }] }));
  assert.throws(() => parseCatalog({ success: true, data: [episode, episode] }));
});

test('crawler HTML is escaped and uses one canonical origin', async () => {
  const result = await request('/episode/new-episode', env([episode]));
  const html = await result.text();
  assert.equal(result.status, 200);
  assert.match(html, /<title>Science &amp; &lt;Stories&gt; \| Angle<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/www.newsangle.co\/episode\/new-episode"/);
  assert.match(html, /A &quot;new&quot; story/);
});

test('category deep links and sitemap share the same slug', async () => {
  assert.equal((await request('/science-and-technology', env([episode]))).status, 200);
  const sitemap = await (await request('/sitemap.xml', env([episode]))).text();
  assert.match(sitemap, /https:\/\/www.newsangle.co\/science-and-technology/);
  assert.match(sitemap, /\/episode\/new-episode/);
  assert.equal((await request('/missing-category', env([episode]))).status, 404);
});

test('removed episode links return 404, not a redirect or a successful homepage', async () => {
  assert.equal((await request('/episode/old-episode')).status, 404);
  assert.equal((await request('/api/episodes/old-episode')).status, 404);
  assert.equal((await request('/images/missing.png')).status, 404);
  assert.equal((await request('/api/unknown')).status, 404);
  const rejected = env();
  rejected.ANGLE_BACKEND = { async fetch() { return new Response('Invalid request', { status: 400 }); } } as Fetcher;
  assert.equal((await request('/episode/legacy-id', rejected)).status, 404);
});

test('unconfigured or failed backend cannot look like an empty successful catalog', async () => {
  const unconfigured = env(); unconfigured.ANGLE_API_ORIGIN = '';
  assert.equal((await request('/api/episodes', unconfigured)).status, 503);
  assert.equal((await request('/api/ready', unconfigured)).status, 503);
  const failed = env(); failed.ANGLE_BACKEND = { async fetch() { return new Response('upstream failure', { status: 500 }); } } as Fetcher;
  const result = await request('/episode/new-episode', failed);
  assert.equal(result.status, 502);
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
});

test('HEAD, OPTIONS, unsupported methods and apex redirect', async () => {
  assert.equal(await (await request('/', env(), 'HEAD')).text(), '');
  assert.equal((await request('/api/episodes', env(), 'OPTIONS')).status, 204);
  assert.equal((await request('/api/episodes', env(), 'POST')).status, 405);
  const bindings = env(); bindings.ENVIRONMENT = 'production';
  const result = await worker.fetch(new Request('https://newsangle.co/new?from=test'), bindings);
  assert.equal(result.status, 308);
  assert.equal(result.headers.get('Location'), 'https://www.newsangle.co/new?from=test');
  const live = await worker.fetch(new Request('https://www.newsangle.co/robots.txt'), bindings);
  assert.equal(live.headers.has('X-Robots-Tag'), false);
  assert.match(await live.text(), /Allow: \//);
  const preview = await request('/robots.txt', bindings);
  assert.equal(preview.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.match(await preview.text(), /Disallow: \//);
});
