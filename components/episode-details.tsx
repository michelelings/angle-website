import { type Episode, formatDate, formatTime } from '@/lib/episodes';
import { EpisodeExperience } from './episode-experience';
export function EpisodeDetails({ episode, modal = false }: { episode: Episode; modal?: boolean }) {
  const Title = modal ? 'h2' : 'h1';
  return <EpisodeExperience id={episode.id} artwork={episode.coverImage || '/images/icon.webp'} title={episode.title} audioUrl={episode.audioUrl}>
    <div className="modal-body">
      {episode.category && <span className="modal-category">{episode.category}</span>}
      <Title className="modal-title" id="story-title">{episode.title}</Title>
      <div className="modal-meta">
        {episode.duration !== null && <span className="modal-meta-item">{formatTime(episode.duration)}</span>}
        {episode.host && <span className="modal-meta-item">{episode.host}</span>}
        <time className="modal-meta-item" dateTime={episode.createdAt}>{formatDate(episode.createdAt)}</time>
        {episode.episodeNumber !== null && <span className="modal-meta-item">Episode {episode.episodeNumber}</span>}
      </div>
      <p className="modal-description">{episode.fullDescription || episode.description}</p>
      {episode.tags?.length ? <div className="modal-tags">{episode.tags.map(tag => <span className="modal-tag" key={tag}>{tag}</span>)}</div> : null}
    </div>
  </EpisodeExperience>;
}
