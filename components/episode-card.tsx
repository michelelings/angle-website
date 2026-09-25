import { ArtworkImage } from './artwork-image';
import { progressiveArtworkProps } from '@/lib/artwork';
import Link from 'next/link';
import { type Episode, formatDate, formatMinutes } from '@/lib/episodes';
import { categoryLabel } from '@/lib/catalog-copy';
export function EpisodeCard({ episode, gallery = false, priority = false }: { episode: Episode; gallery?: boolean; priority?: boolean }) {
  return <article className={gallery ? 'episode-card' : 'rail-card'}>
    <Link className="rail-card-link" href={`/episode/${encodeURIComponent(episode.id)}`} scroll={false} prefetch={false} aria-label={episode.title}>
      <ArtworkImage className="ready" cornerShade={gallery} {...progressiveArtworkProps(episode)} alt="" width="300" height="400"
        loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'}>
        {gallery && episode.category && <span className="episode-category artwork-category">{categoryLabel(episode.category)}</span>}
      </ArtworkImage>
    <div className={gallery ? 'episode-info' : 'rail-card-info'}>{!gallery && <span className="rail-card-category">{episode.category && categoryLabel(episode.category)}</span>}
      <h3 className={gallery ? 'episode-title' : 'rail-card-title'}>{episode.title}</h3>
      {episode.hookLine && <p className="episode-description">{episode.hookLine}</p>}
      <div className={gallery ? 'episode-footer' : 'rail-card-meta'}>{episode.duration !== null && <span>{formatMinutes(episode.duration)}</span>}<span>{formatDate(episode.createdAt)}</span></div>
    </div>
    </Link>
  </article>;
}
