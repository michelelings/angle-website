import { publicCache } from './public-cache';
import { publishedHook } from '../lib/published-hooks';
import { parseEpisodeStory, parseKeyFacts, parseScript, type EpisodeStory, type KeyFact, type ScriptChapter } from '../lib/episode-story';
import { parseEpisodeTaxonomy, type EpisodeTaxonomy } from '../lib/episode-taxonomy';
import { parseSubjectHub, type SubjectHub } from '../lib/subject-hub';

export interface Episode {
  id: string;
  title: string;
  description: string | null;
  hookLine?: string | null;
  story?: EpisodeStory;
  keyFacts?: KeyFact[];
  /** Narrated solo script, shown as the readable story. */
  script?: ScriptChapter[];
  taxonomy?: EpisodeTaxonomy;
  coverImage: string | null;
  createdAt: string;
  updatedAt: string | null;
  category: string | null;
  duration: number | null;
  audioUrl: string | null;
  /** Public, non-expiring MP4 asset for social link previews. */
  previewVideoUrl?: string | null;
  previewVideoWidth?: number | null;
  previewVideoHeight?: number | null;
  transcript: string | null;
  host: string | null;
  episodeNumber: number | null;
  tags: string[] | null;
  topics?: string[];
  topicNames?: string[];
  fullDescription: string | null;
  listenCount?: number;
  presenterDisclosure?: string | null;
  asOf?: string | null;
  sources?: { title: string; url: string; publisher: string | null }[];
  chapters?: { title: string; turns: { speaker: string | null; text: string }[] }[];
}

// Bindings are generated from wrangler.jsonc. The narrow fetch interfaces also
// allow isolated tests without granting them access to production resources.
export type Env = Omit<WorkerEnv, 'ASSETS' | 'ANGLE_BACKEND'> & {
  ASSETS: Pick<Fetcher, 'fetch'>;
  ANGLE_BACKEND?: Pick<Fetcher, 'fetch'>;
  IMAGES?: Pick<ImagesBinding, 'input'>;
};

