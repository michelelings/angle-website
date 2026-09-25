import { progressiveArtworkProps } from '@/lib/artwork';
import Link from 'next/link';
import { type Episode, formatDate, formatMinutes } from '@/lib/episodes';
import { EpisodeExperience } from './episode-experience';
import { categoryLabel } from '@/lib/catalog-copy';
import { GetAngleLink } from './get-angle-link';
import { ShareButton } from './share-button';
import { EpisodeTitle } from './episode-title';
export function EpisodeDetails({ episode, modal = false, related = [] }: { episode: Episode; modal?: boolean; related?: Episode[] }) {
  return <EpisodeExperience id={episode.id} artwork={episode.coverImage || '/images/icon.webp'} artworkSources={progressiveArtworkProps(episode)} title={episode.title} audioUrl={episode.audioUrl}>
    <div className="modal-body">
      <nav className="episode-breadcrumb" aria-label="Breadcrumb"><Link href="/" className="episode-breadcrumb-home" aria-label="Angle home"><img src="/images/logo.svg" alt="" width="32" height="32" /></Link>
        {episode.category && <span>{categoryLabel(episode.category)}</span>}
      </nav>
      <EpisodeTitle title={episode.title} modal={modal} />
      <div className="modal-meta">
        {episode.duration !== null && <span className="modal-meta-item">{formatMinutes(episode.duration)}</span>}
        <time className="modal-meta-item" dateTime={episode.createdAt}>{formatDate(episode.createdAt)}</time>
        {episode.episodeNumber !== null && <span className="modal-meta-item">Episode {episode.episodeNumber}</span>}
        <div className="episode-actions"><GetAngleLink location="modal" episodeId={episode.id} /><ShareButton id={episode.id} /></div>
      </div>
      <p className="modal-description">{episode.fullDescription || episode.description}</p>
      {episode.tags?.length ? <div className="modal-tags">{episode.tags.map(tag => <span className="modal-tag" key={tag}>{tag}</span>)}</div> : null}
      {episode.transcript && <details className="transcript"><summary>Read the transcript</summary>
        {episode.chapters?.length ? episode.chapters.map((chapter, index) => <section key={index}>
          <h2>{chapter.title}</h2>{chapter.turns.map((turn, i) => <p key={i}>{turn.speaker && <strong>{turn.speaker}: </strong>}{turn.text}</p>)}
        </section>) : episode.transcript}
      </details>}
      {!!episode.sources?.length && <section className="episode-sources"><h2>Sources</h2>
        <ul>{episode.sources.map(source => <li key={source.url}><a href={source.url} rel="noopener noreferrer">{source.title}</a>
          {source.publisher && <span> — {source.publisher}</span>}</li>)}</ul>
      </section>}
      <p className="modal-date">Published <time dateTime={episode.createdAt}>{formatDate(episode.createdAt)}</time>
        {episode.updatedAt && Date.parse(episode.updatedAt) > Date.parse(episode.createdAt) && <> · Updated <time dateTime={episode.updatedAt}>{formatDate(episode.updatedAt)}</time></>}
        {episode.asOf && <> · Reporting as of <time dateTime={episode.asOf}>{formatDate(episode.asOf)}</time></>}
      </p>
      <p className="editorial-link"><Link href="/about">About Angle and feedback</Link></p>
      {!!related.length && <section className="episode-sources"><h2>Related stories</h2><ul>{related.map(other =>
        <li key={other.id}><Link href={`/episode/${other.id}`}>{other.title}</Link></li>)}</ul></section>}
    </div>
  </EpisodeExperience>;
}
