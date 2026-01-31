import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ImageResponse } from '@vercel/og';

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
    // Generate default OG image for homepage
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

    // Set cache headers (1 hour)
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // Convert ImageResponse to buffer and send
    const buffer = await imageResponse.arrayBuffer();
    res.setHeader('Content-Type', 'image/png');
    return res.status(200).end(Buffer.from(buffer));
  } catch (error) {
    console.error('Error generating default OG image:', error);
    res.status(500).end();
  }
}
