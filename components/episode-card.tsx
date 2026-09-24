'use client';
import Link from 'next/link';
import { type Episode, formatDate, formatTime } from '@/lib/episodes';
export function EpisodeCard({ episode }: { episode: Episode }) {
  return <article className="rail-card">
    <Link href={`/episode/${episode.id}`} scroll={false} prefetch={false} aria-label={episode.title}>
      <img src={episode.coverImage || '/images/icon.webp'} alt="" width="300" height="300" loading="lazy" decoding="async"
        onError={e => { e.currentTarget.onerror = null; if (!e.currentTarget.src.endsWith('/images/icon.webp')) e.currentTarget.src = '/images/icon.webp'; }} />
    </Link>
    <div className="rail-card-info"><span className="rail-card-category">{episode.category}</span>
      <h3 className="rail-card-title"><Link className="text-ink no-underline" href={`/episode/${episode.id}`} scroll={false} prefetch={false}>{episode.title}</Link></h3>
      <p className="episode-description">{episode.description}</p>
      <div className="rail-card-meta"><span>{formatTime(episode.duration)}</span><span>{formatDate(episode.createdAt)}</span></div>
    </div>
  </article>;
}
