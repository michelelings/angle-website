import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { fetchCategories } from '../../lib/supabase.js';

const SPECIAL_FILTERS = ['new', 'popular'];

// Paths that should not be treated as categories
const EXCLUDED_PATHS = ['api', 'episode', 'images', 'fonts', 'robots.txt', 'favicon.ico', 'sitemap.xml'];

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  try {
    const category = req.query.category as string;

    if (!category) {
      res.status(400).end('Category is required');
      return;
    }

    // Exclude certain paths that shouldn't be categories
    // These should be handled by Vercel's static file serving or API routing
    if (EXCLUDED_PATHS.includes(category.toLowerCase())) {
      // Return 404 to let Vercel handle it normally
      res.status(404).end('Not Found');
      return;
    }

    // Validate category exists
    const categories = await fetchCategories();
    const isValidCategory = 
      categories.includes(category) || 
      SPECIAL_FILTERS.includes(category);

    if (!isValidCategory) {
      // Invalid category, redirect to home (let client-side handle it)
      res.redirect(302, '/');
      return;
    }

    // Read index.html
    const indexPath = join(process.cwd(), 'public', 'index.html');
    let html = await readFile(indexPath, 'utf-8');

    // Format category name for display
    const categoryLabel = category === 'new' ? 'New' : 
                         category === 'popular' ? 'Popular' : 
                         category.charAt(0).toUpperCase() + category.slice(1);

    // Build URLs - handle both localhost and production
    const protocol = req.headers['x-forwarded-proto'] || 
                     (req.headers['x-forwarded-ssl'] === 'on' ? 'https' : 'http');
    const host = req.headers.host || 'newsangle.co';
    const baseUrl = `${protocol}://${host}`;
    const categoryUrl = `${baseUrl}/${category}`;
    const ogImageUrl = `${baseUrl}/api/og-image/category/${category}`;

    // Build meta content
    const title = `${categoryLabel} Stories | Angle`;
    const description = category === 'new' 
      ? 'Latest stories worth listening.' 
      : category === 'popular' 
      ? 'Popular stories worth listening.' 
      : `${categoryLabel} stories worth listening.`;

    // Replace meta tags
    html = html.replace(
      /<meta property="og:type" content="website">/,
      `<meta property="og:type" content="website">`
    );
    html = html.replace(
      /<meta property="og:url" content="[^"]*">/,
      `<meta property="og:url" content="${categoryUrl}">`
    );
    html = html.replace(
      /<meta property="og:title" content="[^"]*">/,
      `<meta property="og:title" content="${title}">`
    );
    html = html.replace(
      /<meta property="og:description" content="[^"]*">/,
      `<meta property="og:description" content="${description}">`
    );
    html = html.replace(
      /<meta property="og:image" content="[^"]*">/,
      `<meta property="og:image" content="${ogImageUrl}">`
    );
    html = html.replace(
      /<meta name="twitter:card" content="summary_large_image">/,
      `<meta name="twitter:card" content="summary_large_image">`
    );
    html = html.replace(
      /<meta name="twitter:url" content="[^"]*">/,
      `<meta name="twitter:url" content="${categoryUrl}">`
    );
    html = html.replace(
      /<meta name="twitter:title" content="[^"]*">/,
      `<meta name="twitter:title" content="${title}">`
    );
    html = html.replace(
      /<meta name="twitter:description" content="[^"]*">/,
      `<meta name="twitter:description" content="${description}">`
    );
    html = html.replace(
      /<meta name="twitter:image" content="[^"]*">/,
      `<meta name="twitter:image" content="${ogImageUrl}">`
    );
    html = html.replace(
      /<title>[^<]*<\/title>/,
      `<title>${title}</title>`
    );

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).end(html);
  } catch (error) {
    console.error('Error rendering category page:', error);
    // Fallback: redirect to home
    res.redirect(302, '/');
  }
}
