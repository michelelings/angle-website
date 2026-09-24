import { CatalogPage } from '@/components/catalog-page';
import { getCatalog } from '@/lib/server/catalog';
import { categoriesFor, categorySlug, resolveCategory } from '@/lib/episodes';
import { pageMetadata } from '@/lib/metadata';
import { notFound } from 'next/navigation';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ category: string }> };
export async function generateMetadata({ params }: Props) {
  const { category: slug } = await params;
  const category = resolveCategory(slug, categoriesFor(await getCatalog()));
  if (!category) notFound();
  const label = category === 'new' ? 'New' : category === 'popular' ? 'Popular' : category;
  return pageMetadata(`/${categorySlug(category)}`, `${label} Stories | Angle`, `${label} stories worth listening.`, `/api/og-image/category/${categorySlug(category)}`);
}
export default async function Category({ params }: Props) { return <CatalogPage slug={(await params).category} />; }
