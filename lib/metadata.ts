import type { Metadata } from 'next';
import { ORIGIN, DESCRIPTION } from './site';
import type { Episode } from './episodes';
import { subjectPath, type SubjectHub } from './subject-hub';
export function pageMetadata(path = '/', title = 'Angle — Audio Stories and News Explainers', description = DESCRIPTION, image = '/api/og-image'): Metadata {
  const socialImage = `${ORIGIN}${image}?v=artwork-3`;
  return { title, description, robots: { index: true, follow: true }, alternates: { canonical: ORIGIN + path },
    openGraph: { title, description, url: ORIGIN + path, type: 'website', images: [{ url: socialImage, width: 1200, height: 630, type: 'image/png', alt: title }] },
    twitter: { card: 'summary_large_image', title, description, images: [socialImage] } };
}
export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export function searchMetadata(meta: Metadata, params: Record<string, string | string[] | undefined>): Metadata {
  if (!params.q && !params.topic) return meta;
  // Search results are not equivalent to the unfiltered collection.
  return { ...meta, robots: { index: false, follow: true }, alternates: undefined };
}
export function episodeDescription(episode: Episode): string {
  const text = (episode.description || episode.fullDescription || DESCRIPTION).replace(/\s+/g, ' ').trim();
  if (text.length <= 200) return text;
  // Do not extract a claim while dropping qualifications from later sentences.
  return `Listen to “${episode.title}” on Angle. Read the episode summary, transcript, and available sources.`;
}
export function episodeMetadata(episode: Episode): Metadata {
  const meta = pageMetadata(`/episode/${episode.id}`, `${episode.title} | Angle`, episodeDescription(episode), `/api/og-image/${episode.id}`);
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
export function subjectMetadata(hub: SubjectHub): Metadata {
  const description = hub.description && hub.description.length <= 200 ? hub.description
    : `Listen to Angle audio stories featuring ${hub.name}, with transcripts, timelines and sources.`;
  // A resolved profile is the subject's cross-episode identity; taxonomy IDs can differ per episode.
  const meta = pageMetadata(subjectPath(hub.profile?.id ?? hub.id), `${hub.name} | Angle`, description);
  // An ambiguous hub mixes stories that may be about different people or things.
  return hub.profileStatus === 'ambiguous' || !hub.episodes.length ? { ...meta, robots: { index: false, follow: true } } : meta;
}
export function episodeJsonLd(episode: Episode): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@type': 'PodcastEpisode', name: episode.title,
    url: `${ORIGIN}/episode/${episode.id}`, description: episode.fullDescription || episode.description || DESCRIPTION,
    datePublished: episode.createdAt, dateModified: episode.updatedAt || episode.createdAt,
    publisher: { '@type': 'Organization', name: 'Angle', url: ORIGIN },
    ...(episode.sources?.length ? { citation: episode.sources.map(source => source.url) } : {}),
    image: episode.coverImage || `${ORIGIN}/api/og-image/${episode.id}`,
    ...(episode.audioUrl ? { associatedMedia: { '@type': 'AudioObject', contentUrl: episode.audioUrl,
      ...(episode.duration !== null ? { duration: `PT${Math.round(episode.duration)}S` } : {}) } } : {})
  }).replace(/</g, '\\u003c');
}
