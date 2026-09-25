import { artworkVariantUrl, progressiveArtworkProps } from '@/lib/artwork';
import { ArtworkImage } from './artwork-image';
import Link from 'next/link';
import { type Episode, formatDate, formatMinutes } from '@/lib/episodes';
import { EpisodeExperience } from './episode-experience';
import { categoryLabel } from '@/lib/catalog-copy';
import { GetAngleLink } from './get-angle-link';
import { ShareButton } from './share-button';
import { EpisodeTitle } from './episode-title';
import { storyEventDate, storyEventStatus } from '@/lib/episode-story';
import { HearStoryMoment } from './episode-playback';
import { StoryPlaces } from './story-places';
export function EpisodeDetails({ episode, modal = false, related = [] }: { episode: Episode; modal?: boolean; related?: Episode[] }) {
  return <EpisodeExperience id={episode.id} artwork={episode.coverImage || '/images/icon.webp'} artworkSources={progressiveArtworkProps(episode)} title={episode.title} audioUrl={episode.audioUrl}
    artworkHeader={<nav className="episode-breadcrumb" aria-label="Breadcrumb"><Link href="/" className="episode-breadcrumb-home" aria-label="Angle home"><img src="/images/logo.svg" alt="" width="32" height="32" /></Link>
        {episode.category && <span>{categoryLabel(episode.category)}</span>}
      </nav>}>
    <div className="modal-body">
      <EpisodeTitle title={episode.title} modal={modal} />
      {episode.story?.hookLine && <p className="story-hook">{episode.story.hookLine}</p>}
      <div className="modal-meta">
        {episode.duration !== null && <span className="modal-meta-item">{formatMinutes(episode.duration)}</span>}
        <time className="modal-meta-item" dateTime={episode.createdAt}>{formatDate(episode.createdAt)}</time>
        {episode.story?.format === 'evergreen' && <span className="story-label">Explainer</span>}
        {episode.episodeNumber !== null && <span className="modal-meta-item">Episode {episode.episodeNumber}</span>}
        <div className="episode-actions"><GetAngleLink location="modal" episodeId={episode.id} /><ShareButton id={episode.id} /></div>
      </div>
      <section className="story-overview" aria-label="Overview">
      <p className="modal-description">{episode.story?.summary || episode.fullDescription || episode.description}</p>
      {episode.story?.whyItMatters && <div className="story-importance"><h2>Why it matters</h2><p className="modal-description">{episode.story.whyItMatters}</p></div>}
      {episode.transcript && <details className="transcript"><summary>Read full transcript</summary>
        {episode.chapters?.length ? episode.chapters.map((chapter, index) => <section key={index}>
          <h2>{chapter.title}</h2>{chapter.turns.map((turn, i) => <p key={i}>{turn.speaker && <strong>{turn.speaker}: </strong>}{turn.text}</p>)}
        </section>) : episode.transcript}
      </details>}
      </section>
      {!!episode.story?.events.length && <section className="story-section"><h2>Timeline</h2>
        <ol className="story-timeline">{episode.story.events.map(event => <li key={event.id}>
          <div className="story-event-copy">
            <div className="story-event-meta"><span>{storyEventDate(event)}</span>{storyEventStatus(event.status) && <span className="story-label">{storyEventStatus(event.status)}</span>}</div>
            <h3>{episode.audioUrl && event.startTime !== null ? <HearStoryMoment seconds={event.startTime} title={event.title} /> : event.title}</h3>{event.summary && <p>{event.summary}</p>}
          </div>
        </li>)}</ol>
      </section>}
      {!!episode.story?.places.length && <StoryPlaces places={episode.story.places} />}
      {episode.tags?.length ? <div className="modal-tags">{episode.tags.map(tag => <span className="modal-tag" key={tag}>{tag}</span>)}</div> : null}
      {!!episode.sources?.length && <section className="episode-sources"><h2>Sources</h2>
        <ul>{episode.sources.map(source => <li key={source.url}><a href={source.url} rel="noopener noreferrer">{source.title}</a>
          {source.publisher && <span> — {source.publisher}</span>}</li>)}</ul>
      </section>}
      <p className="modal-date">Published <time dateTime={episode.createdAt}>{formatDate(episode.createdAt)}</time>
        {episode.updatedAt && Date.parse(episode.updatedAt) > Date.parse(episode.createdAt) && <> · Updated <time dateTime={episode.updatedAt}>{formatDate(episode.updatedAt)}</time></>}
        {episode.asOf && <> · Reporting as of <time dateTime={episode.asOf}>{formatDate(episode.asOf)}</time></>}
      </p>
      {!!related.length && <section className="story-section episode-related"><h2>Related stories</h2>
        <ul className="related-story-grid">{related.map(other => <li key={other.id}>
          <Link href={`/episode/${other.id}`} className="related-story-card">
            <ArtworkImage className="related-story-artwork" src={artworkVariantUrl(other, 'small')} fullSrc={artworkVariantUrl(other, 'small')} alt="" width="60" height="80" loading="lazy" />
            <span className="related-story-title">{other.title}</span>
          </Link>
        </li>)}</ul>
      </section>}
      <p className="editorial-link"><Link href="/about">About Angle and feedback</Link></p>
    </div>
  </EpisodeExperience>;
}
