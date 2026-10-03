import assert from 'node:assert/strict';
import test from 'node:test';
import { mapV2Episode } from '../worker/catalog';
import { episodeHeadline, headlinePilot } from '../lib/episode-headlines';
import { episodeMetadata, subjectMetadata } from '../lib/metadata';
import { publicationIssues } from '../lib/publication-readiness';
import { parseScript } from '../lib/episode-story';
import { eligibleSubject, subjectEditorial } from '../lib/subject-editorial';
import { curatedSitemap } from '../lib/server/sitemap';
import type { SubjectHub } from '../lib/subject-hub';
import { searchDocument } from '../lib/search';

const row = { id: 'test', title: 'Creative title', excerpt: 'Summary', createdAt: '2026-09-20', category: 'Technology',
  coverUrl: 'https://example.com/cover.webp', availableModes: ['duo'],
  renditions: { duo: { url: 'https://example.com/audio.mp3' } } };

test('editorial title is optional, revision scoped, and never replaces the creative title', () => {
  const [id, pilot] = Object.entries(headlinePilot)[0];
  const episode = mapV2Episode({ ...row, id, revisionId: pilot.revisionId });
  assert.equal(episodeHeadline(episode), pilot.title);
  assert.equal(episode.title, row.title);
  assert.equal(episodeHeadline(mapV2Episode({ ...row, id: 'constructor' })), row.title);
  assert.equal(episodeMetadata(episode).title, `${pilot.title} | Angle`);
  assert.equal(episodeHeadline({ ...episode, revisionId: 'changed' }), row.title);
  assert.equal(episodeHeadline({ ...episode, searchTitle: '   ' }), pilot.title);
  assert.equal(episodeHeadline(mapV2Episode({ ...row, searchTitle: '  Supplied headline  ' })), 'Supplied headline');
  assert.ok(searchDocument(episode).topics.includes(pilot.title));
});

test('publication checks accept dialogue-only episodes and reject incomplete detail payloads', () => {
  const episode = mapV2Episode({ ...row, transcripts: { duo: { chapters: [
    { title: 'Context', turns: [{ speaker: 'mara', text: 'A complete passage.' }] },
  ] } } });
  assert.equal(episode.script?.length, 0);
  assert.equal(episode.chapters?.[0].turns[0].text, 'A complete passage.');
  assert.deepEqual(publicationIssues(episode), []);
  assert.deepEqual(publicationIssues(mapV2Episode(row)), ['Missing readable script or transcript']);
  assert.ok(publicationIssues({ ...episode, description: ' ', fullDescription: null }).includes('Missing summary'));
});

test('readable scripts retain substantive endings, including single-paragraph episodes', () => {
  const script = parseScript({ chapters: [{ id: 'c1', turns: [{ id: 't1', text: 'The final substantive conclusion.' }] }] });
  assert.equal(script[0].segments[0].paragraphs[0], 'The final substantive conclusion.');
});

test('sitemap and metadata agree on curated, populated, unambiguous subject eligibility', async () => {
  const editorial = subjectEditorial[0];
  const episodes = editorial.questions.map(item => mapV2Episode({ ...row, id: item.episodeId }));
  const hub: SubjectHub = { id: editorial.id, name: 'Bitcoin', kind: 'topic', description: '', profile: null,
    profileStatus: 'pending', episodes };
  assert.equal(eligibleSubject(hub), true);
  assert.deepEqual(subjectMetadata(hub).robots, { index: true, follow: true });
  for (const excluded of [{ ...hub, profileStatus: 'ambiguous' }, { ...hub, episodes: episodes.slice(1) }, { ...hub, id: 'uncurated' }]) {
    assert.equal(eligibleSubject(excluded), false);
    assert.deepEqual(subjectMetadata(excluded).robots, { index: false, follow: true });
  }
  const requests: string[] = [];
  const xml = await (await curatedSitemap(episodes, async id => { requests.push(id); return hub; })).text();
  assert.deepEqual(requests, [editorial.id]);
  assert.match(xml, new RegExp(`/subject/${editorial.id}</loc><lastmod>2026-10-03`));
  assert.equal((xml.match(/\/technology<\/loc>/g) || []).length, 1);
  const empty = await (await curatedSitemap(episodes, async () => ({ ...hub, episodes: [] }))).text();
  assert.doesNotMatch(empty, /\/subject\//);
});
