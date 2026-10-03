import { getCatalog, getSubjectHub } from '@/lib/server/catalog';
import { curatedSitemap } from '@/lib/server/sitemap';
export const dynamic = 'force-dynamic';
export async function GET() { return curatedSitemap(await getCatalog(), getSubjectHub); }
