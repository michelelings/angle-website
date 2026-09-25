import { type Episode } from '../episodes';
import { ORIGIN } from '../site';
const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
export function sitemapResponse(episodes: Episode[]): Response {
  const paths = ['/', '/about', ...episodes.map(e => '/episode/' + encodeURIComponent(e.id))];
  const dates = new Map(episodes.map(e => ['/episode/' + encodeURIComponent(e.id),
    new Date(Math.max(Date.parse(e.createdAt), Date.parse(e.updatedAt || e.createdAt))).toISOString().split('T')[0]]));
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...new Set(paths)].map(path => `<url><loc>${escape(ORIGIN + path)}</loc>${dates.has(path) ? `<lastmod>${dates.get(path)}</lastmod>` : ''}</url>`).join('')}</urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' } });
}
