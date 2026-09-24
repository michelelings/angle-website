import { filterEpisodes, type Episode } from './episodes';
import { normalizeSearch, searchEpisodes, type createSearchIndex, type SearchDocument } from './search';

export function catalogResults(episodes: Episode[], index: ReturnType<typeof createSearchIndex>, query: string, topic: string, category: string) {
  const documents = new Map(index.map(({ document }) => [document.id, document]));
  const byId = new Map(episodes.map(episode => [episode.id, episode]));
  const ranked = query.trim() ? searchEpisodes(index, query).flatMap(result => {
    const episode = byId.get(result.document.id);
    return episode ? [episode] : [];
  }) : episodes;
  const hasTopic = (document: SearchDocument | undefined) => !topic ||
    document?.topicNames?.some(name => normalizeSearch(name) === normalizeSearch(topic));
  const matching = ranked.filter(episode => hasTopic(documents.get(episode.id)));
  // Apply new/popular to the original catalog, preserving existing membership.
  const allowed = new Set(filterEpisodes(episodes, category).map(episode => episode.id));
  const results = matching.filter(episode => allowed.has(episode.id));
  const topicCounts = new Map<string, { name: string; count: number }>();
  for (const episode of ranked.filter(episode => allowed.has(episode.id))) {
    const seen = new Set<string>();
    for (const name of documents.get(episode.id)?.topicNames || []) {
      const key = normalizeSearch(name);
      if (seen.has(key)) continue;
      seen.add(key);
      const entry = topicCounts.get(key) || { name, count: 0 };
      entry.count++; topicCounts.set(key, entry);
    }
  }
  return { results, matching, topics: [...topicCounts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)) };
}

export function catalogHref(pathname: string, query: string, topic: string) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (topic) params.set('topic', topic);
  return pathname + (params.size ? '?' + params.toString() : '');
}
