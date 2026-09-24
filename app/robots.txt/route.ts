import { ORIGIN } from '@/lib/site';
export const dynamic = 'force-dynamic';
export function GET(request: Request) {
  const production = new URL(request.url).hostname === new URL(ORIGIN).hostname;
  return new Response(production ? `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
