import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ImageResponse } from '@vercel/og';
import { fetchEpisodeById } from '../../lib/supabase.js';

const BASE_URL = 'https://newsangle.co';

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
    res.status(405).end();
    return;
  }

  try {
    // Extract episode ID from query or path
    const episodeId = req.query.id as string;
    
    if (!episodeId) {
      // Fallback to default image
      return serveDefaultImage(res);
    }

    // Fetch episode data
    const episode = await fetchEpisodeById(episodeId);

    if (!episode) {
      // Episode not found, serve default image
      return serveDefaultImage(res);
    }

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
            backgroundImage: episode.coverImage
              ? `url(${episode.coverImage})`
              : 'linear-gradient(to bottom, #1a1a1a, #2a2a2a)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            position: 'relative',
          }}
        >
          {/* Dark overlay for text readability */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.7))',
            }}
          />

          {/* Category tag */}
          {episode.category && (
            <div
              style={{
                position: 'absolute',
                top: '40px',
                left: '60px',
                padding: '8px 16px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                fontSize: '18px',
                fontWeight: 600,
                color: '#ffffff',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {episode.category}
            </div>
          )}

          {/* Title */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 80px',
              textAlign: 'center',
              zIndex: 1,
            }}
          >
            <h1
              style={{
                fontSize: '64px',
                fontWeight: 400,
                lineHeight: 1.2,
                color: '#ffffff',
                margin: 0,
                fontFamily: 'LTT Recoletta, serif',
                maxWidth: '1000px',
                textShadow: '0 2px 20px rgba(0,0,0,0.5)',
              }}
            >
              {episode.title}
            </h1>
          </div>

          {/* Logo/Branding */}
          <div
            style={{
              position: 'absolute',
              bottom: '40px',
              right: '60px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              zIndex: 1,
            }}
          >
            <div
              style={{
                fontSize: '24px',
                fontWeight: 600,
                color: '#ffffff',
                textShadow: '0 2px 10px rgba(0,0,0,0.5)',
              }}
            >
              Angle
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );

    // Set cache headers (1 hour)
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // Convert ImageResponse to buffer and send
    const buffer = await imageResponse.arrayBuffer();
    res.setHeader('Content-Type', 'image/png');
    return res.status(200).end(Buffer.from(buffer));
  } catch (error) {
    console.error('Error generating OG image:', error);
    // Fallback to default image on error
    return serveDefaultImage(res);
  }
}

async function serveDefaultImage(res: VercelResponse): Promise<void> {
  try {
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
            background: 'linear-gradient(to bottom, #1a1a1a, #2a2a2a)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '24px',
            }}
          >
            <div
              style={{
                fontSize: '72px',
                fontWeight: 400,
                color: '#ffffff',
                fontFamily: 'LTT Recoletta, serif',
              }}
            >
              Angle
            </div>
            <div
              style={{
                fontSize: '32px',
                color: '#e0e0e0',
                fontWeight: 400,
              }}
            >
              Stories worth listening.
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );

    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // Convert ImageResponse to buffer and send
    const buffer = await imageResponse.arrayBuffer();
    res.setHeader('Content-Type', 'image/png');
    return res.status(200).end(Buffer.from(buffer));
  } catch (error) {
    console.error('Error serving default OG image:', error);
    res.status(500).end();
  }
}
