import type { Episode } from './episodes';

export const ARTWORK_WIDTHS = [360, 540, 720, 1080] as const;
export const GALLERY_IMAGE_SIZES = '(orientation: landscape) and (max-height: 500px) and (max-width: 1000px) 144px, (max-width: 374px) 248px, (max-width: 768px) 260px, (max-width: 1366px) 280px, 360px';
type Artwork = Pick<Episode, 'id' | 'coverImage' | 'createdAt' | 'updatedAt'>;

export function artworkVersion(episode: Artwork): string {
  // Include the source URL as well as publication metadata when artwork changes.
  return `${episode.updatedAt || episode.createdAt}|${episode.coverImage || ''}`;
}
export function artworkUrl(episode: Artwork, width: number): string {
  return `/api/artwork/${encodeURIComponent(episode.id)}?${new URLSearchParams({ w: String(width), v: artworkVersion(episode) })}`;
}
export function artworkProps(episode: Artwork, sizes = GALLERY_IMAGE_SIZES) {
  if (!episode.coverImage) return { src: '/images/icon.webp' };
  return {
    src: artworkUrl(episode, 540),
    srcSet: ARTWORK_WIDTHS.map(width => `${artworkUrl(episode, width)} ${width}w`).join(', '),
    sizes,
  };
}
