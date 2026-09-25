import { notFound } from 'next/navigation';
import { getSubjectHub } from '@/lib/server/catalog';
import { subjectMetadata } from '@/lib/metadata';
import { subjectKindLabel, type SubjectProfile } from '@/lib/subject-hub';
import { formatDate } from '@/lib/episodes';
import { Header } from '@/components/header';
import { SiteFooter } from '@/components/site-footer';
import { EpisodeCard } from '@/components/episode-card';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props) {
  const hub = await getSubjectHub((await params).id);
  if (!hub) notFound();
  return subjectMetadata(hub);
}
export default async function Subject({ params }: Props) {
  const hub = await getSubjectHub((await params).id);
  if (!hub) notFound();
  return <main><Header /><article className="subject-page">
    <p className="subject-kind">{subjectKindLabel(hub.kind)}</p>
    <h1>{hub.name}</h1>
    {hub.description && <p className="subject-description">{hub.description}</p>}
    <section aria-labelledby="subject-stories">
      <h2 id="subject-stories">Stories on Angle</h2>
      {hub.episodes.length
        ? <ul className="subject-story-grid">{hub.episodes.map(episode => <li key={episode.id}><EpisodeCard episode={episode} /></li>)}</ul>
        : <p>No published stories are available right now.</p>}
    </section>
    {hub.profile && <SubjectBackground profile={hub.profile} />}
  </article><SiteFooter /></main>;
}

const paragraphs = (text: string) => text.split(/\n{2,}/).map(paragraph => paragraph.trim()).filter(Boolean);
function SubjectBackground({ profile }: { profile: SubjectProfile }) {
  const { wikipedia, wikidata } = profile;
  return <section className="subject-background" aria-labelledby="subject-background">
    <h2 id="subject-background">Background</h2>
    <p className="subject-note">Selected excerpts from Wikipedia. This is general background, not Angle&apos;s reporting, and it may have changed since the stories above were published.</p>
    {paragraphs(profile.summary).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    {profile.sections.map(section => <details key={section.id} className="subject-excerpt">
      <summary>{section.title}</summary>
      {paragraphs(section.text).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    </details>)}
    <p className="subject-attribution">
      From the Wikipedia article <a href={wikipedia.url} rel="noopener noreferrer">{wikipedia.title || profile.name}</a>
      {wikipedia.revisionAt && <> (revision of <time dateTime={wikipedia.revisionAt}>{formatDate(wikipedia.revisionAt)}</time>)</>}.{' '}
      {wikipedia.attribution} Available under <a href={wikipedia.licenseUrl} rel="license noopener noreferrer">{wikipedia.licenseName}</a>.
      {wikidata && <> Identity from <a href={wikidata.url} rel="noopener noreferrer">Wikidata</a> (<a href={wikidata.licenseUrl} rel="license noopener noreferrer">{wikidata.licenseName}</a>).</>}
    </p>
  </section>;
}
