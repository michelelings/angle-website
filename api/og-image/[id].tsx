import { ImageResponse } from '@vercel/og';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchEpisodeById } from '../../lib/supabase.js';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  let id: string | undefined;

  try {
    // Extract episode ID from query (Vercel file-based routing)
    id = req.query.id as string;
    
    // Fallback: extract from URL pathname if query param not available
    if (!id && req.url) {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const pathParts = url.pathname.split('/').filter(Boolean);
      
      // Pattern 1: /api/og-image/123 (direct API access with file-based routing)
      if (pathParts.length >= 3 && pathParts[0] === 'api' && pathParts[1] === 'og-image') {
        id = pathParts[2];
      }
      // Pattern 2: Check query string from URL
      else if (url.searchParams.has('id')) {
        id = url.searchParams.get('id') || undefined;
      }
    }

    if (!id || typeof id !== 'string') {
      res.status(400).json({ error: 'Episode ID is required' });
      return;
    }

    const episode = await fetchEpisodeById(id);

    if (!episode) {
      res.status(404).json({ error: 'Episode not found' });
      return;
    }

    // Use canonical base URL to avoid www vs non-www mismatches
    // This ensures OG images always use the same host, preventing crawler cache issues
    const baseUrl = 'https://www.newsangle.co';

    // Get cover image URL (make it absolute if relative)
    // Avoid WebP for OG rendering (common crash cause)
    let coverImageUrl: string | undefined;

    if (episode.coverImage) {
      const abs = episode.coverImage.startsWith('http')
        ? episode.coverImage
        : `${baseUrl}${episode.coverImage}`;

      // Skip WebP - will render without background image
      const isWebp = abs.toLowerCase().endsWith('.webp');
      coverImageUrl = isWebp ? undefined : abs;
    }
    // If no cover image, coverImageUrl stays undefined (will render with solid background)

    // Get description text (truncate if too long)
    const description = episode.fullDescription || episode.description || '';
    const truncatedDescription = description.length > 200 
      ? description.substring(0, 197) + '...' 
      : description;

    // Log for debugging
    console.log('Generating OG image for episode:', {
      id,
      title: episode.title,
      coverImageUrl,
      baseUrl
    });

    // Generate OG image - use absolutely positioned img instead of backgroundImage
    // Skip WebP images to avoid renderer crashes
    try {
      const imageResponse = new ImageResponse(
        (
          <div
            style={{
              height: '100%',
              width: '100%',
              display: 'flex',
              position: 'relative',
              backgroundColor: '#0b0b0b',
              overflow: 'hidden',
            }}
          >
            {/* Background image - only render if available and not WebP */}
            {coverImageUrl && (
              <img
                src={coverImageUrl}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            )}

            {/* Dark overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.65)',
              }}
            />

            {/* Content */}
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center',
                padding: '80px',
                width: '100%',
                height: '100%',
              }}
            >
              {/* Category tag (if available) */}
              {episode.category && (
                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.25)',
                    color: '#ffffff',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    marginBottom: '24px',
                    fontWeight: 500,
                  }}
                >
                  {episode.category.toUpperCase()}
                </div>
              )}

              {/* Title */}
              <h1
                style={{
                  fontSize: episode.title.length > 60 ? '48px' : '64px',
                  fontFamily: 'serif',
                  fontWeight: 400,
                  color: '#ffffff',
                  lineHeight: 1.1,
                  margin: 0,
                  marginBottom: '24px',
                  maxWidth: '1000px',
                  textShadow: '0 2px 8px rgba(0, 0, 0, 0.7)',
                }}
              >
                {episode.title}
              </h1>

              {/* Description */}
              {truncatedDescription && (
                <p
                  style={{
                    fontSize: '24px',
                    fontFamily: 'sans-serif',
                    color: '#e0e0e0',
                    lineHeight: 1.4,
                    margin: 0,
                    maxWidth: '900px',
                    textShadow: '0 2px 4px rgba(0, 0, 0, 0.7)',
                  }}
                >
                  {truncatedDescription}
                </p>
              )}
            </div>
          </div>
        ),
        {
          width: 1200,
          height: 630,
        }
      );

      // Convert Response to buffer and send
      const buffer = await imageResponse.arrayBuffer();
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800');
      res.status(200).end(Buffer.from(buffer));
    } catch (imageError) {
      console.error('ImageResponse error raw:', String(imageError));
      console.error('ImageResponse error obj:', imageError);
      throw imageError;
    }
  } catch (error) {
    console.error('Error generating OG image:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      episodeId: id,
    });
    res.status(500).json({ 
      error: 'Failed to generate OG image',
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      raw: String(error)
    });
  }
}
