import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSubjectHub, parseSubjectProfile } from '../lib/subject-hub';
import { mapV2Episode } from '../worker/catalog';

const episode = { id: 'episode', title: 'Title', createdAt: '2026-09-25', coverUrl: 'https://example.com/cover.webp', availableModes: ['duo'],
  renditions: { duo: { url: 'https://example.com/audio.mp3', durationSeconds: 120 } } };
const profile = {
  id: 'wikidata-Q1', name: 'Person', kind: 'person', wikidataId: 'Q1', summary: 'Lead.\n\nSecond paragraph.', backgroundOnly: true,
  sections: [{ id: 'section-1', title: 'Early life', text: 'Born.', excerpt: true }, { id: 'section-2', title: '', text: 'Untitled' }],
  refreshedAt: '2026-09-25T00:00:00Z',
  wikipedia: { title: 'Person', url: 'https://en.wikipedia.org/w/index.php?oldid=1', revisionAt: '2026-09-24T00:00:00Z',
    attribution: 'Wikipedia contributors.', licenseName: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  wikidata: { url: 'https://www.wikidata.org/wiki/Q1', licenseName: 'CC0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/' },
};
test('hubs keep publishable episodes and an attributed profile', () => {
  const hub = parseSubjectHub({ id: 'person', name: 'Person', kind: 'person', description: 'Who they are.', profileStatus: 'available', profile,
    episodes: [episode, episode, { ...episode, id: 'no-media', coverUrl: null }] }, mapV2Episode)!;
  assert.deepEqual(hub.episodes.map(item => item.id), ['episode']);
  assert.equal(hub.profile?.id, 'wikidata-Q1');
  assert.deepEqual(hub.profile?.sections.map(section => section.title), ['Early life']);
});
test('profiles without license attribution, or on ambiguous hubs, are not shown', () => {
  assert.equal(parseSubjectProfile({ ...profile, wikipedia: { ...profile.wikipedia, licenseUrl: '' } }), null);
  assert.equal(parseSubjectProfile({ ...profile, wikipedia: { ...profile.wikipedia, url: 'javascript:alert(1)' } }), null);
  assert.equal(parseSubjectHub({ id: 'person', name: 'Person', profileStatus: 'ambiguous', profile, episodes: [] }, mapV2Episode)?.profile, null);
  assert.equal(parseSubjectHub({ name: 'No ID' }, mapV2Episode), null);
});
