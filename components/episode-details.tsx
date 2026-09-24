import { type Episode, formatDate, formatTime } from '@/lib/episodes';
import { AudioPlayer } from './audio-player';
import { ShareButton } from './share-button';
export function EpisodeDetails({ episode, modal = false }: { episode: Episode; modal?: boolean }) {
  const Title = modal ? 'h2' : 'h1';
  return <>
    <img className="modal-image" src={episode.coverImage || '/images/icon.webp'} alt={episode.title} width="600" height="600" />
    <div className="modal-body">
      {episode.category && <span className="modal-category">{episode.category}</span>}
      <Title className="modal-title" id="story-title">{episode.title}</Title>
      <div className="modal-meta">
        {episode.duration !== null && <span className="modal-meta-item">{formatTime(episode.duration)}</span>}
        {episode.host && <span className="modal-meta-item">{episode.host}</span>}
        {episode.episodeNumber !== null && <span className="modal-meta-item">Episode {episode.episodeNumber}</span>}
      </div>
      <p className="modal-description">{episode.fullDescription || episode.description}</p>
      {episode.tags?.length ? <div className="modal-tags">{episode.tags.map(tag => <span className="modal-tag" key={tag}>{tag}</span>)}</div> : null}
      {episode.audioUrl && <AudioPlayer key={episode.audioUrl} src={episode.audioUrl} />}
      {episode.transcript && <details className="transcript"><summary>Read the transcript</summary>{episode.transcript}</details>}
      <p className="modal-date">{formatDate(episode.createdAt)}</p>
      <ShareButton id={episode.id} />
    </div>
  </>;
}
