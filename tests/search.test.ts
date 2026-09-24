import assert from 'node:assert/strict';
import test from 'node:test';
import { performance } from 'node:perf_hooks';
import { createSearchIndex, searchEpisodes, type SearchDocument } from '../lib/search';
import { apiResponse } from '../lib/server/api';
import type { Env } from '../worker/catalog';
const doc = (id: string, overrides: Partial<SearchDocument> = {}): SearchDocument => ({
  id, title: 'A story', category: 'World', topics: [], transcript: '', coverImage: null,
  createdAt: '2026-09-24T00:00:00Z', ...overrides,
});
test('instant search ranks title, topic, category and transcript matches, including partial words', () => {
  const index = createSearchIndex([
    doc('transcript', { transcript: 'The Iranian government discussed trade.' }),
    doc('category', { category: 'Iran' }), doc('topic', { topics: ['Iran relations'] }),
    doc('title', { title: 'Iran and the world' }), doc('unrelated'),
  ]);
  assert.deepEqual(searchEpisodes(index, 'IRAN').map(r => r.document.id), ['title', 'topic', 'category', 'transcript']);
  assert.equal(searchEpisodes(index, 'iran trade')[0].document.id, 'transcript');
  assert.equal(searchEpisodes(index, 'iran trade')[0].matchedField, 'Transcript');
  assert.equal(searchEpisodes(index, '  ').length, 0);
  assert.equal(searchEpisodes(index, 'unknown').length, 0);
  assert.equal(searchEpisodes(createSearchIndex([doc('accent', { title: 'Café' })]), 'cafe').length, 1);
});
test('terms can match across fields and transcript excerpts include the matching passage', () => {
  const index = createSearchIndex([doc('one', { title: 'Trade', transcript: 'Opening words. '.repeat(80) + 'Iranian policy changed.' })]);
  assert.equal(searchEpisodes(index, 'trade iran').length, 1);
  const result = searchEpisodes(index, 'iran')[0];
  assert.match(result.excerpt, /Iranian/);
  assert.ok(result.excerpt.startsWith('…'));
});
test('search index hydrates detail-only taxonomy and full transcripts without exposing arbitrary fields', async () => {
  const row = { id: 'one', title: 'Trade', category: 'World', coverUrl: 'https://example.com/cover.webp',
    createdAt: '2026-09-24T00:00:00Z', availableModes: ['duo'], renditions: { duo: { url: 'https://example.com/audio.mp3' } } };
  const env = { ANGLE_API_ORIGIN: 'https://example.com', ANGLE_BACKEND: { async fetch(request: Request) {
    return Response.json(new URL(request.url).pathname === '/v2/episodes'
      ? { catalogEpoch: 'angle-pipeline-v2', episodes: [row], nextOffset: null }
      : { ...row, privateNotes: 'secret', taxonomy: { topics: [{ name: 'Diplomacy', description: 'International relations' }] },
        transcripts: { duo: { chapters: [{ title: 'Policy', turns: [{ text: 'Iranian trade.' }] }] } } });
  } } } as Env;
  const response = await apiResponse(['search-index'], env);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Cache-Control')!, /max-age=60/);
  const { data } = await response.json();
  assert.equal(searchEpisodes(createSearchIndex(data), 'iran')[0].document.id, 'one');
  assert.equal(searchEpisodes(createSearchIndex(data), 'diplomacy')[0].matchedField, 'Topic');
  assert.equal(JSON.stringify(data).includes('secret'), false);
  env.ANGLE_BACKEND = { fetch: async () => new Response('', { status: 503 }) };
  const failed = await apiResponse(['search-index'], env);
  assert.equal(failed.status, 502);
  assert.equal(failed.headers.has('Cache-Control'), false);
});
test('local search stays below 100ms for a representative 1000-story catalog', () => {
  const index = createSearchIndex(Array.from({ length: 1000 }, (_, i) => doc(String(i), {
    transcript: 'A discussion about international policy and trade. '.repeat(200) + (i % 5 ? '' : 'Iranian relations.'),
  })));
  const start = performance.now();
  assert.equal(searchEpisodes(index, 'iran').length, 200);
  const elapsed = performance.now() - start;
  console.log(`1000-story search: ${elapsed.toFixed(1)}ms`);
  assert.ok(elapsed < 100, `Search took ${elapsed}ms`);
});

test('fuzzy search handles swapped, missing, extra and mistyped letters across all fields', () => {
  for (const field of ['title', 'topics', 'category', 'transcript'] as const) {
    const value = 'Iran sanctions';
    const index = createSearchIndex([doc(field, { [field]: field === 'topics' ? [value] : value })]);
    for (const query of ['irna', 'iraan', 'irwn', 'santions', 'sancitons']) {
      assert.equal(searchEpisodes(index, query)[0]?.document.id, field, `${field}: ${query}`);
    }
  }
  const index = createSearchIndex([doc('prefix', { transcript: 'Iranian policy' })]);
  assert.equal(searchEpisodes(index, 'irna')[0]?.document.id, 'prefix');
  assert.equal(searchEpisodes(index, 'irna polciy')[0]?.document.id, 'prefix');
  assert.equal(searchEpisodes(index, 'irna missing').length, 0);
});

test('literal matches outrank fuzzy titles; short queries and unrelated words stay precise', () => {
  const index = createSearchIndex([doc('fuzzy', { title: 'Iran' }), doc('literal', { transcript: 'An irna report' })]);
  assert.deepEqual(searchEpisodes(index, 'irna').map(r => r.document.id), ['literal', 'fuzzy']);
  assert.equal(searchEpisodes(createSearchIndex([doc('one', { title: 'Iran' })]), 'ira').length, 1);
  assert.equal(searchEpisodes(createSearchIndex([doc('one', { title: 'Iran' })]), 'irn').length, 0);
  assert.equal(searchEpisodes(index, 'banana').length, 0);
  const long = createSearchIndex([doc('long', { title: 'International' })]);
  assert.equal(searchEpisodes(long, 'internatoinl').length, 1);
});

test('fuzzy transcript excerpts show the corrected word and keep large-catalog searches fast', () => {
  const index = createSearchIndex(Array.from({ length: 1000 }, (_, i) => doc(String(i), {
    transcript: 'A discussion about international policy and trade. '.repeat(200) + (i % 5 ? '' : 'Iranian relations.'),
  })));
  const start = performance.now();
  const results = searchEpisodes(index, 'irna');
  const elapsed = performance.now() - start;
  assert.equal(results.length, 200);
  assert.match(results[0].excerpt, /Iranian/);
  assert.equal(results[0].matchedField, 'Transcript');
  console.log(`1000-story fuzzy search: ${elapsed.toFixed(1)}ms`);
  assert.ok(elapsed < 100, `Fuzzy search took ${elapsed}ms`);
});
