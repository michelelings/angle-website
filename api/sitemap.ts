import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchEpisodes, fetchCategories } from '../lib/supabase.js';

const BASE_URL = 'https://www.newsangle.co';
const SPECIAL_FILTERS = ['new', 'popular'];

type SitemapEpisode = {
  id: string;
  createdAt: string;
  updatedAt?: string | null;
  category?: string | null;
};

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: Date | string | null | undefined): string {
  const date = value instanceof Date ? value : parseDate(value as string | null | undefined);
  return (date ?? new Date()).toISOString().split('T')[0];
}

function mostRecentDate(...values: Array<string | null | undefined>): Date | null {
  let latest: Date | null = null;

  values.forEach((value) => {
    const date = parseDate(value);
    if (!date) return;
    if (!latest || date.getTime() > latest.getTime()) {
      latest = date;
    }
  });

  return latest;
}

function resolveEpisodeLastmodDate(episode: SitemapEpisode): Date {
  return mostRecentDate(episode.updatedAt, episode.createdAt) ?? new Date();
}

function categoryToPathSegment(category: string): string {
  return category
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isValidEpisodeId(id: string | null | undefined): id is string {
  if (!id) return false;
  const trimmed = id.trim();
  if (!trimmed) return false;
  if (trimmed.includes('/')) return false;
  return true;
}

function generateSitemapXML(
  episodes: SitemapEpisode[],
  categories: string[]
): string {
  const urls: string[] = [];
  const seenUrls = new Set<string>();

  const latestSiteDate = episodes.length
    ? new Date(Math.max(...episodes.map((episode) => resolveEpisodeLastmodDate(episode).getTime())))
    : new Date();

  const episodeLastmodById = new Map<string, string>();
  const latestCategoryDateBySlug = new Map<string, Date>();

  episodes.forEach((episode) => {
    if (!isValidEpisodeId(episode.id)) return;

    const id = episode.id.trim();
    const lastmodDate = resolveEpisodeLastmodDate(episode);
    episodeLastmodById.set(id, formatDate(lastmodDate));

    const categorySlug = categoryToPathSegment(episode.category ?? '');
    if (categorySlug) {
      const current = latestCategoryDateBySlug.get(categorySlug);
      if (!current || lastmodDate.getTime() > current.getTime()) {
        latestCategoryDateBySlug.set(categorySlug, lastmodDate);
      }
    }
  });

  const addUrl = (loc: string, lastmod: string, changefreq: string, priority: string): void => {
    if (seenUrls.has(loc)) return;
    seenUrls.add(loc);

    urls.push(`  <url>
    <loc>${xmlEscape(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`);
  };

  // Home page
  addUrl(`${BASE_URL}/`, formatDate(latestSiteDate), 'daily', '1.0');

  // Category pages (including special filters)
  const normalizedCategorySegments = Array.from(
    new Set(categories.map((category) => categoryToPathSegment(category)).filter(Boolean))
  );

  const allCategorySegments = Array.from(
    new Set([...SPECIAL_FILTERS, ...normalizedCategorySegments])
  );

  allCategorySegments.forEach((categorySegment) => {
    const categoryLastmod = latestCategoryDateBySlug.get(categorySegment) ?? latestSiteDate;
    addUrl(
      `${BASE_URL}/${categorySegment}`,
      formatDate(categoryLastmod),
      'daily',
      '0.9'
    );
  });

  // Transcript (episode) pages
  Array.from(episodeLastmodById.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .forEach(([episodeId, lastmod]) => {
      addUrl(
        `${BASE_URL}/episode/${encodeURIComponent(episodeId)}`,
        lastmod,
        'weekly',
        '0.8'
      );
    });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).setHeader('Content-Type', 'text/xml');
    res.end('<?xml version="1.0" encoding="UTF-8"?><error>Method not allowed</error>');
    return;
  }

  try {
    const [episodes, categories] = await Promise.all([
      fetchEpisodes(),
      fetchCategories().catch(() => [] as string[]),
    ]);

    const sitemapXML = generateSitemapXML(
      episodes.map((episode) => ({
        id: episode.id,
        createdAt: episode.createdAt,
        updatedAt: episode.updatedAt,
        category: episode.category,
      })),
      categories
    );

    // Edge cache + stale-while-revalidate for crawler stability
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.status(200).end(sitemapXML);
  } catch (error) {
    console.error('Error in /api/sitemap:', error);

    const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${xmlEscape(`${BASE_URL}/`)}</loc>
    <lastmod>${formatDate(new Date())}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.status(200).end(fallbackSitemap);
  }
}
