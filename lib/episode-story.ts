export interface StorySource { title: string; url: string; publisher: string | null }
export interface StoryEvent {
  id: string; title: string; summary: string; date: string; datePrecision: string;
  status: string; startTime: number | null;
  /** Where it happened, in the source's words; placeId is set only when that place is on the map. */
  location: { name: string; placeId: string | null } | null;
  placeIds: string[];
  /** Episode sources to read more about this event. */
  sources: StorySource[];
}
export interface StoryPlace {
  id: string; name: string; description: string; role: string; precision: string; latitude: number; longitude: number;
  /** Events that happened at this place, in timeline order. */
  eventIds: string[];
}
/** A measured stretch of the selected rendition and the events, places and key facts it covers. */
export interface StoryMoment {
  start: number; end: number; eventIds: string[]; placeIds: string[]; keyFactIds: string[];
  /** `chapterId/segmentId`; shared by the duo and solo scripts, so it locates the passage in either. */
  segment: string | null;
}
export interface KeyFact { id: string; text: string }
/** The narrated (solo) script as readable prose, split into the segments playback reports. */
export interface ScriptChapter { id: string; title: string; segments: { key: string; paragraphs: string[] }[] }
export interface EpisodeStory {
  format: 'news' | 'evergreen'; hookLine: string; summary: string; whyItMatters: string;
  events: StoryEvent[]; places: StoryPlace[]; moments: StoryMoment[];
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const strings = (value: unknown) => [...new Set(array(value).map(text).filter(Boolean))];
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Project public copy only; resolve event links using the selected rendition's measured sections. */
export function parseEpisodeStory(value: unknown, playback: unknown, mode: string, duration: number | null,
  sources: ReadonlyMap<string, StorySource> = new Map()): EpisodeStory | undefined {
  const story = record(value);
  if (story.version !== 1 || !['news', 'evergreen'].includes(String(story.format))) return;
  const context = record(playback);
  const sections = context.version === 1 ? array(record(context.contexts)[mode.startsWith('solo_') ? 'solo' : mode]).map(record) : [];
  const intervals = (context.version === 1 ? array(record(context.timelines)[mode]) : []).map(record).filter(interval =>
    finite(interval.start) && interval.start >= 0 && finite(interval.end) && interval.end > interval.start
    && (duration === null || interval.start < duration)) as (Record<string, unknown> & { start: number; end: number })[];
  const places = array(story.places).flatMap(value => {
    const place = record(value), id = text(place.id), name = text(place.name) || text(place.label);
    if (!id || !name || !finite(place.latitude) || !finite(place.longitude)
      || Math.abs(place.latitude) > 90 || Math.abs(place.longitude) > 180) return [];
    return [{ id, name, description: text(place.description), role: text(place.role), precision: text(place.precision),
      latitude: place.latitude, longitude: place.longitude, eventIds: [] as string[] }];
  }).filter((place, index, all) => all.findIndex(other => other.id === place.id) === index);
  const placeIds = new Set(places.map(place => place.id));
  const turns = new Map<string, Set<string>>();
  const events = array(story.events).flatMap(value => {
    const event = record(value), id = text(event.id), title = text(event.title);
    if (!id || !title) return [];
    const turnIds = new Set(strings(event.turnIds));
    turns.set(id, turnIds);
    const matching = new Set(sections.filter(section => strings(section.turnIds).some(turn => turnIds.has(turn))).map(section => section.id));
    const starts = intervals.filter(interval => matching.has(interval.contextId)).map(interval => interval.start);
    const where = record(event.location), locationName = typeof event.location === 'string' ? text(event.location) : text(where.name);
    const locationPlace = placeIds.has(text(where.placeId)) ? text(where.placeId) : null;
    return [{ id, title, summary: text(event.summary), date: text(event.date), datePrecision: text(event.datePrecision),
      status: text(event.status), startTime: starts.length ? Math.min(...starts) : null,
      location: locationName ? { name: locationName, placeId: locationPlace } : null,
      placeIds: [...new Set([...(locationPlace ? [locationPlace] : []), ...strings(event.placeIds).filter(place => placeIds.has(place))])],
      sources: strings(event.sourceIds).flatMap(source => sources.get(source) ?? [])
        .filter((source, index, all) => all.findIndex(other => other.url === source.url) === index) }];
  }).filter((event, index, all) => all.findIndex(other => other.id === event.id) === index);
  for (const place of places) place.eventIds = events.filter(event => event.placeIds.includes(place.id)).map(event => event.id);
  const eventIds = new Set(events.map(event => event.id));
  const bySection = new Map(sections.map(section => {
    // Older releases predate section event links; fall back to the events' own turn references.
    const linked = Array.isArray(section.eventIds) ? strings(section.eventIds).filter(event => eventIds.has(event))
      : events.filter(event => strings(section.turnIds).some(turn => turns.get(event.id)?.has(turn))).map(event => event.id);
    const where = Array.isArray(section.placeIds) ? strings(section.placeIds).filter(place => placeIds.has(place))
      : [...new Set(events.filter(event => linked.includes(event.id)).flatMap(event => event.placeIds))];
    const keyFactIds = [...new Set(array(section.keyFacts).map(fact => text(record(fact).id)).filter(Boolean))];
    return [section.id, { eventIds: linked, placeIds: where, keyFactIds }] as const;
  }));
  const moments = intervals.flatMap(interval => {
    const links = bySection.get(interval.contextId) ?? { eventIds: [], placeIds: [], keyFactIds: [] };
    const chapter = text(interval.chapterId), part = text(interval.segmentId), segment = chapter && part ? `${chapter}/${part}` : null;
    return segment || links.eventIds.length || links.placeIds.length || links.keyFactIds.length ? [{ start: interval.start, end: interval.end, ...links, segment }] : [];
  }).sort((a, b) => a.start - b.start);
  return { format: story.format as EpisodeStory['format'], hookLine: text(story.hookLine), summary: text(story.summary),
    whyItMatters: text(story.whyItMatters), events, places, moments };
}

/** The episode's key facts, as published copy only. */
export function parseKeyFacts(companion: unknown): KeyFact[] {
  return array(record(companion).keyFacts).flatMap(value => {
    const fact = record(value), id = text(fact.id), body = text(fact.text);
    return id && body ? [{ id, text: body }] : [];
  }).filter((fact, index, all) => all.findIndex(other => other.id === fact.id) === index);
}

const weekday = '(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day';
const month = '(?:January|February|March|April|May|June|July|August|September|October|November|December)';
/** The spoken signpost: "It's Friday, September 25th, and today's angle is …." or "Today's angle is …." */
const SIGNPOST = new RegExp(`(?:\\bIt['’]s ${weekday}, ${month} \\d{1,2}(?:st|nd|rd|th)?, and t|\\bT)oday['’]s angle is [^.!?]*[.!?]["”’]?\\s*`, 'g');
/** Remove the signpost sentence, unless it seems to stop at an abbreviation like "U.S.", which would leave a fragment. */
export function withoutSignpost(paragraph: string): string {
  return paragraph.replace(SIGNPOST, sentence => /\b[A-Z]\.["”’]?\s*$/.test(sentence) ? sentence : '').trim();
}

/**
 * The narrated script as written prose. The signpost and closing sign-off are written for
 * listening, so they are left out here; the published transcript itself is unchanged.
 * Speakers, claim and meaning references stay out of the page.
 */
export function parseScript(transcript: unknown): ScriptChapter[] {
  const chapters = array(record(transcript).chapters).flatMap(value => {
    const chapter = record(value), id = text(chapter.id), title = text(chapter.title);
    const turns = new Map(array(chapter.turns).map(record).map(turn => [text(turn.id), text(turn.text).split(/\n{2,}/).map(withoutSignpost).filter(Boolean)] as const)
      .filter(([, paragraphs]) => paragraphs.length));
    const listed = array(chapter.segments).map(record).flatMap(segment => {
      const key = text(segment.id), paragraphs = strings(segment.turnIds).flatMap(turn => turns.get(turn) ?? []);
      return key && paragraphs.length ? [{ key: `${id}/${key}`, paragraphs }] : [];
    });
    // Without segment lists, keep the chapter readable even though it cannot follow playback.
    const segments = listed.length ? listed : turns.size ? [{ key: `${id}/`, paragraphs: [...turns.values()].flat() }] : [];
    return id && segments.length ? [{ id, title, segments }] : [];
  }).filter((chapter, index, all) => all.findIndex(other => other.id === chapter.id) === index);
  // The final paragraph is the spoken sign-off ("Thanks for listening…").
  const lastChapter = chapters.at(-1), lastSegment = lastChapter?.segments.at(-1);
  lastSegment?.paragraphs.pop();
  if (lastChapter && lastSegment && !lastSegment.paragraphs.length) lastChapter.segments.pop();
  if (lastChapter && !lastChapter.segments.length) chapters.pop();
  return chapters;
}

/** The measured moment playing at this position, if any. */
export function storyMomentAt(moments: StoryMoment[], seconds: number | null): StoryMoment | null {
  if (seconds === null) return null;
  return moments.find(moment => seconds >= moment.start && seconds < moment.end) ?? null;
}

export function storyEventDate(event: Pick<StoryEvent, 'date' | 'datePrecision'>): string {
  const { date, datePrecision } = event;
  if (!date) return 'Date not specified';
  if (datePrecision === 'year' && /^\d{4}$/.test(date)) return date;
  const month = datePrecision === 'month' && /^\d{4}-\d{2}$/.test(date);
  const day = datePrecision === 'day' && /^\d{4}-\d{2}-\d{2}$/.test(date);
  if (!month && !day) return date;
  const parsed = new Date(`${date}${month ? '-01' : ''}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-US', { month: month ? 'long' : 'short', ...(day ? { day: 'numeric' as const } : {}), year: 'numeric', timeZone: 'UTC' });
}
export function storyEventStatus(status: string): string | null {
  if (!status || status === 'occurred') return null;
  if (status === 'planned' || status === 'expected') return 'Expected';
  return status.charAt(0).toUpperCase() + status.slice(1).replaceAll('_', ' ');
}
export function storyPlaceRole(role: string): string {
  return ({ primary_setting: 'Main setting', secondary_setting: 'Setting', setting: 'Setting', origin: 'Where it began', destination: 'Destination', mentioned: 'Mentioned', event_location: 'Where it happened' } as Record<string, string>)[role]
    || (role ? role.charAt(0).toUpperCase() + role.slice(1).replaceAll('_', ' ') : 'Mentioned');
}
/** Closest sensible zoom for a single place, from its supplied precision. */
export function storyPlaceZoom(precision: string): number {
  return ({ address: 17, site: 15, area: 12, city: 11, region: 5, country: 4 } as Record<string, number>)[precision] ?? 7;
}
export function sourceLabel(source: StorySource): string {
  const label = source.publisher || new URL(source.url).hostname;
  return label.replace(/^www\./, '');
}
