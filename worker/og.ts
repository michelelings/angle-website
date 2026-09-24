import { ImageResponse } from '@cloudflare/pages-plugin-vercel-og/api';

// Text-only cards avoid remote image/font fetches and work even with an empty catalog.
export function ogImage(title: string, description: string, category?: string | null): Response {
  return new ImageResponse({ type: 'div', key: null, props: {
    style: { display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      width: '100%', height: '100%', padding: '64px', background: '#101010', color: '#f5f3ee' },
    children: [
      { type: 'div', key: null, props: { style: { fontSize: 25, color: '#c9b98c' }, children: category ? `ANGLE / ${category.slice(0, 70).toUpperCase()}` : 'ANGLE' } },
      { type: 'div', key: null, props: { style: { display: 'flex', flexDirection: 'column' }, children: [
        { type: 'div', key: null, props: { style: { fontSize: title.length > 65 ? 46 : 64, lineHeight: 1.12 }, children: title.slice(0, 150) } },
        { type: 'div', key: null, props: { style: { fontSize: 26, lineHeight: 1.4, color: '#bdbdbd', marginTop: 28 }, children: description.length > 190 ? description.slice(0, 187) + '…' : description } },
      ] } },
      { type: 'div', key: null, props: { style: { fontSize: 22, color: '#aaa' }, children: 'Stories worth listening.' } },
    ],
  } }, { width: 1200, height: 630, headers: { 'Cache-Control': 'public, max-age=300' } });
}
