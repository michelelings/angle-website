import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { fetchCategories } from '../../lib/supabase.js';

const SPECIAL_FILTERS = ['new', 'popular'];
const BASE_URL = 'https://www.newsangle.co';

// Paths that should not be treated as categories
const EXCLUDED_PATHS = ['api', 'episode', 'images', 'fonts', 'robots.txt', 'favicon.ico', 'sitemap.xml'];

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function categoryToSlug(category: string): string {
  return category
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  try {
    // Extract category from query or URL
    let category = req.query.category as string;

    // If not in query, try extracting from URL path
    if (!category && req.url) {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const pathParts = url.pathname.split('/').filter(Boolean);
      // If path is /api/render/health, category is the last part
      if (pathParts.length >= 3 && pathParts[0] === 'api' && pathParts[1] === 'render') {
        category = pathParts[2];
      } else if (pathParts.length === 1) {
        // Direct category path like /health
        category = pathParts[0];
      }
    }

    if (!category) {
      res.status(400).end('Category is required');
      return;
    }

    const categoryValue = decodeURIComponent(category).trim();
    const categorySlug = categoryValue.toLowerCase();

    // Exclude certain paths that shouldn't be categories
    // These should be handled by Vercel's static file serving or API routing
    if (EXCLUDED_PATHS.includes(categorySlug)) {
      // Return 404 to let Vercel handle it normally
      res.status(404).end('Not Found');
      return;
    }

    // Validate category exists - handle case-insensitive matching
    const categories = await fetchCategories();

    // Helper function to convert URL slug back to display name
    const slugToCategory = (slug: string): string | null => {
      const normalizedSlug = slug.toLowerCase();

      // Try exact match first (case-insensitive)
      const exactMatch = categories.find((c) => c.toLowerCase() === normalizedSlug);
      if (exactMatch) return exactMatch;

      // Try slug match
      const slugMatch = categories.find((c) => categoryToSlug(c) === normalizedSlug);
      if (slugMatch) return slugMatch;

      return null;
    };

    const matchingCategory = slugToCategory(categorySlug);

    const isValidCategory =
      matchingCategory !== null ||
      SPECIAL_FILTERS.includes(categorySlug);

    if (!isValidCategory) {
      // Invalid category, redirect to home (let client-side handle it)
      res.redirect(302, '/');
      return;
    }

    const isSpecialFilter = SPECIAL_FILTERS.includes(categorySlug);
    const displayCategory = matchingCategory || categoryValue;
    const canonicalCategorySegment = isSpecialFilter
      ? categorySlug
      : categoryToSlug(displayCategory);

    // Read index.html - try multiple possible paths
    const possiblePaths = [
      join(process.cwd(), 'public', 'index.html'),
      join(__dirname, '..', '..', 'public', 'index.html'),
      join(process.cwd(), 'index.html'),
    ];

    let html: string | null = null;
    let lastError: Error | null = null;

    for (const indexPath of possiblePaths) {
      try {
        html = await readFile(indexPath, 'utf-8');
        break;
      } catch (error) {
        lastError = error as Error;
        // Try next path
      }
    }

    if (!html) {
      console.error('Could not find index.html. Tried paths:', possiblePaths);
      console.error('Last error:', lastError);
      throw new Error('Could not find index.html');
    }

    // Format category name for display
    const categoryLabel = categorySlug === 'new'
      ? 'New'
      : categorySlug === 'popular'
        ? 'Popular'
        : displayCategory;

    const categoryUrl = `${BASE_URL}/${encodeURIComponent(canonicalCategorySegment)}`;
    const ogImageUrl = `${BASE_URL}/api/og-image/category/${encodeURIComponent(canonicalCategorySegment)}`;

    // Build meta content
    const title = `${categoryLabel} Stories | Angle`;
    const description = categorySlug === 'new'
      ? 'Latest stories worth listening.'
      : categorySlug === 'popular'
        ? 'Popular stories worth listening.'
        : `${categoryLabel} stories worth listening.`;

    // Replace meta tags
    html = html.replace(
      /<meta property="og:type" content="website">/,
      '<meta property="og:type" content="website">'
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
      '<meta name="twitter:card" content="summary_large_image">'
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
      /<meta name="twitter:image:alt" content="[^"]*">/,
      `<meta name="twitter:image:alt" content="${description}">`
    );
    html = html.replace(
      /<title>[^<]*<\/title>/,
      `<title>${title}</title>`
    );

    const canonicalTag = `<link rel="canonical" href="${categoryUrl}">`;
    html = html.replace(
      /<link\s+rel=["']canonical["']\s+href=["'][^"']*["']\s*\/?\s*>/i,
      canonicalTag
    );
    if (!/rel=["']canonical["']/i.test(html)) {
      html = html.replace(/<\/head>/, `  ${canonicalTag}\n</head>`);
    }

    const robotsTag = '<meta name="robots" content="index, follow">';
    html = html.replace(
      /<meta\s+name=["']robots["']\s+content=["'][^"']*["']\s*\/?\s*>/i,
      robotsTag
    );
    if (!/name=["']robots["']/i.test(html)) {
      html = html.replace(/<\/head>/, `  ${robotsTag}\n</head>`);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).end(html);
  } catch (error) {
    console.error('Error rendering category page:', error);
    console.error('Error stack:', (error as Error).stack);
    console.error('Request URL:', req.url);
    console.error('Request query:', req.query);

    // Return error details in development, redirect in production
    if (process.env.VERCEL_ENV === 'development' || process.env.NODE_ENV === 'development') {
      res.status(500).json({
        error: (error as Error).message,
        stack: (error as Error).stack,
        query: req.query,
        url: req.url,
      });
    } else {
      // Fallback: redirect to home
      res.redirect(302, '/');
    }
  }
}
