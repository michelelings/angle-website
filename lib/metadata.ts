import type { Metadata } from 'next';
import { ORIGIN, DESCRIPTION } from './site';
import type { Episode } from './episodes';
export function pageMetadata(path = '/', title = 'Angle', description = DESCRIPTION, image = '/api/og-image'): Metadata {
  return { title, description, robots: { index: true, follow: true }, alternates: { canonical: ORIGIN + path },
    openGraph: { title, description, url: ORIGIN + path, type: 'website', images: [{ url: ORIGIN + image, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, description, images: [ORIGIN + image] } };
}
export function episodeMetadata(episode: Episode): Metadata {
  const meta = pageMetadata(`/episode/${episode.id}`, `${episode.title} | Angle`, episode.fullDescription || episode.description || DESCRIPTION, `/api/og-image/${episode.id}`);
  return { ...meta, openGraph: { ...meta.openGraph, type: 'article',
    ...(episode.previewVideoUrl ? { videos: [{
      url: episode.previewVideoUrl,
      secureUrl: episode.previewVideoUrl,
      type: 'video/mp4',
      ...(episode.previewVideoWidth ? { width: episode.previewVideoWidth } : {}),
      ...(episode.previewVideoHeight ? { height: episode.previewVideoHeight } : {}),
    }] } : {}),
  } };
}
export function episodeJsonLd(episode: Episode): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@type': 'PodcastEpisode', name: episode.title,
    url: `${ORIGIN}/episode/${episode.id}`, description: episode.fullDescription || episode.description || DESCRIPTION,
    datePublished: episode.createdAt, dateModified: episode.updatedAt || episode.createdAt,
    image: episode.coverImage || `${ORIGIN}/api/og-image/${episode.id}`,
    ...(episode.audioUrl ? { associatedMedia: { '@type': 'AudioObject', contentUrl: episode.audioUrl,
      ...(episode.duration !== null ? { duration: `PT${Math.round(episode.duration)}S` } : {}) } } : {})
  }).replace(/</g, '\\u003c');
}
