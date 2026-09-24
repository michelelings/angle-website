import assert from 'node:assert/strict';
import test from 'node:test';
import { apiResponse } from '../lib/server/api';
import { episodeJsonLd } from '../lib/metadata';
import { filterEpisodes } from '../lib/episodes';
import type { Env } from '../worker/catalog';
const row = { id: 'story-one', title: 'Story </script><script>bad</script>', excerpt: 'Summary', coverUrl: 'https://example.com/cover.webp', createdAt: '2026-09-24T08:00:00Z', category: 'Science & Tech', availableModes: ['duo'], renditions: { duo: { url: 'https://example.com/audio.mp3', durationSeconds: 62 } } };
function env(fail = false): Env {
  return { PUBLIC_ORIGIN: 'https://www.newsangle.co', ENVIRONMENT: 'preview', ANGLE_API_ORIGIN: 'https://backend.example',
    ASSETS: { fetch: async () => new Response('', { status: 404 }) },
    ANGLE_BACKEND: { async fetch(request: Request) {
      if (fail) return new Response('', { status: 503 });
      if (new URL(request.url).pathname.endsWith('/missing')) return new Response('', { status: 404 });
      return Response.json(new URL(request.url).pathname.includes('/v2/episodes/') ? row : { catalogEpoch: 'angle-pipeline-v2', episodes: [row], nextOffset: null });
    } } };
}
test('Next API retains catalog and episode response contracts, including missing and malformed IDs', async () => {
  const catalog = await (await apiResponse(['episodes'], env())).json();
  assert.equal(catalog.success, true); assert.equal(catalog.data[0].id, row.id);
  const detail = await (await apiResponse(['episodes', row.id], env())).json();
  assert.deepEqual(detail.data, catalog.data[0]);
  assert.equal((await apiResponse(['episodes', 'missing'], env())).status, 404);
  assert.equal((await apiResponse(['episodes', 'bad!'], env())).status, 400);
  assert.equal((await apiResponse(['other'], env())).status, 404);
  assert.equal((await apiResponse(['episodes'], env(true))).status, 502);
  assert.equal((await apiResponse(['ready'], env(true))).status, 502);
  assert.equal((await apiResponse(['health'], env(true))).status, 200);
});
test('sitemap and JSON-LD preserve canonical routes and escape untrusted text', async () => {
  const xml = await (await apiResponse(['sitemap'], env())).text();
  assert.match(xml, /https:\/\/www.newsangle.co\/science-and-tech/);
  assert.match(xml, /https:\/\/www.newsangle.co\/episode\/story-one/);
  const { data: [episode] } = await (await apiResponse(['episodes'], env())).json();
  assert.ok(!episodeJsonLd(episode).includes('</script>'));
  assert.equal(JSON.parse(episodeJsonLd(episode)).name, row.title);
  assert.equal(filterEpisodes([episode], 'popular').length, 1);
  assert.equal(filterEpisodes([episode], 'missing').length, 0);
});
