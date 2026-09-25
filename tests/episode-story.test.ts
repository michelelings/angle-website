import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEpisodeStory, storyEventDate, storyEventStatus } from '../lib/episode-story';
import { mapV2Episode } from '../worker/catalog';
const story = {
  version: 1, format: 'evergreen', hookLine: 'The hook', summary: 'The summary', whyItMatters: 'The stakes',
  angle: 'private', researchNotes: 'private',
  events: [
    { id: 'one', title: 'First event', date: '2026-10', datePrecision: 'month', status: 'scheduled', turnIds: ['t1'], claimIds: ['private'] },
    { id: 'two', title: 'Unmeasured event', turnIds: ['missing'] },
  ],
  places: [{ id: 'Q1', name: 'Place', role: 'primary_setting', latitude: 0, longitude: 0 }],
};
const playback = {
  version: 1,
  contexts: { duo: [{ id: 'd1', turnIds: ['t1'] }, { id: 'd2', turnIds: ['t1'] }], solo: [{ id: 's1', turnIds: ['t1'] }] },
  timelines: { duo: [{ contextId: 'd1', start: 90, end: 100 }, { contextId: 'd2', start: 0, end: 20 }], solo_mara: [{ contextId: 's1', start: 45, end: 55 }] },
};
test('story projection resolves earliest measured audio in the chosen rendition, including zero', () => {
  assert.equal(parseEpisodeStory(story, playback, 'duo', 120)?.events[0].startTime, 0);
  assert.equal(parseEpisodeStory(story, playback, 'solo_mara', 120)?.events[0].startTime, 45);
  assert.equal(parseEpisodeStory(story, playback, 'solo_eli', 120)?.events[0].startTime, null);
  assert.equal(parseEpisodeStory(story, playback, 'duo', 120)?.events[1].startTime, null);
});
test('missing or unsupported data never fabricates story content or playback positions', () => {
  assert.equal(parseEpisodeStory(undefined, playback, 'duo', 120), undefined);
  assert.equal(parseEpisodeStory({ ...story, version: 2 }, playback, 'duo', 120), undefined);
  assert.equal(parseEpisodeStory(story, { ...playback, version: 2 }, 'duo', 120)?.events[0].startTime, null);
  assert.equal(parseEpisodeStory(story, playback, 'solo_mara', 40)?.events[0].startTime, null);
});
test('only supplied valid coordinates are shown and private fields are excluded', () => {
  const result = parseEpisodeStory({ ...story, places: [...story.places,
    { id: 'Q2', name: 'No coordinates' }, { id: 'Q3', name: 'Invalid', latitude: 91, longitude: 0 },
    { id: 'Q4', name: 'Invalid', latitude: 30, longitude: Infinity }, ...story.places] }, playback, 'duo', 120)!;
  assert.equal(result.places.length, 1);
  assert.equal(result.places[0].latitude, 0);
  assert.doesNotMatch(JSON.stringify(result), /private|claimIds|turnIds|contexts|timelines/);
});
test('dates retain precision and future status is not inferred from the clock', () => {
  assert.equal(storyEventDate({ date: '1941', datePrecision: 'year' }), '1941');
  assert.equal(storyEventDate({ date: '2026-10', datePrecision: 'month' }), 'October 2026');
  assert.equal(storyEventDate({ date: '1951-04-27', datePrecision: 'day' }), 'Apr 27, 1951');
  assert.equal(storyEventDate({ date: '', datePrecision: 'unknown' }), 'Date not specified');
  assert.equal(storyEventStatus('scheduled'), 'Scheduled');
  assert.equal(storyEventStatus('planned'), 'Expected');
  assert.equal(storyEventStatus('occurred'), null);
});
test('v2 episodes carry public story data without changing legacy fallback', () => {
  const row = { id: 'story-episode', title: 'Title', excerpt: 'Legacy summary', createdAt: '2026-09-25', coverUrl: 'https://example.com/cover.webp', availableModes: ['duo'], renditions: { duo: { url: 'https://example.com/a.mp3', durationSeconds: 120 } } };
  const result = mapV2Episode({ ...row, story, playbackContext: playback });
  assert.equal(result.story?.format, 'evergreen');
  assert.equal(result.story?.events[0].startTime, 0);
  assert.equal(result.hookLine, 'The hook');
  assert.equal(mapV2Episode(row).story, undefined);
  assert.equal(mapV2Episode(row).fullDescription, 'Legacy summary');
});
