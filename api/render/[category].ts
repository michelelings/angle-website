import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { fetchCategories } from '../../lib/supabase.js';

const SPECIAL_FILTERS = ['new', 'popular'];

// Paths that should not be treated as categories
const EXCLUDED_PATHS = ['api', 'episode', 'images', 'fonts', 'robots.txt', 'favicon.ico', 'sitemap.xml'];

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

    // Exclude certain paths that shouldn't be categories
    // These should be handled by Vercel's static file serving or API routing
    if (EXCLUDED_PATHS.includes(category.toLowerCase())) {
      // Return 404 to let Vercel handle it normally
      res.status(404).end('Not Found');
      return;
    }

    // Validate category exists - handle case-insensitive matching
    const categories = await fetchCategories();
    
    // Helper function to convert category display name to URL slug
    const categoryToSlug = (cat: string): string => {
      return cat.toLowerCase().replace(/\s+/g, '-').replace(/[&]/g, 'and').replace(/[^a-z0-9-]/g, '');
    };
    
    // Helper function to convert URL slug back to display name
    const slugToCategory = (slug: string): string | null => {
      // Try exact match first (case-insensitive)
      const exactMatch = categories.find(c => c.toLowerCase() === slug.toLowerCase());
      if (exactMatch) return exactMatch;
      
      // Try slug match
      const slugMatch = categories.find(c => categoryToSlug(c) === slug.toLowerCase());
      if (slugMatch) return slugMatch;
      
      // Try partial match (handle "business-economy" -> "Business & Economy")
      const normalizedSlug = slug.toLowerCase().replace(/-/g, '');
      const partialMatch = categories.find(c => 
        c.toLowerCase().replace(/\s+/g, '').replace(/[&]/g, '').replace(/[^a-z0-9]/g, '') === normalizedSlug
      );
      if (partialMatch) return partialMatch;
      
      return null;
    };
    
    const categorySlug = category.toLowerCase();
    const matchingCategory = slugToCategory(categorySlug);
    
    const isValidCategory = 
      matchingCategory !== null || 
      SPECIAL_FILTERS.includes(categorySlug);

    if (!isValidCategory) {
      // Invalid category, redirect to home (let client-side handle it)
      res.redirect(302, '/');
      return;
    }
    
    // Use the matched category name (with proper casing) for display
    const displayCategory = matchingCategory || category;

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
    const categoryLabel = displayCategory === 'new' ? 'New' : 
                         displayCategory === 'popular' ? 'Popular' : 
                         displayCategory;

    // Build URLs - handle both localhost and production
    const protocol = req.headers['x-forwarded-proto'] || 
                     (req.headers['x-forwarded-ssl'] === 'on' ? 'https' : 'http');
    const host = req.headers.host || 'newsangle.co';
    const baseUrl = `${protocol}://${host}`;
    // Use lowercase category for URL (e.g., /health not /Health) - reuse categorySlug from above
    const categoryUrl = `${baseUrl}/${categorySlug}`;
    const ogImageUrl = `${baseUrl}/api/og-image/category/${categorySlug}`;

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
