import { ArtworkImage } from './artwork-image';
import { artworkProps } from '@/lib/artwork';
import Link from 'next/link';
import { type Episode, formatDate, formatTime } from '@/lib/episodes';
import { categoryLabel } from '@/lib/catalog-copy';
export function EpisodeCard({ episode, gallery = false, priority = false }: { episode: Episode; gallery?: boolean; priority?: boolean }) {
  return <article className={gallery ? 'episode-card' : 'rail-card'}>
    <Link className="rail-card-link" href={`/episode/${encodeURIComponent(episode.id)}`} scroll={false} prefetch={false} aria-label={episode.title}>
      <ArtworkImage className="ready" {...artworkProps(episode)} original={episode.coverImage} alt="" width="300" height="400"
        loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} />
    <div className={gallery ? 'episode-info' : 'rail-card-info'}><span className={gallery ? 'episode-category' : 'rail-card-category'}>{episode.category && categoryLabel(episode.category)}</span>
      <h3 className={gallery ? 'episode-title' : 'rail-card-title'}>{episode.title}</h3>
      <p className="episode-description">{episode.description}</p>
      <div className={gallery ? 'episode-footer' : 'rail-card-meta'}><span>{formatTime(episode.duration)}</span><span>{formatDate(episode.createdAt)}</span></div>
    </div>
    </Link>
  </article>;
}
