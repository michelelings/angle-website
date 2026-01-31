import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchEpisodes } from '../lib/supabase.js';

const BASE_URL = 'https://angle.app';

function formatDate(dateString: string): string {
  // Convert ISO date string to YYYY-MM-DD format
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
}

function generateSitemapXML(episodes: Array<{ id: string; createdAt: string }>): string {
  const urls: string[] = [];

  // Home page
  urls.push(`  <url>
    <loc>${BASE_URL}/</loc>
    <lastmod>${formatDate(new Date().toISOString())}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>`);

  // Episode pages
  episodes.forEach((episode) => {
    urls.push(`  <url>
    <loc>${BASE_URL}/episode/${episode.id}</loc>
    <lastmod>${formatDate(episode.createdAt)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`);
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
    const episodes = await fetchEpisodes();
    
    // Generate sitemap XML
    const sitemapXML = generateSitemapXML(episodes);

    // Set cache headers (1 hour)
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.status(200).end(sitemapXML);
  } catch (error) {
    console.error('Error in /api/sitemap:', error);
    
    // Return minimal valid sitemap with just home page on error
    const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}/</loc>
    <lastmod>${formatDate(new Date().toISOString())}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;
    
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.status(200).end(fallbackSitemap);
  }
}
