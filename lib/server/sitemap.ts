import { type Episode } from '../episodes';
import { categoriesFor, categorySlug } from '../episodes';
import { type SubjectHub, subjectPath } from '../subject-hub';
import { eligibleSubject, editorialForSubject, featuredSubjects } from '../subject-editorial';
import { ORIGIN } from '../site';
const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
export function sitemapResponse(episodes: Episode[], subjects: SubjectHub[] = []): Response {
  const eligible = subjects.filter(eligibleSubject);
  const categories = categoriesFor(episodes).filter(category => !['all', 'new', 'popular'].includes(category));
  const paths = ['/', '/about', ...categories.map(category => '/' + categorySlug(category)),
    ...eligible.map(hub => subjectPath(hub.profile?.id ?? hub.id)), ...episodes.map(e => '/episode/' + encodeURIComponent(e.id))];
  const dates = new Map(episodes.map(e => ['/episode/' + encodeURIComponent(e.id),
    new Date(Math.max(Date.parse(e.createdAt), Date.parse(e.updatedAt || e.createdAt))).toISOString().split('T')[0]]));
  for (const hub of eligible) {
    const modified = Math.max(Date.parse(editorialForSubject(hub)!.updatedAt),
      ...hub.episodes.map(e => Math.max(Date.parse(e.createdAt), Date.parse(e.updatedAt || e.createdAt))));
    dates.set(subjectPath(hub.profile?.id ?? hub.id), new Date(modified).toISOString().split('T')[0]);
  }
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...new Set(paths)].map(path => `<url><loc>${escape(ORIGIN + path)}</loc>${dates.has(path) ? `<lastmod>${dates.get(path)}</lastmod>` : ''}</url>`).join('')}</urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function curatedSitemap(episodes: Episode[], readSubject: (id: string) => Promise<SubjectHub | null>): Promise<Response> {
  // At most the curated guides, never the complete taxonomy graph.
  const hubs = await Promise.all(featuredSubjects(episodes).map(item => readSubject(item.id)));
  return sitemapResponse(episodes, hubs.filter((hub): hub is SubjectHub => hub !== null));
}
