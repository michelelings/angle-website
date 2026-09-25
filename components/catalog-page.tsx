import { getCatalog } from '@/lib/server/catalog';
import { categoriesFor, resolveCategory, categorySlug } from '@/lib/episodes';
import { notFound, permanentRedirect } from 'next/navigation';
import { readSearchDocuments } from '@/lib/server/search';
import { catalogEnv } from '@/lib/server/catalog';
import { CatalogExplorer } from './catalog-explorer';
export async function CatalogPage({ slug, query = '' }: { slug?: string; query?: string }) {
  const episodes = await getCatalog();
  const categories = categoriesFor(episodes);
  const filter = slug ? resolveCategory(slug, categories) : 'all';
  if (!filter) notFound();
  if (slug && slug !== categorySlug(filter)) permanentRedirect(`/${categorySlug(filter)}`);
  query = query.trim().slice(0, 200);
  let searchFailed = false;
  const documents = query ? await readSearchDocuments(await catalogEnv()).catch(() => { searchFailed = true; return []; }) : undefined;
  return <CatalogExplorer episodes={episodes} categories={categories} active={filter} initialDocuments={documents} initialSearchFailed={searchFailed} />;
}
