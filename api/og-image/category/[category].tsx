import { ImageResponse } from '@vercel/og';
import { fetchMostRecentEpisodeByCategory } from '../../../lib/supabase.js';

export const config = {
  runtime: 'nodejs20.x',
};

export default async function handler(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    // Extract category from path like /api/og-image/category/sports
    const pathParts = url.pathname.split('/').filter(Boolean);
    const categoryIndex = pathParts.indexOf('category');
    const category = categoryIndex !== -1 && categoryIndex < pathParts.length - 1 
      ? pathParts[categoryIndex + 1] 
      : null;

    if (!category || typeof category !== 'string') {
      return new Response(JSON.stringify({ error: 'Category is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch the most recent episode for this category
    const episode = await fetchMostRecentEpisodeByCategory(category);

    // Get base URL from request
    const protocol = url.protocol;
    const host = url.host;
    const baseUrl = `${protocol}//${host}`;

    // Format category name for display
    const categoryLabel = category === 'new' ? 'New' : 
                          category === 'popular' ? 'Popular' : 
                          category.charAt(0).toUpperCase() + category.slice(1);

    // If no episode found, use default OG image with category name
    if (!episode || !episode.coverImage) {
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
              <div
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.25)',
                  color: '#ffffff',
                  padding: '12px 24px',
                  borderRadius: '4px',
                  fontSize: '18px',
                  fontFamily: 'monospace',
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                  marginBottom: '32px',
                  fontWeight: 500,
                }}
              >
                {categoryLabel.toUpperCase()}
              </div>
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

    // Get cover image URL (make it absolute if relative)
    const coverImageUrl = episode.coverImage.startsWith('http') 
      ? episode.coverImage 
      : `${baseUrl}${episode.coverImage}`;

    // Generate OG image with the most recent episode's cover image
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
            {/* Category tag */}
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
                color: '#ffffff',
                padding: '12px 24px',
                borderRadius: '4px',
                fontSize: '18px',
                fontFamily: 'monospace',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                marginBottom: '32px',
                fontWeight: 500,
              }}
            >
              {categoryLabel.toUpperCase()}
            </div>

            {/* Title */}
            <h1
              style={{
                fontSize: '64px',
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
              {categoryLabel} Stories
            </h1>

            {/* Description */}
            <p
              style={{
                fontSize: '28px',
                fontFamily: 'sans-serif',
                color: '#e0e0e0',
                lineHeight: 1.4,
                margin: 0,
                maxWidth: '900px',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.7)',
              }}
            >
              {category === 'new' ? 'Latest stories worth listening.' :
               category === 'popular' ? 'Popular stories worth listening.' :
               `${categoryLabel} stories worth listening.`}
            </p>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error('Error generating category OG image:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate OG image' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
