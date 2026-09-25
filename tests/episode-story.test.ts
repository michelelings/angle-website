import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEpisodeStory, parseKeyFacts, parseScript, withoutSignpost, storyEventDate, storyEventStatus, storyMomentAt, storyPlaceZoom } from '../lib/episode-story';
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
test('events carry their location, mapped places and read-more sources', () => {
  const sources = new Map([['s1', { title: 'Report', url: 'https://example.com/a', publisher: 'www.example.com' }],
    ['s2', { title: 'Same report', url: 'https://example.com/a', publisher: null }]]);
  const result = parseEpisodeStory({ ...story,
    events: [{ id: 'one', title: 'At the pool', location: { name: 'Reflecting Pool, Washington', placeId: 'osm-way-1' }, placeIds: ['osm-way-1', 'absent'], sourceIds: ['s1', 's2', 'unknown'] },
      { id: 'two', title: 'Unmapped', location: { name: 'Somewhere else', placeId: 'absent' } }],
    places: [{ id: 'osm-way-1', name: 'Reflecting Pool', precision: 'address', role: 'event_location', latitude: 38.9, longitude: -77 }],
  }, playback, 'duo', 120, sources)!;
  assert.deepEqual(result.events[0].location, { name: 'Reflecting Pool, Washington', placeId: 'osm-way-1' });
  assert.deepEqual(result.events[0].placeIds, ['osm-way-1']);
  assert.deepEqual(result.events[0].sources.map(source => source.url), ['https://example.com/a']);
  assert.deepEqual(result.events[1].location, { name: 'Somewhere else', placeId: null });
  assert.deepEqual(result.places[0].eventIds, ['one']);
  assert.equal(result.places[0].precision, 'address');
});
test('playback moments follow section event and place links, with a turn fallback for older releases', () => {
  const linked = { ...playback, contexts: { duo: [{ id: 'd1', turnIds: ['t1'], eventIds: ['one', 'absent'], placeIds: ['Q1'], keyFacts: [{ id: 'kf1', text: 'Fact', claimIds: ['private'] }] },
    { id: 'd2', turnIds: [], eventIds: [], placeIds: [] }] } };
  const result = parseEpisodeStory({ ...story, events: [{ ...story.events[0], placeIds: ['Q1'] }] }, linked, 'duo', 120)!;
  assert.deepEqual(result.moments, [{ start: 90, end: 100, eventIds: ['one'], placeIds: ['Q1'], keyFactIds: ['kf1'], segment: null }]);
  assert.doesNotMatch(JSON.stringify(result.moments), /private/);
  assert.equal(storyMomentAt(result.moments, 95)?.eventIds[0], 'one');
  assert.equal(storyMomentAt(result.moments, 100), null);
  assert.equal(storyMomentAt(result.moments, null), null);
  const older = parseEpisodeStory({ ...story, events: [{ ...story.events[0], placeIds: ['Q1'] }] }, playback, 'duo', 120)!;
  assert.deepEqual(older.moments.map(moment => [moment.start, moment.eventIds, moment.placeIds]), [[0, ['one'], ['Q1']], [90, ['one'], ['Q1']]]);
});
test('map zoom follows place precision', () => {
  assert.ok(storyPlaceZoom('address') > storyPlaceZoom('city'));
  assert.ok(storyPlaceZoom('city') > storyPlaceZoom('country'));
  assert.equal(storyPlaceZoom('unknown'), 7);
});
test('key facts keep published copy only, and episodes carry them without a story', () => {
  const companion = { tldr: 'Summary', keyFacts: [{ id: 'kf1', text: ' A fact. ', claimIds: ['private'] }, { id: 'kf1', text: 'Duplicate' }, { id: 'kf2', text: '' }, null] };
  assert.deepEqual(parseKeyFacts(companion), [{ id: 'kf1', text: 'A fact.' }]);
  assert.deepEqual(parseKeyFacts(undefined), []);
  const row = { id: 'facts', title: 'Title', createdAt: '2026-09-25', coverUrl: 'https://example.com/cover.webp', availableModes: ['duo'], renditions: { duo: { url: 'https://example.com/a.mp3' } } };
  const episode = mapV2Episode({ ...row, companion });
  assert.equal(episode.story, undefined);
  assert.deepEqual(episode.keyFacts, [{ id: 'kf1', text: 'A fact.' }]);
  assert.doesNotMatch(JSON.stringify(episode.keyFacts), /claimIds|private/);
});
test('the solo script reads as chapters of passages keyed to playback segments, without spoken sign-off', () => {
  const solo = { mode: 'solo', chapters: [
    { id: 'c1', title: 'Opening', segments: [{ id: 's1', turnIds: ['t1', 't2'] }, { id: 's2', turnIds: ['missing'] }],
      turns: [{ id: 't1', speaker: 'narrator', text: ' First.\n\nIt\'s Friday, September 25th, and today\'s angle is the thing. ', claimIds: ['private'] }, { id: 't2', text: 'Second.' }] },
    { id: 'c2', title: 'No segments', turns: [{ id: 't3', text: 'Still readable.' }] },
    { id: 'c3', title: 'Closing', segments: [{ id: 's9', turnIds: ['t4'] }], turns: [{ id: 't4', text: 'Thanks for listening. Until next time.' }] },
    { id: 'c4', title: 'Empty', turns: [] },
  ] };
  assert.deepEqual(parseScript(solo), [
    { id: 'c1', title: 'Opening', segments: [{ key: 'c1/s1', paragraphs: ['First.', 'Second.'] }] },
    { id: 'c2', title: 'No segments', segments: [{ key: 'c2/', paragraphs: ['Still readable.'] }] },
  ]);
  assert.doesNotMatch(JSON.stringify(parseScript(solo)), /narrator|claimIds|private|angle|listening/);
  assert.deepEqual(parseScript(undefined), []);
  const timed = { ...playback, timelines: { duo: [{ contextId: 'unlinked', chapterId: 'c1', segmentId: 's1', start: 30, end: 40 }] } };
  assert.equal(storyMomentAt(parseEpisodeStory(story, timed, 'duo', 120)!.moments, 35)?.segment, 'c1/s1');
});
test('the spoken angle signpost is removed wherever it sits in a paragraph', () => {
  assert.equal(withoutSignpost("It's Thursday, September 24th, and today's angle is the radical who believes in Congress."), '');
  assert.equal(withoutSignpost("Today's angle is Jack Dorsey's denial. We'll walk through four moments."), "We'll walk through four moments.");
  assert.equal(withoutSignpost("Narsarsuaq is small. It's Friday, September 25th, and today's angle is what a base would ask of it."), 'Narsarsuaq is small.');
  assert.equal(withoutSignpost('Before. It’s Tuesday, September 22nd, and today’s angle is the people behind it. After.'), 'Before. After.');
  // Stopping at an abbreviation would leave a fragment, so that sentence stays.
  assert.equal(withoutSignpost("Today's angle is what the U.S. Treasury wants."), "Today's angle is what the U.S. Treasury wants.");
  assert.equal(withoutSignpost('The angle is not a signpost. Neither is today.'), 'The angle is not a signpost. Neither is today.');
});
