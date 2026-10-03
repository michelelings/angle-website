import { catalogCopy } from '@/lib/catalog-copy';
import { CatalogPage } from '@/components/catalog-page';
import { getCatalog } from '@/lib/server/catalog';
import { categoriesFor, categorySlug, resolveCategory } from '@/lib/episodes';
import { pageMetadata, searchMetadata, type SearchParams } from '@/lib/metadata';
import { notFound } from 'next/navigation';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ category: string }>; searchParams: SearchParams };
export async function generateMetadata({ params, searchParams }: Props) {
  const { category: slug } = await params;
  const category = resolveCategory(slug, categoriesFor(await getCatalog()));
  if (!category) notFound();
  const copy = catalogCopy(category);
  const meta = pageMetadata(`/${categorySlug(category)}`, `${copy.heading} | Angle`, copy.description, `/api/og-image/category/${categorySlug(category)}`);
  if (category === 'new' || category === 'popular') meta.robots = { index: false, follow: true };
  return searchMetadata(meta, await searchParams);
}
export default async function Category({ params, searchParams }: Props) {
  const search = await searchParams;
  return <CatalogPage slug={(await params).category} query={typeof search.q === 'string' ? search.q : ''} />;
}
