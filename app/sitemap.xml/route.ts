import { getCatalog } from '@/lib/server/catalog';
import { sitemapResponse } from '@/lib/server/sitemap';
export const dynamic = 'force-dynamic';
export async function GET() { return sitemapResponse(await getCatalog()); }
