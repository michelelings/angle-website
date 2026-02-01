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
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000',
          }}
        >
          <div
            style={{
              color: '#fff',
              fontSize: '48px',
            }}
          >
            OK
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );

    const buffer = await imageResponse.arrayBuffer();
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=86400');
    res.status(200).end(Buffer.from(buffer));
  } catch (error) {
    console.error('OG test error:', error);
    res.status(500).json({ 
      error: 'Failed to generate test image',
      details: error instanceof Error ? error.message : String(error),
      raw: String(error)
    });
  }
}
