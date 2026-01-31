import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'nodejs',
};

export default function handler() {
  return new ImageResponse(
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
}
