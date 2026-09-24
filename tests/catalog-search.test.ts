import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogHref, catalogResults } from '../lib/catalog-search';
import { createSearchIndex, searchDocument } from '../lib/search';
import { parseCatalog, mapV2Episode } from '../worker/catalog';
const episodes = parseCatalog({ success: true, data: [
  { id: 'one', title: 'Iran trade', category: 'World', createdAt: '2026-09-24', transcript: 'Iran sanctions', topicNames: ['Sanctions', 'Trade'] },
  { id: 'two', title: 'Iran technology', category: 'Technology', createdAt: '2026-09-23', topicNames: ['Trade'] },
  { id: 'three', title: 'Science', category: 'Technology', createdAt: '2026-09-22', topicNames: ['Research'] },
] });
const index = createSearchIndex(episodes.map(searchDocument));
test('query, category and topic combine while category counts retain other matches', () => {
  const result = catalogResults(episodes, index, 'irna', 'trade', 'World');
  assert.deepEqual(result.results.map(e => e.id), ['one']);
  assert.deepEqual(result.matching.map(e => e.id), ['one', 'two']);
  assert.deepEqual(result.topics.map(t => t.name), ['Sanctions', 'Trade']);
  assert.equal(catalogResults(episodes, index, 'iran', 'Research', 'World').results.length, 0);
});
test('no-results recovery preserves query and topic, and clearing restores the catalog', () => {
  const result = catalogResults(episodes, index, 'iran', 'Sanctions', 'Technology');
  assert.equal(result.results.length, 0);
  assert.equal(result.matching.length, 1);
  assert.equal(catalogResults(episodes, index, '', '', 'all').results.length, 3);
  assert.equal(catalogResults(episodes, index, 'Science', '', 'popular').results.length, 0);
  assert.equal(catalogHref('/technology', 'iran & trade', 'A/B'), '/technology?q=iran+%26+trade&topic=A%2FB');
  assert.equal(catalogHref('/', '', ''), '/');
});
test('topic chips use taxonomy names, excluding descriptive paragraphs', () => {
  const episode = mapV2Episode({ id: 'one', title: 'Iran', createdAt: '2026-09-24',
    coverUrl: 'https://example.com/cover.png', availableModes: ['duo'], renditions: { duo: { url: 'https://example.com/a.mp3' } },
    taxonomy: { topics: [{ name: 'Sanctions', description: 'A long description about sanctions.' }] } });
  assert.deepEqual(searchDocument(episode).topicNames, ['Sanctions']);
  assert.ok(searchDocument(episode).topics.includes('A long description about sanctions.'));
});
