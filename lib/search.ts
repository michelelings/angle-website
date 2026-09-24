import type { Episode } from './episodes';

export type SearchDocument = Pick<Episode, 'id' | 'title' | 'category' | 'coverImage' | 'createdAt'> & {
  topics: string[];
  topicNames?: string[];
  transcript: string;
};
export function searchDocument(episode: Episode): SearchDocument {
  return { id: episode.id, title: episode.title, category: episode.category,
    coverImage: episode.coverImage, createdAt: episode.createdAt,
    topics: episode.topics || [], topicNames: episode.topicNames || [], transcript: episode.transcript || '' };
}
export const normalizeSearch = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
// Adjacent swapped letters count as one typo, alongside insertions, deletions,
// and substitutions. Stop once the bounded distance cannot recover.
function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let beforePrevious = previous;
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let minimum = i;
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        current[j] = Math.min(current[j], beforePrevious[j - 2] + 1);
      }
      minimum = Math.min(minimum, current[j]);
    }
    if (minimum > limit) return limit + 1;
    beforePrevious = previous;
    previous = current;
  }
  return previous[b.length];
}

function fuzzyDistance(term: string, word: string): number {
  // Short queries stay literal to avoid noisy results; cap work on pasted text.
  if (term.length < 4 || term.length > 64) return 3;
  const limit = term.length >= 8 ? 2 : 1;
  let distance = editDistance(term, word, limit);
  // Preserve search-as-you-type: “irna” should also find “Iranian”.
  if (word.length > term.length) {
    distance = Math.min(distance, editDistance(term, word.slice(0, term.length), limit),
      editDistance(term, word.slice(0, term.length + limit), limit));
  }
  return distance <= limit ? distance : 3;
}

export function createSearchIndex(documents: SearchDocument[]) {
  return documents.map(document => {
    const fields = [document.title, document.topics.join(' · '),
      document.category || '', document.transcript].map(normalizeSearch);
    const words = fields.map(field => [...new Set(field.match(/[\p{L}\p{N}]+/gu) || [])]);
    return { document, fields, words };
  });
}
export function searchEpisodes(index: ReturnType<typeof createSearchIndex>, query: string) {
  const normalizedQuery = normalizeSearch(query).trim();
  const terms = [...new Set(normalizedQuery.split(/\s+/).filter(Boolean))];
  if (!terms.length) return [];
  // Repeated transcript vocabulary is compared only once per query term.
  const distances = terms.map(() => new Map<string, number>());
  return index.flatMap(({ document, fields, words }) => {
    let score = 0;
    let fuzzyTerms = 0;
    let totalDistance = 0;
    const matches: { field: number; text: string }[] = [];
    for (const [termIndex, term] of terms.entries()) {
      let field = fields.findIndex(text => text.includes(term));
      let matchedText = term;
      if (field < 0) {
        let bestDistance = 3;
        for (const [fieldIndex, vocabulary] of words.entries()) {
          for (const word of vocabulary) {
            const cache = distances[termIndex];
            let distance = cache.get(word);
            if (distance === undefined) {
              distance = fuzzyDistance(term, word);
              cache.set(word, distance);
            }
            if (distance < bestDistance) {
              bestDistance = distance; field = fieldIndex; matchedText = word;
            }
          }
          if (bestDistance === 1) break;
        }
        if (field < 0) return [];
        fuzzyTerms++;
        totalDistance += bestDistance;
      }
      score += [100, 40, 20, 5][field];
      matches.push({ field, text: matchedText });
    }
    if (fields[0] === normalizedQuery) score += 200;
    const match = matches.reduce((best, item) => item.field < best.field ? item : best);
    const original = [document.title, document.topics.join(' · '), document.category || '', document.transcript][match.field];
    const position = Math.max(0, fields[match.field].indexOf(match.text));
    const start = Math.max(0, position - 65);
    const excerpt = `${start ? '…' : ''}${original.slice(start, start + 180).replace(/\s+/g, ' ')}${original.length > start + 180 ? '…' : ''}`;
    return [{ document, score, fuzzyTerms, totalDistance, excerpt,
      matchedField: ['Title', 'Topic', 'Category', 'Transcript'][match.field] }];
  }).sort((a, b) => a.fuzzyTerms - b.fuzzyTerms || a.totalDistance - b.totalDistance
    || b.score - a.score || Date.parse(b.document.createdAt) - Date.parse(a.document.createdAt));
}
