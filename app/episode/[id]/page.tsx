import { notFound } from 'next/navigation';
import { getEpisode, getCatalog } from '@/lib/server/catalog';
import { episodeMetadata, episodeJsonLd } from '@/lib/metadata';
import { EpisodeDetails } from '@/components/episode-details';
import Link from 'next/link';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props) {
  const episode = await getEpisode((await params).id);
  if (!episode) notFound();
  return episodeMetadata(episode);
}
export default async function Episode({ params }: Props) {
  const episode = await getEpisode((await params).id);
  if (!episode) notFound();
  const related = (await getCatalog()).filter(other => other.id !== episode.id &&
    ((episode.category && other.category === episode.category) || other.topicNames?.some(topic => episode.topicNames?.includes(topic)))).slice(0, 3);
  return <main className="episode-shell"><div className="modal-header"><Link className="modal-close" href="/" aria-label="Back to stories">×</Link></div><article><EpisodeDetails episode={episode} related={related} /></article>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: episodeJsonLd(episode) }} />
  </main>;
}
