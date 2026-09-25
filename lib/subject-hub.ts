import type { Episode } from '../worker/catalog';

export interface SubjectProfile {
  id: string; name: string; kind: string; summary: string;
  sections: { id: string; title: string; text: string }[];
  refreshedAt: string | null;
  wikipedia: { title: string; url: string; revisionAt: string | null; attribution: string; licenseName: string; licenseUrl: string };
  wikidata: { url: string; licenseName: string; licenseUrl: string } | null;
}
export interface SubjectHub {
  id: string; name: string; kind: string; description: string;
  profileStatus: string; profile: SubjectProfile | null; episodes: Episode[];
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const timestamp = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
function httpsUrl(value: unknown): string {
  try { const url = new URL(text(value)); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}

/** Hub node IDs are taxonomy slugs; canonical profiles use `wikidata-Q…`. */
export const subjectIdPattern = /^[A-Za-z0-9_-]{1,128}$/;
export const subjectPath = (id: string) => `/subject/${encodeURIComponent(id)}`;

/** Encyclopedia text is background only. Without its license and attribution it is not shown. */
export function parseSubjectProfile(value: unknown): SubjectProfile | null {
  const profile = record(value), wikipedia = record(profile.wikipedia), wikidata = record(profile.wikidata);
  const id = text(profile.id), name = text(profile.name), summary = text(profile.summary);
  const source = { title: text(wikipedia.title), url: httpsUrl(wikipedia.url), revisionAt: timestamp(wikipedia.revisionAt),
    attribution: text(wikipedia.attribution), licenseName: text(wikipedia.licenseName), licenseUrl: httpsUrl(wikipedia.licenseUrl) };
  if (!id || !name || !summary || !source.url || !source.attribution || !source.licenseName || !source.licenseUrl) return null;
  const identity = { url: httpsUrl(wikidata.url), licenseName: text(wikidata.licenseName), licenseUrl: httpsUrl(wikidata.licenseUrl) };
  return { id, name, kind: text(profile.kind), summary, refreshedAt: timestamp(profile.refreshedAt), wikipedia: source,
    wikidata: identity.url && identity.licenseName && identity.licenseUrl ? identity : null,
    sections: array(profile.sections).flatMap(value => {
      const section = record(value), id = text(section.id), title = text(section.title), body = text(section.text);
      return id && title && body ? [{ id, title, text: body }] : [];
    }).filter((section, index, all) => all.findIndex(other => other.id === section.id) === index) };
}

export function parseSubjectHub(value: unknown, mapEpisode: (value: unknown) => Episode): SubjectHub | null {
  const hub = record(value), id = text(hub.id), name = text(hub.name);
  if (!id || !name) return null;
  const seen = new Set<string>();
  const episodes = array(hub.episodes).flatMap(value => {
    // One unpublishable entry must not take down the whole subject page.
    try { const episode = mapEpisode(value); if (seen.has(episode.id)) return []; seen.add(episode.id); return [episode]; }
    catch { return []; }
  });
  const profileStatus = text(hub.profileStatus) || 'pending';
  return { id, name, kind: text(hub.kind), description: text(hub.description), profileStatus,
    profile: profileStatus === 'available' ? parseSubjectProfile(hub.profile) : null, episodes };
}

export function subjectKindLabel(kind: string): string {
  return ({ person: 'Person', organization: 'Organization', organisation: 'Organization', place: 'Place', location: 'Place',
    country: 'Place', region: 'Place', event: 'Event', topic: 'Topic', concept: 'Topic' } as Record<string, string>)[kind] || 'Subject';
}
