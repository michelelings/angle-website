import assert from 'node:assert/strict';
import test from 'node:test';
import { mapV2Episode } from '../worker/catalog';
import { formatMinutes } from '../lib/episodes';

const row = {
  id: '8094ea4c-7a61-42cc-8d30-67b803de7a74',
  revisionId: '56f40d7d-1e50-4abd-93bd-f2172537ff9a',
  title: 'Who Said Go Before the Breach',
  excerpt: 'The full summary stays separate.',
  createdAt: '2026-09-25',
  coverUrl: 'https://example.com/artwork.webp',
  availableModes: ['duo'],
  renditions: { duo: { url: 'https://example.com/audio.mp3', durationSeconds: 506 } },
};

test('cards receive the published editorial hook without changing the summary', () => {
  const episode = mapV2Episode(row);
  assert.match(episode.hookLine!, /^An OpenAI agent paused/);
  assert.equal(episode.description, row.excerpt);
  assert.equal(episode.fullDescription, row.excerpt);
  assert.equal(mapV2Episode({ ...row, hookLine: 'A new API hook.' }).hookLine, 'A new API hook.');
});

test('a different revision or episode never inherits old hook copy or the summary', () => {
  assert.equal(mapV2Episode({ ...row, revisionId: 'new-revision' }).hookLine, null);
  assert.equal(mapV2Episode({ ...row, id: 'different-episode' }).hookLine, null);
});

test('duration displays completed whole minutes', () => {
  assert.equal(formatMinutes(506), '8 minutes');
  assert.equal(formatMinutes(119), '1 minute');
  assert.equal(formatMinutes(null), '');
});
