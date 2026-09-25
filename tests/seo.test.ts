import assert from 'node:assert/strict';
import test from 'node:test';
import { mapV2Episode } from '../worker/catalog';
import { sitemapResponse } from '../lib/server/sitemap';
import { filterEpisodes } from '../lib/episodes';
import { episodeMetadata, pageMetadata, searchMetadata } from '../lib/metadata';
import { createListeningTracker, type ListeningEvent } from '../lib/listening';

const base = { id: 'test', title: 'A story', createdAt: '2026-09-20', category: 'Technology',
  coverUrl: 'https://example.com/cover.png', availableModes: ['duo'],
  renditions: { duo: { url: 'https://example.com/audio.mp3' } } };

test('source projection rejects executable and credentialed links, preserves disclosure and structured transcript', () => {
  const episode = mapV2Episode({ ...base, updatedAt: '2026-09-23', asOf: '2026-09-19',
    presenters: { disclosure: 'Synthetic presenters.', hosts: { mara: { displayName: 'Mara' } } },
    sources: [{ url: 'javascript:alert(1)' }, { url: 'https://user:secret@example.com/' },
      { url: 'https://example.com/source', title: 'Source\n title' }, { url: 'https://example.com/source', title: 'Duplicate' }],
    transcripts: { duo: { chapters: [{ title: 'Context', turns: [{ speaker: 'mara', text: 'An attributed account.' }] }] } },
  });
  assert.deepEqual(episode.sources, [{ url: 'https://example.com/source', title: 'Source title', publisher: null }]);
  assert.equal(episode.presenterDisclosure, 'Synthetic presenters.');
  assert.equal(episode.chapters?.[0].turns[0].speaker, 'Mara');
  assert.match(episode.transcript!, /An attributed account/);
  assert.equal(episode.updatedAt, '2026-09-23T00:00:00.000Z');
  assert.equal(mapV2Episode({ ...base, updatedAt: 'invalid' }).updatedAt, null);
});

test('sitemap uses content dates and only includes the main catalog, about, and episodes', async () => {
  const episode = mapV2Episode({ ...base, updatedAt: '2026-09-23' });
  const xml = await sitemapResponse([episode]).text();
  assert.match(xml, /<lastmod>2026-09-23<\/lastmod>/);
  assert.ok(!xml.includes('/new</loc>') && !xml.includes('/home-v2</loc>') && !xml.includes('/popular</loc>'));
  assert.ok(!xml.includes('/technology</loc>'));
  assert.equal((xml.match(/<loc>/g) || []).length, 3);
  assert.ok(!(await sitemapResponse([mapV2Episode({ ...base, listenCount: 4 })]).text()).includes('/popular</loc>'));
});

test('popular requires actual listens and ranks by count', () => {
  const episodes = [mapV2Episode(base), mapV2Episode({ ...base, id: 'two', listenCount: 2 }), mapV2Episode({ ...base, id: 'three', listenCount: 8 })];
  assert.deepEqual(filterEpisodes(episodes, 'popular').map(e => e.id), ['three', 'two']);
});

test('search results are noindex without a conflicting collection canonical', () => {
  const baseMeta = pageMetadata();
  assert.equal(searchMetadata(baseMeta, {}).alternates?.canonical, 'https://www.newsangle.co/');
  assert.deepEqual(searchMetadata(baseMeta, { q: 'technology' }).robots, { index: false, follow: true });
  assert.equal(searchMetadata(baseMeta, { q: 'technology' }).alternates, undefined);
  const episode = mapV2Episode({ ...base, excerpt: 'A long statement '.repeat(35) });
  assert.ok(String(episodeMetadata(episode).description).length < 200);
  assert.equal(episode.fullDescription, 'A long statement '.repeat(35));
});

test('listening events deduplicate starts and milestones and do not credit seeking to the end', () => {
  const events: ListeningEvent[] = [];
  const tracker = createListeningTracker(event => events.push(event));
  tracker.start(0); tracker.start(0);
  for (let time = 1; time <= 30; time++) tracker.sample(time, 100);
  tracker.resetPosition(); tracker.sample(99, 100); tracker.end(100);
  assert.deepEqual(events, [{ name: 'audio_start' }, { name: 'audio_progress', percent: 25 }]);
  tracker.start(30);
  for (let time = 31; time <= 100; time++) tracker.sample(time, 100);
  tracker.end(100); tracker.end(100);
  assert.deepEqual(events.map(e => e.name), ['audio_start', 'audio_progress', 'audio_progress', 'audio_progress', 'audio_complete']);
});
