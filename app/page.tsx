import { CatalogPage } from '@/components/catalog-page';
import { pageMetadata } from '@/lib/metadata';
export const dynamic = 'force-dynamic';
export const metadata = pageMetadata();
export default function Home() { return <CatalogPage />; }
