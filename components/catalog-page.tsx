import { getCatalog } from '@/lib/server/catalog';
import { categoriesFor, resolveCategory, categorySlug } from '@/lib/episodes';
import { notFound, permanentRedirect } from 'next/navigation';
import { CatalogExplorer } from './catalog-explorer';
export async function CatalogPage({ slug }: { slug?: string }) {
  const episodes = await getCatalog();
  const categories = categoriesFor(episodes);
  const filter = slug ? resolveCategory(slug, categories) : 'all';
  if (!filter) notFound();
  if (slug && slug !== categorySlug(filter)) permanentRedirect(`/${categorySlug(filter)}`);
  return <CatalogExplorer episodes={episodes} categories={categories} active={filter} />;
}
