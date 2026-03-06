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

    const datePublished = episode.createdAt;
    const dateModified = episode.updatedAt || episode.createdAt;

    // Keep OG + Twitter image URLs in sync and point them to a first-party endpoint.
    // The image URL is cache-busted per-episode update so social crawlers can refresh.
    const socialImageVersion = encodeURIComponent(dateModified || datePublished || episodeId);
    const ogImageUrl = `${baseUrl}/api/og-image/${encodeURIComponent(episodeId)}?v=${socialImageVersion}`;

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
        name: 'NewsAngle',
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

    // BreadcrumbList JSON-LD
    const categorySlug = (episode.category || '').trim().toLowerCase().replace(/\s+/g, '-');
    const categoryName = (episode.category || '').trim();
    const breadcrumbItems: Array<{ '@type': string; position: number; name: string; item: string }> = [
      { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl },
    ];
    if (categorySlug && categoryName) {
      breadcrumbItems.push({
        '@type': 'ListItem',
        position: 2,
        name: categoryName,
        item: `${baseUrl}/${categorySlug}`,
      });
    }
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: breadcrumbItems.length + 1,
      name: headline,
      item: episodeUrl,
    });
    const breadcrumbJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbItems,
    };
    const escapedBreadcrumbJsonLd = JSON.stringify(breadcrumbJsonLd).replace(/</g, '\\u003c');

    const normalizeText = (value: string | null | undefined): string =>
      String(value || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const truncateWords = (value: string, maxWords: number): string => {
      const words = value.split(/\s+/).filter(Boolean);
      if (words.length <= maxWords) return value;
      return `${words.slice(0, maxWords).join(' ')}…`;
    };

    const countWords = (value: string): number =>
      value.split(/\s+/).filter(Boolean).length;

    const introText = normalizeText(retrofit?.summaryOpener || episode.fullDescription || episode.description);
    const fallbackDescriptionText = normalizeText(episode.fullDescription || episode.description);
    // script_full / script_segments is now mapped to episode.transcript via fetchEpisodeById
    const transcriptText = normalizeText(episode.transcript);

    const bodyParagraphs: string[] = [];
    if (introText) bodyParagraphs.push(introText);
    if (fallbackDescriptionText && fallbackDescriptionText !== introText) {
      bodyParagraphs.push(fallbackDescriptionText);
    }

    // Always inject transcript when available — do not gate on word count.
    // Limit to 600 words to keep response size reasonable while providing
    // ample content for search indexing (well above the 500-word CI threshold).
    if (transcriptText) {
      bodyParagraphs.push(truncateWords(transcriptText, 600));
    }

    if (bodyParagraphs.length === 0) {
      bodyParagraphs.push('Stories worth listening. Explore this Angle episode for key context, takeaways, and related coverage.');
    }

    if (countWords(bodyParagraphs.join(' ')) < 50) {
      const categoryText = normalizeText(episode.category);
      const fallbackContext = [
        `Episode context: ${headline}.`,
        categoryText ? `Category: ${categoryText}.` : '',
        authorName ? `Host: ${authorName}.` : '',
        'This server-rendered summary is included so readers and search crawlers can understand the story without running JavaScript.',
        'For the full listening experience, open this episode in Angle and explore related coverage on newsangle.co.'
      ]
        .filter(Boolean)
        .join(' ');

      bodyParagraphs.push(fallbackContext);
    }

    const ssrBodyWordCount = countWords(bodyParagraphs.join(' '));

    const relatedCoverageHtml = retrofit && retrofit.internalLinks.length > 0
      ? `<p style="font-size:13px;line-height:1.5;color:#b7b7b7;margin:8px 0 0;">Related coverage: ${retrofit.internalLinks
          .map((link) => {
            const href = link.href.startsWith('http')
              ? link.href
              : `${baseUrl}${link.href.startsWith('/') ? '' : '/'}${link.href}`;
            return `<a href="${href}" style="color:#cfe4ff;text-decoration:underline;">${escapeHtml(link.label)}</a>`;
          })
          .join(' · ')}</p>`
      : '';

    const episodeBodySectionHtml = `
    <section id="episode-ssr-content" data-ssr-words="${ssrBodyWordCount}" style="max-width:820px;margin:0 auto;padding:8px 20px 12px;color:#f5f5f5;">
      <h1 style="font-size:28px;line-height:1.2;font-weight:600;margin:0 0 10px;">${escapedTitle}</h1>
      ${bodyParagraphs.map((paragraph) => `<p style="font-size:16px;line-height:1.6;color:#d9d9d9;margin:0 0 10px;">${escapeHtml(paragraph)}</p>`).join('\n      ')}
      ${relatedCoverageHtml}
    </section>`;

    const injectEpisodeBody = (inputHtml: string, sectionHtml: string): string => {
      if (inputHtml.includes('id="episode-ssr-content"')) return inputHtml;

      const headerSectionPattern = /(<div class="header-section">[\s\S]*?<\/div>)/i;
      if (headerSectionPattern.test(inputHtml)) {
        return inputHtml.replace(headerSectionPattern, `$1\n${sectionHtml}`);
      }

      const filtersPattern = /(<div class="filters"[^>]*>)/i;
      if (filtersPattern.test(inputHtml)) {
        return inputHtml.replace(filtersPattern, `${sectionHtml}\n$1`);
      }

      return inputHtml.replace(/<\/body>/i, `${sectionHtml}\n</body>`);
    };

    const upsertMetaTag = (inputHtml: string, key: 'name' | 'property', metaName: string, content: string): string => {
      const escapedMetaName = metaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`<meta\\s+[^>]*${key}=["']${escapedMetaName}["'][^>]*>`, 'i');
      const tag = `<meta ${key}="${metaName}" content="${content}">`;

      if (pattern.test(inputHtml)) {
        return inputHtml.replace(pattern, tag);
      }

      return inputHtml.replace(/<\/head>/i, `  ${tag}\n</head>`);
    };

    const upsertCanonical = (inputHtml: string, href: string): string => {
      const canonicalTag = `<link rel="canonical" href="${href}">`;
      const canonicalPattern = /<link\s+[^>]*rel=["']canonical["'][^>]*>/i;

      if (canonicalPattern.test(inputHtml)) {
        return inputHtml.replace(canonicalPattern, canonicalTag);
      }

      return inputHtml.replace(/<\/head>/i, `  ${canonicalTag}\n</head>`);
    };

    const upsertTitle = (inputHtml: string, titleText: string): string => {
      if (/<title>[\s\S]*?<\/title>/i.test(inputHtml)) {
        return inputHtml.replace(/<title>[\s\S]*?<\/title>/i, `<title>${titleText}</title>`);
      }

      return inputHtml.replace(/<\/head>/i, `  <title>${titleText}</title>\n</head>`);
    };

    html = upsertTitle(html, escapedFullTitle);

    html = upsertMetaTag(html, 'name', 'description', escapedDescription);
    html = upsertMetaTag(html, 'name', 'robots', 'index, follow');

    html = upsertMetaTag(html, 'property', 'og:type', 'article');
    html = upsertMetaTag(html, 'property', 'og:url', episodeUrl);
    html = upsertMetaTag(html, 'property', 'og:title', escapedTitle);
    html = upsertMetaTag(html, 'property', 'og:description', escapedDescription);
    html = upsertMetaTag(html, 'property', 'og:image', ogImageUrl);
    html = upsertMetaTag(html, 'property', 'og:image:width', '1200');
    html = upsertMetaTag(html, 'property', 'og:image:height', '630');

    html = upsertMetaTag(html, 'name', 'twitter:card', 'summary_large_image');
    html = upsertMetaTag(html, 'name', 'twitter:url', episodeUrl);
    html = upsertMetaTag(html, 'name', 'twitter:title', escapedTitle);
    html = upsertMetaTag(html, 'name', 'twitter:description', escapedDescription);
    html = upsertMetaTag(html, 'name', 'twitter:image', ogImageUrl);
    html = upsertMetaTag(html, 'name', 'twitter:image:alt', escapedDescription);

    html = upsertCanonical(html, episodeUrl);

    // Keep only one of each JSON-LD block and inject into <head>
    html = html.replace(/\s*<script id="newsarticle-jsonld" type="application\/ld\+json">[\s\S]*?<\/script>/, '');
    html = html.replace(/\s*<script id="breadcrumb-jsonld" type="application\/ld\+json">[\s\S]*?<\/script>/, '');
    html = html.replace(
      /<\/head>/,
      `  <script id="newsarticle-jsonld" type="application/ld+json">${escapedJsonLd}</script>\n  <script id="breadcrumb-jsonld" type="application/ld+json">${escapedBreadcrumbJsonLd}</script>\n</head>`
    );

    html = injectEpisodeBody(html, episodeBodySectionHtml);

    // Replace the SPA shell's generic "0 stories worth listening." placeholder
    // in the header-section <p class="intro"> with the episode title.
    // This prevents Googlebot from seeing the error/empty-state string in raw HTML.
    html = html.replace(
      '<p class="intro">0 stories worth listening.</p>',
      `<p class="intro">${escapedTitle}</p>`
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
