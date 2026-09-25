import { CatalogPage } from '@/components/catalog-page';
import { pageMetadata, searchMetadata, type SearchParams } from '@/lib/metadata';
export const dynamic = 'force-dynamic';
export async function generateMetadata({ searchParams }: { searchParams: SearchParams }) {
  return searchMetadata(pageMetadata(), await searchParams);
}
export default function Home() { return <CatalogPage />; }
