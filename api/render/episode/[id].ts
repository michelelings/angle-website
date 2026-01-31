import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { fetchEpisodeById } from '../../../lib/supabase.js';

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  try {
    // Extract episode ID from multiple sources
    // With Vercel file-based routing [id].ts, the parameter should be in req.query.id
    // When rewriting /episode/:id -> /api/render/episode/[id], Vercel passes it as a query param
    let episodeId = req.query.id as string;
    
    // Fallback: extract from URL pathname if query param not available
    if (!episodeId && req.url) {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const pathParts = url.pathname.split('/').filter(Boolean);
      
      // Pattern 1: /api/render/episode/123 (direct API access with file-based routing)
      if (pathParts.length >= 4 && pathParts[0] === 'api' && pathParts[1] === 'render' && pathParts[2] === 'episode') {
        episodeId = pathParts[3];
      } 
      // Pattern 2: /episode/123 (original path - should be rewritten but handle as fallback)
      else if (pathParts.length === 2 && pathParts[0] === 'episode') {
        episodeId = pathParts[1];
      }
      // Pattern 3: Check query string from URL
      else if (url.searchParams.has('id')) {
        episodeId = url.searchParams.get('id') || undefined;
      }
    }

    // Debug logging for troubleshooting
    if (!episodeId) {
      console.log('Episode render - no ID found:', {
        url: req.url,
        query: req.query,
        pathname: req.url ? new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname : 'unknown',
        headers: {
          host: req.headers.host,
          'user-agent': req.headers['user-agent']
        }
      });
    }

    if (!episodeId) {
      res.status(400).end('Episode ID is required');
      return;
    }

    // Fetch episode data
    const episode = await fetchEpisodeById(episodeId);

    if (!episode) {
      // Episode not found - redirect to home
      res.redirect(302, '/');
      return;
    }

    // Read index.html - try multiple possible paths
    const possiblePaths = [
      join(process.cwd(), 'public', 'index.html'),
      join(__dirname, '..', '..', '..', 'public', 'index.html'),
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

    // Build URLs - handle both localhost and production
    const protocol = req.headers['x-forwarded-proto'] || 
                     (req.headers['x-forwarded-ssl'] === 'on' ? 'https' : 'http');
    const host = req.headers.host || 'newsangle.co';
    const baseUrl = `${protocol}://${host}`;
    const episodeUrl = `${baseUrl}/episode/${episodeId}`;
    const ogImageUrl = `${baseUrl}/api/og-image/${episodeId}`;

    // Build meta content - escape HTML entities for safe injection
    const escapeHtml = (str: string): string => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };
    
    const title = `${episode.title} | Angle`;
    const description = episode.fullDescription || episode.description || 'Stories worth listening.';
    const escapedTitle = escapeHtml(episode.title);
    const escapedDescription = escapeHtml(description);
    const escapedFullTitle = escapeHtml(title);

    // Replace meta tags
    html = html.replace(
      /<meta property="og:type" content="[^"]*">/,
      `<meta property="og:type" content="article">`
    );
    html = html.replace(
      /<meta property="og:url" content="[^"]*">/,
      `<meta property="og:url" content="${episodeUrl}">`
    );
    html = html.replace(
      /<meta property="og:title" content="[^"]*">/,
      `<meta property="og:title" content="${escapedTitle}">`
    );
    html = html.replace(
      /<meta property="og:description" content="[^"]*">/,
      `<meta property="og:description" content="${escapedDescription}">`
    );
    html = html.replace(
      /<meta property="og:image" content="[^"]*">/,
      `<meta property="og:image" content="${ogImageUrl}">`
    );
    // Update og:image dimensions (they should already exist in the HTML)
    html = html.replace(
      /<meta property="og:image:width" content="[^"]*">/,
      `<meta property="og:image:width" content="1200">`
    );
    html = html.replace(
      /<meta property="og:image:height" content="[^"]*">/,
      `<meta property="og:image:height" content="630">`
    );
    html = html.replace(
      /<meta name="twitter:card" content="[^"]*">/,
      `<meta name="twitter:card" content="summary_large_image">`
    );
    html = html.replace(
      /<meta name="twitter:url" content="[^"]*">/,
      `<meta name="twitter:url" content="${episodeUrl}">`
    );
    html = html.replace(
      /<meta name="twitter:title" content="[^"]*">/,
      `<meta name="twitter:title" content="${escapedTitle}">`
    );
    html = html.replace(
      /<meta name="twitter:description" content="[^"]*">/,
      `<meta name="twitter:description" content="${escapedDescription}">`
    );
    html = html.replace(
      /<meta name="twitter:image" content="[^"]*">/,
      `<meta name="twitter:image" content="${ogImageUrl}">`
    );
    html = html.replace(
      /<title>[^<]*<\/title>/,
      `<title>${escapedFullTitle}</title>`
    );

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).end(html);
  } catch (error) {
    console.error('Error rendering episode page:', error);
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
