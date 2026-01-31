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
  try {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1];

    if (!id || typeof id !== 'string') {
      res.status(400).json({ error: 'Episode ID is required' });
      return;
    }

    const episode = await fetchEpisodeById(id);

    if (!episode) {
      res.status(404).json({ error: 'Episode not found' });
      return;
    }

    // Get base URL from request
    const protocol = url.protocol;
    const host = url.host;
    const baseUrl = `${protocol}//${host}`;

    // Get cover image URL (make it absolute if relative)
    const coverImageUrl = episode.coverImage
      ? (episode.coverImage.startsWith('http') 
          ? episode.coverImage 
          : `${baseUrl}${episode.coverImage}`)
      : `${baseUrl}/images/icon.webp`;

    // Get description text (truncate if too long)
    const description = episode.fullDescription || episode.description || '';
    const truncatedDescription = description.length > 200 
      ? description.substring(0, 197) + '...' 
      : description;

    // Generate OG image
    const imageResponse = new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            backgroundColor: '#000000',
          }}
        >
          {/* Background image */}
          <img
            src={coverImageUrl}
            alt=""
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          
          {/* Dark overlay for text readability */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
            }}
          />
          
          {/* Content container */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'center',
              padding: '80px',
              width: '100%',
              height: '100%',
              position: 'relative',
              zIndex: 1,
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
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.status(200).end(Buffer.from(buffer));
  } catch (error) {
    console.error('Error generating OG image:', error);
    res.status(500).json({ error: 'Failed to generate OG image' });
  }
}
