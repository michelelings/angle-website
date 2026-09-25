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
  const label = category === 'new' ? 'New' : category === 'popular' ? 'Popular' : category;
  return searchMetadata(pageMetadata(`/${categorySlug(category)}`, `${label} Stories | Angle`, `${label} stories worth listening.`, `/api/og-image/category/${categorySlug(category)}`), await searchParams);
}
export default async function Category({ params }: Props) { return <CatalogPage slug={(await params).category} />; }
