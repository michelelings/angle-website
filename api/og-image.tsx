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
          backgroundColor: '#1a1a1a',
          backgroundImage: 'url(https://newsangle.co/images/icon.webp)',
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
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
              fontSize: '72px',
              fontFamily: 'serif',
              fontWeight: 400,
              color: '#ffffff',
              margin: 0,
              marginTop: '40px',
            }}
          >
            Angle
          </h1>
          <p
            style={{
              fontSize: '28px',
              fontFamily: 'sans-serif',
              color: '#e0e0e0',
              margin: 0,
              marginTop: '16px',
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
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.status(200).end(Buffer.from(buffer));
  } catch (error) {
    console.error('Error generating OG image:', error);
    res.status(500).json({ error: 'Failed to generate image' });
  }
}
