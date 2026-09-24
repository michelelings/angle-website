'use client';
import Link from 'next/link';
import { type Episode, formatDate, formatTime } from '@/lib/episodes';
export function EpisodeCard({ episode }: { episode: Episode }) {
  return <article className="rail-card">
    <Link className="rail-card-link" href={`/episode/${encodeURIComponent(episode.id)}`} scroll={false} prefetch={false} aria-label={episode.title}>
      <img src={episode.coverImage || '/images/icon.webp'} alt="" width="300" height="400" loading="lazy" decoding="async"
        onError={e => { e.currentTarget.onerror = null; if (!e.currentTarget.src.endsWith('/images/icon.webp')) e.currentTarget.src = '/images/icon.webp'; }} />
    <div className="rail-card-info"><span className="rail-card-category">{episode.category}</span>
      <h3 className="rail-card-title">{episode.title}</h3>
      <p className="episode-description">{episode.description}</p>
      <div className="rail-card-meta"><span>{formatTime(episode.duration)}</span><span>{formatDate(episode.createdAt)}</span></div>
    </div>
    </Link>
  </article>;
}
