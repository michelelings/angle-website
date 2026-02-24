import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { fetchEpisodeById } from '../../../lib/supabase.js';
import { getTranscriptV1RetrofitById } from '../../../lib/transcriptV1Retrofit.js';

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
    let episodeId = req.query.id as string | undefined;
    
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

    // Use canonical base URL to avoid www vs non-www mismatches
    // This ensures OG meta tags always use the same host, preventing crawler cache issues
    const baseUrl = 'https://www.newsangle.co';
    const episodeUrl = `${baseUrl}/episode/${episodeId}`;

    // Use the story's actual cover image directly as the og:image.
    // All cover images are Supabase public URLs (WebP) — using them directly is
    // simpler, more reliable, and shows the actual story image to crawlers.
    // The dynamic /api/og-image endpoint was skipping WebP images so crawlers
    // were getting a blank dark background instead of the story's photo.
    const ogImageUrl = (() => {
      const ci = episode.coverImage;
      if (!ci) return `${baseUrl}/images/og-image.png`;
      if (ci.startsWith('http://') || ci.startsWith('https://')) return ci;
      return `${baseUrl}${ci.startsWith('/') ? '' : '/'}${ci}`;
    })();

    // Build meta content - escape HTML entities for safe injection
    const escapeHtml = (str: string): string => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };
    
    const retrofit = getTranscriptV1RetrofitById(episodeId);

    const title = retrofit?.seoTitle || `${episode.title} | Angle`;
    const description = retrofit?.metaDescription || episode.fullDescription || episode.description || 'Stories worth listening.';
    const headline = retrofit?.h1 || episode.title;

    const escapedTitle = escapeHtml(headline);
    const escapedDescription = escapeHtml(description);
    const escapedFullTitle = escapeHtml(title);

    const toAbsoluteUrl = (value: string | null | undefined): string | null => {
      if (!value) return null;
      if (value.startsWith('http://') || value.startsWith('https://')) return value;
      return `${baseUrl}${value.startsWith('/') ? '' : '/'}${value}`;
    };

    const articleImageUrl = toAbsoluteUrl(episode.coverImage) || `${baseUrl}/images/icon.webp`;
    const authorName = (episode.host || '').trim() || 'Angle';
    const datePublished = episode.createdAt;
    const dateModified = episode.updatedAt || episode.createdAt;

    const newsArticleJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline,
      datePublished,
      dateModified,
      author: {
        '@type': 'Person',
        name: authorName,
      },
      publisher: {
        '@type': 'Organization',
        name: 'Angle',
        logo: {
          '@type': 'ImageObject',
          url: `${baseUrl}/images/icon.webp`,
        },
      },
      image: [articleImageUrl],
      url: episodeUrl,
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': episodeUrl,
      },
    };

    const escapedJsonLd = JSON.stringify(newsArticleJsonLd).replace(/</g, '\\u003c');

    const retrofitSectionHtml = (() => {
      if (!retrofit) return '';

      const links = retrofit.internalLinks
        .map((link) => {
          const href = link.href.startsWith('http') ? link.href : `${baseUrl}${link.href.startsWith('/') ? '' : '/'}${link.href}`;
          return `<a href="${href}" style="color:#cfe4ff;text-decoration:underline;">${escapeHtml(link.label)}</a>`;
        })
        .join(' · ');

      return `
    <section id="transcript-v1-retrofit" style="max-width:820px;margin:0 auto;padding:8px 20px 12px;color:#f5f5f5;">
      <h1 style="font-size:28px;line-height:1.2;font-weight:600;margin:0 0 10px;">${escapeHtml(retrofit.h1)}</h1>
      <p style="font-size:16px;line-height:1.6;color:#d9d9d9;margin:0 0 10px;">${escapeHtml(retrofit.summaryOpener)}</p>
      <p style="font-size:13px;line-height:1.5;color:#b7b7b7;margin:0;">Related coverage: ${links}</p>
    </section>`;
    })();

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
      /<meta\s+name=["']description["']\s+content=["'][^"']*["']\s*\/?\s*>/i,
      `<meta name="description" content="${escapedDescription}">`
    );
    if (!/meta\s+name=["']description["']/i.test(html)) {
      html = html.replace(/<\/head>/, `  <meta name="description" content="${escapedDescription}">\n</head>`);
    }
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
      /<meta name="twitter:image:alt" content="[^"]*">/,
      `<meta name="twitter:image:alt" content="${escapedDescription}">`
    );
    html = html.replace(
      /<title>[^<]*<\/title>/,
      `<title>${escapedFullTitle}</title>`
    );

    const canonicalTag = `<link rel="canonical" href="${episodeUrl}">`;
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

    // Keep only one NewsArticle JSON-LD block and inject it into <head>
    html = html.replace(/\s*<script id="newsarticle-jsonld" type="application\/ld\+json">[\s\S]*?<\/script>/, '');
    html = html.replace(
      /<\/head>/,
      `  <script id="newsarticle-jsonld" type="application/ld+json">${escapedJsonLd}</script>\n</head>`
    );

    if (retrofitSectionHtml && !html.includes('id="transcript-v1-retrofit"')) {
      html = html.replace(
        /(<div class="header-section">[\s\S]*?<\/div>)/,
        (matched) => `${matched}\n${retrofitSectionHtml}`
      );
    }

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
