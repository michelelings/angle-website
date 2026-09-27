import { ORIGIN, SITE_HOSTS } from '@/lib/site';
export const dynamic = 'force-dynamic';
export function GET(request: Request) {
  const production = SITE_HOSTS.includes(new URL(request.url).hostname);
  return new Response(production ? `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
