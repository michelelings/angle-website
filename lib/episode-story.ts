export interface StoryEvent {
  id: string; title: string; summary: string; date: string; datePrecision: string;
  status: string; startTime: number | null;
}
export interface StoryPlace {
  id: string; name: string; description: string; role: string; latitude: number; longitude: number;
}
export interface EpisodeStory {
  format: 'news' | 'evergreen'; hookLine: string; summary: string; whyItMatters: string;
  events: StoryEvent[]; places: StoryPlace[];
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Project public copy only; resolve event links using the selected rendition's measured sections. */
export function parseEpisodeStory(value: unknown, playback: unknown, mode: string, duration: number | null): EpisodeStory | undefined {
  const story = record(value);
  if (story.version !== 1 || !['news', 'evergreen'].includes(String(story.format))) return;
  const context = record(playback);
  const sections = context.version === 1 ? array(record(context.contexts)[mode.startsWith('solo_') ? 'solo' : mode]) : [];
  const intervals = context.version === 1 ? array(record(context.timelines)[mode]) : [];
  const events = array(story.events).flatMap(value => {
    const event = record(value), id = text(event.id), title = text(event.title);
    if (!id || !title) return [];
    const turnIds = new Set(array(event.turnIds).filter(turn => typeof turn === 'string'));
    const matching = new Set(sections.map(record).filter(section => array(section.turnIds).some(turn => typeof turn === 'string' && turnIds.has(turn))).map(section => section.id));
    const starts = intervals.map(record).filter(interval => matching.has(interval.contextId)
      && finite(interval.start) && interval.start >= 0 && finite(interval.end) && interval.end > interval.start
      && (duration === null || interval.start < duration)).map(interval => interval.start as number);
    return [{ id, title, summary: text(event.summary), date: text(event.date), datePrecision: text(event.datePrecision),
      status: text(event.status), startTime: starts.length ? Math.min(...starts) : null }];
  }).filter((event, index, all) => all.findIndex(other => other.id === event.id) === index);
  const places = array(story.places).flatMap(value => {
    const place = record(value), id = text(place.id), name = text(place.name) || text(place.label);
    if (!id || !name || !finite(place.latitude) || !finite(place.longitude)
      || Math.abs(place.latitude) > 90 || Math.abs(place.longitude) > 180) return [];
    return [{ id, name, description: text(place.description), role: text(place.role), latitude: place.latitude, longitude: place.longitude }];
  }).filter((place, index, all) => all.findIndex(other => other.id === place.id) === index);
  return { format: story.format as EpisodeStory['format'], hookLine: text(story.hookLine), summary: text(story.summary),
    whyItMatters: text(story.whyItMatters), events, places };
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
  return ({ primary_setting: 'Main setting', secondary_setting: 'Setting', setting: 'Setting', origin: 'Where it began', destination: 'Destination', mentioned: 'Mentioned' } as Record<string, string>)[role]
    || (role ? role.charAt(0).toUpperCase() + role.slice(1).replaceAll('_', ' ') : 'Mentioned');
}