export class CatalogError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const categorySlug = (name: string) => name.toLowerCase().replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function mediaUrl(value: unknown): string | null {
  const str = nullableString(value);
  if (!str) return null;
  try { return new URL(str).protocol === 'https:' ? str : null; } catch { return null; }
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function timestamp(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
}

function sourceUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function videoUrl(value: unknown): string | null {
  const url = mediaUrl(value);
  if (!url) return null;
  const parsed = new URL(url);
  return parsed.username || parsed.password ? null : url;
}

function videoDimension(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

// Project the verified v2 API into the website contract. Never forward arbitrary
// backend properties.
export function parseCatalog(payload: unknown): Episode[] {
  const body = payload as { success?: boolean; data?: unknown } | null;
  if (body?.success !== true || !Array.isArray(body.data)) {
    throw new CatalogError(502, 'Invalid catalog response');
  }
  const seen = new Set<string>();
  return body.data.filter((row) => row?.status === undefined || row.status === 'completed')
    .map((row): Episode => {
      if (!row || typeof row.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(row.id)
        || seen.has(row.id) || typeof row.title !== 'string' || !row.title.trim()
        || typeof row.createdAt !== 'string' || !Number.isFinite(Date.parse(row.createdAt))) {
        throw new CatalogError(502, 'Invalid episode record');
      }
      seen.add(row.id);
      return {
        id: row.id, title: row.title, description: nullableString(row.description),
        hookLine: nullableString(row.hookLine),
        coverImage: mediaUrl(row.coverImage), createdAt: row.createdAt,
        updatedAt: timestamp(row.updatedAt), category: nullableString(row.category),
        duration: nullableNumber(row.duration), audioUrl: mediaUrl(row.audioUrl),
        previewVideoUrl: videoUrl(row.previewVideoUrl),
        previewVideoWidth: videoDimension(row.previewVideoWidth),
        previewVideoHeight: videoDimension(row.previewVideoHeight),
        transcript: nullableString(row.transcript), host: nullableString(row.host),
        episodeNumber: nullableNumber(row.episodeNumber),
        tags: Array.isArray(row.tags) ? row.tags.filter((tag: unknown) => typeof tag === 'string') : null,
        topics: Array.isArray(row.topics) ? row.topics.filter((topic: unknown) => typeof topic === 'string') : [],
        topicNames: Array.isArray(row.topicNames) ? row.topicNames.filter((name: unknown) => typeof name === 'string') : [],
        fullDescription: nullableString(row.fullDescription),
        listenCount: nullableNumber(row.listenCount) ?? 0,
      };
    }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value)
  ? value as RecordValue : {};

export function mapV2Episode(value: unknown): Episode {
  const row = object(value);
  const renditions = object(row.renditions);
  const modes = Array.isArray(row.availableModes) ? row.availableModes : [];
  const mode = modes.includes('duo') ? 'duo' : modes.find(m => typeof m === 'string' && m in renditions);
  const rendition = object(typeof mode === 'string' ? renditions[mode] : null);
  const presenters = object(row.presenters);
  const hosts = object(presenters.hosts);
  const hostKeys = mode === 'solo_mara' ? ['mara'] : mode === 'solo_eli' ? ['eli'] : ['mara', 'eli'];
  const host = hostKeys.map(key => nullableString(object(hosts[key]).displayName)).filter(Boolean).join(' & ');
  const transcript = object(object(row.transcripts)[String(mode)]);
  const chapters = Array.isArray(transcript.chapters) ? transcript.chapters : [];
  const transcriptText = chapters.flatMap(chapter => {
    const c = object(chapter);
    const turns = Array.isArray(c.turns) ? c.turns : [];
    return [nullableString(c.title), ...turns.map(turn => nullableString(object(turn).text))].filter(Boolean);
  }).join('\n\n');
  const mapped = parseCatalog({ success: true, data: [{
    id: row.id, title: row.title, description: row.excerpt, fullDescription: row.excerpt,
    hookLine: nullableString(row.hookLine) ?? publishedHook(row.id, row.revisionId),
    coverImage: row.coverUrl, createdAt: row.createdAt, category: row.category,
    previewVideoUrl: row.previewVideoUrl,
    previewVideoWidth: row.previewVideoWidth, previewVideoHeight: row.previewVideoHeight,
    duration: rendition.durationSeconds, audioUrl: rendition.url, host: host || null, transcript: transcriptText || null, updatedAt: row.updatedAt,
    listenCount: row.listenCount,
    topicNames: Array.isArray(object(row.taxonomy).topics)
      ? (object(row.taxonomy).topics as unknown[]).map(topic => nullableString(object(topic).name)).filter(Boolean) : [],
    topics: Array.isArray(object(row.taxonomy).topics)
      ? (object(row.taxonomy).topics as unknown[]).flatMap(topic => {
        const value = object(topic);
        return [nullableString(value.name), nullableString(value.description)].filter(Boolean);
      }) : [],
  }] })[0];
  mapped.asOf = timestamp(row.asOf);
  mapped.taxonomy = parseEpisodeTaxonomy(row.taxonomy);
  mapped.presenterDisclosure = nullableString(presenters.disclosure);
  // Timeline events cite sources by ID; keep every ID resolvable after URL de-duplication.
  const sourcesById = new Map<string, { title: string; url: string; publisher: string | null }>();
  mapped.sources = Array.isArray(row.sources) ? row.sources.flatMap(value => {
    const source = object(value);
    const url = sourceUrl(source.url);
    if (!url) return [];
    const item = { url, title: nullableString(source.title)?.replace(/\s+/g, ' ').trim() || new URL(url).hostname,
      publisher: nullableString(source.publisher) };
    if (nullableString(source.id)) sourcesById.set(source.id as string, item);
    return [item];
  }).filter((source, index, sources) => sources.findIndex(other => other.url === source.url) === index) : [];
  mapped.story = parseEpisodeStory(row.story, row.playbackContext, String(mode), mapped.duration, sourcesById);
  mapped.hookLine = mapped.story?.hookLine || mapped.hookLine;
  mapped.keyFacts = parseKeyFacts(row.companion);
  mapped.script = parseScript(object(row.transcripts).solo);
  mapped.chapters = chapters.map(value => {
    const chapter = object(value);
    return { title: nullableString(chapter.title) || 'Transcript', turns: (Array.isArray(chapter.turns) ? chapter.turns : []).flatMap(value => {
      const turn = object(value);
      const text = nullableString(turn.text);
      const speaker = typeof turn.speaker === 'string' ? nullableString(object(hosts[turn.speaker]).displayName) : null;
      return text ? [{ text, speaker }] : [];
    }) };
  }).filter(chapter => chapter.turns.length);
  if (!mapped.coverImage || !mapped.audioUrl) throw new CatalogError(502, 'Published episode media is missing');
  return mapped;
}

async function backendJson(env: Env, path: string): Promise<unknown> {
  if (!env.ANGLE_API_ORIGIN) throw new CatalogError(503, 'Catalog is not configured');
  const origin = new URL(env.ANGLE_API_ORIGIN);
  if (origin.protocol !== 'https:' || origin.username || origin.password) {
    throw new CatalogError(503, 'Invalid catalog configuration');
  }
  const request = new Request(new URL(path, origin), {
    headers: { Accept: 'application/json' }, redirect: 'manual', signal: AbortSignal.timeout(10_000),
  });
  try {
    // Only public GET endpoints. Never pass browser cookies/auth to the backend.
    const response = env.ANGLE_BACKEND ? await env.ANGLE_BACKEND.fetch(request) : await fetch(request);
    // v2 rejects legacy non-UUID IDs with 400; they cannot identify a current story.
    if (response.status === 404 || (response.status === 400 && path.startsWith('/v2/episodes/'))) {
      throw new CatalogError(404, 'Episode not found');
    }
    if (!response.ok) throw new CatalogError(502, 'Catalog request failed');
    // Cap parsed JSON even if the upstream service regresses or sends a huge body.
    const reader = response.body?.getReader();
    if (!reader) throw new CatalogError(502, 'Empty catalog response');
    const decoder = new TextDecoder(); let text = ''; let bytes = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 4 * 1024 * 1024) { await reader.cancel(); throw new CatalogError(502, 'Catalog response too large'); }
      text += decoder.decode(part.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch (error) {
    if (error instanceof CatalogError) throw error;
    throw new CatalogError(502, 'Catalog is unavailable');
  }
}

export async function readEpisode(env: Env, id: string): Promise<Episode | null> {
  try { return mapV2Episode(await backendJson(env, '/v2/episodes/' + encodeURIComponent(id))); }
  catch (error) { if (error instanceof CatalogError && error.status === 404) return null; throw error; }
}

export async function readSubjectHub(env: Env, id: string): Promise<SubjectHub | null> {
  try { return parseSubjectHub(await backendJson(env, '/v2/hubs/' + encodeURIComponent(id)), mapV2Episode); }
  catch (error) { if (error instanceof CatalogError && error.status === 404) return null; throw error; }
}

export async function readCatalog(env: Env): Promise<Episode[]> {
  const response = await publicCache(env, 'catalog', 60, async () => Response.json(await loadCatalog(env)));
  return response.json();
}

async function loadCatalog(env: Env): Promise<Episode[]> {
  const episodes: Episode[] = []; const ids = new Set<string>(); let offset = 0;
  for (let page = 0; page < 100; page++) {
    const body = object(await backendJson(env, `/v2/episodes?limit=100&offset=${offset}`));
    if (body.catalogEpoch !== 'angle-pipeline-v2' || !Array.isArray(body.episodes)) {
      throw new CatalogError(502, 'Invalid catalog response');
    }
    for (const value of body.episodes) {
      const episode = mapV2Episode(value);
      // Publication while offset paging can shift page boundaries.
      if (!ids.has(episode.id)) { episodes.push(episode); ids.add(episode.id); }
    }
    if (body.nextOffset === null) return episodes;
    if (!Number.isSafeInteger(body.nextOffset) || Number(body.nextOffset) <= offset) {
      throw new CatalogError(502, 'Invalid catalog pagination');
    }
    offset = Number(body.nextOffset);
  }
  throw new CatalogError(502, 'Catalog exceeds supported size');
}

export function categoriesFor(episodes: Episode[]): string[] {
  return [...new Set(episodes.map(e => e.category).filter((c): c is string => !!c))].sort();
}

export function resolveCategory(slug: string, categories: string[]): string | undefined {
  if (slug === 'new' || slug === 'popular') return slug;
  return categories.find(c => categorySlug(c) === slug.toLowerCase() || c.toLowerCase() === slug.toLowerCase());
}
