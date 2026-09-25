'use client';
import Link from 'next/link';
import { type Episode, formatDate, formatTime } from '@/lib/episodes';
import { categoryLabel } from '@/lib/catalog-copy';
export function EpisodeCard({ episode, gallery = false }: { episode: Episode; gallery?: boolean }) {
  return <article className={gallery ? 'episode-card' : 'rail-card'}>
    <Link className="rail-card-link" href={`/episode/${encodeURIComponent(episode.id)}`} scroll={false} prefetch={false} aria-label={episode.title}>
      <img className="ready" src={episode.coverImage || '/images/icon.webp'} alt="" width="300" height="400" loading="lazy" decoding="async"
        onError={e => { e.currentTarget.onerror = null; if (!e.currentTarget.src.endsWith('/images/icon.webp')) e.currentTarget.src = '/images/icon.webp'; }} />
    <div className={gallery ? 'episode-info' : 'rail-card-info'}><span className={gallery ? 'episode-category' : 'rail-card-category'}>{episode.category && categoryLabel(episode.category)}</span>
      <h3 className={gallery ? 'episode-title' : 'rail-card-title'}>{episode.title}</h3>
      <p className="episode-description">{episode.description}</p>
      <div className={gallery ? 'episode-footer' : 'rail-card-meta'}><span>{formatTime(episode.duration)}</span><span>{formatDate(episode.createdAt)}</span></div>
    </div>
    </Link>
  </article>;
}
