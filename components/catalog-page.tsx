import { getCatalog } from '@/lib/server/catalog';
import { categoriesFor, filterEpisodes, resolveCategory, categorySlug } from '@/lib/episodes';
import { notFound, permanentRedirect } from 'next/navigation';
import { Header } from './header';
import { Filters } from './filters';
import { Gallery } from './gallery';
export async function CatalogPage({ slug }: { slug?: string }) {
  const episodes = await getCatalog();
  const categories = categoriesFor(episodes);
  const filter = slug ? resolveCategory(slug, categories) : 'all';
  if (!filter) notFound();
  if (slug && slug !== categorySlug(filter)) permanentRedirect(`/${categorySlug(filter)}`);
  const filtered = filterEpisodes(episodes, filter);
  return <main><Header count={filtered.length} /><Filters categories={categories} active={filter} /><Gallery episodes={filtered} /></main>;
}
