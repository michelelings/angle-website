import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEpisodeTaxonomy } from '../lib/episode-taxonomy';
import { mapV2Episode } from '../worker/catalog';

test('taxonomy projects public names and valid connections without private claim data', () => {
  const result = parseEpisodeTaxonomy({
    entities: [{ id: 'person', name: ' Person ', kind: 'person', wikidataId: 'Q42', claimIds: ['private'] }, { id: 'person', name: 'Duplicate' }, null, { id: 'empty', name: ' ' },
      { id: 'bad-identity', name: 'Bad identity', kind: 'person', wikidataId: 'wikidata-Q1' }],
    topics: [{ id: 'topic', name: 'Topic', kind: 'topic' }],
    relations: [{ id: 'relation', fromId: 'person', targetId: 'topic', explanation: 'A connection.', claimIds: ['private'] },
      { id: 'broken', fromId: 'person', targetId: 'absent', explanation: 'Missing endpoint.' }],
  });
  assert.deepEqual(result.entities, [{ id: 'person', name: 'Person', kind: 'person', wikidataId: 'Q42' },
    { id: 'bad-identity', name: 'Bad identity', kind: 'person', wikidataId: null }]);
  assert.deepEqual(result.connections, [{ id: 'relation', explanation: 'A connection.' }]);
  assert.doesNotMatch(JSON.stringify(result), /claimIds|private|Missing endpoint/);
});
test('absent or malformed taxonomy returns empty groups', () => {
  const empty = { entities: [], topics: [], connections: [] };
  assert.deepEqual(parseEpisodeTaxonomy(undefined), empty);
  assert.deepEqual(parseEpisodeTaxonomy({ entities: {}, topics: [null, 1], relations: ['invalid'] }), empty);
});
test('episode detail mapping carries taxonomy alongside existing topic search fields', () => {
  const episode = mapV2Episode({ id: 'episode', title: 'Title', createdAt: '2026-09-25', coverUrl: 'https://example.com/cover.webp', availableModes: ['duo'],
    renditions: { duo: { url: 'https://example.com/audio.mp3' } },
    taxonomy: { entities: [{ id: 'person', name: 'Person', kind: 'person' }], topics: [{ id: 'topic', name: 'Topic', description: 'Search copy' }] } });
  assert.equal(episode.taxonomy?.entities[0].name, 'Person');
  assert.deepEqual(episode.topicNames, ['Topic']);
  assert.deepEqual(episode.topics, ['Topic', 'Search copy']);
});
