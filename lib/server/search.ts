import { readCatalog, readEpisode, type Env } from '../../worker/catalog';
import { searchDocument, type SearchDocument } from '../search';

export async function readSearchDocuments(env: Env): Promise<SearchDocument[]> {
  const catalog = await readCatalog(env);
  const documents: SearchDocument[] = [];
  // Detail endpoints contain the full transcript and taxonomy; list responses do not.
  // Bound upstream concurrency as the catalog grows.
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(6, catalog.length) }, async () => {
    while (cursor < catalog.length) {
      const episode = catalog[cursor++];
      const detail = await readEpisode(env, episode.id);
      if (detail) documents.push(searchDocument(detail));
    }
  }));
  return documents;
}
