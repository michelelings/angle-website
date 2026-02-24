import { ImageResponse } from '@vercel/og';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
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
          // Dark gradient — no WebP (unsupported by @vercel/og)
          background: 'linear-gradient(135deg, #0b0b0b 0%, #1a1a2e 50%, #16213e 100%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px',
          }}
        >
          <h1
            style={{
              fontSize: '96px',
              fontFamily: 'serif',
              fontWeight: 400,
              color: '#ffffff',
              margin: 0,
              letterSpacing: '-2px',
            }}
          >
            Angle
          </h1>
          <p
            style={{
              fontSize: '32px',
              fontFamily: 'sans-serif',
              color: '#a0a0b0',
              margin: 0,
              marginTop: '20px',
              letterSpacing: '1px',
            }}
          >
            Stories worth listening.
          </p>
        </div>
      </div>
    ),
      {
        width: 1200,
        height: 630,
      }
    );

    // Convert ImageResponse to buffer and send
    const buffer = await imageResponse.arrayBuffer();
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    res.status(200).end(Buffer.from(buffer));
  } catch (error) {
    console.error('Error generating OG image:', error);
    res.status(500).json({ error: 'Failed to generate image', details: String(error) });
  }
}
