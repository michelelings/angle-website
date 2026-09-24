import { notFound } from 'next/navigation';
import { getEpisode } from '@/lib/server/catalog';
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
  return <main className="episode-shell"><div className="modal-header"><Link className="modal-close" href="/" aria-label="Back to stories">×</Link></div>
    <article><EpisodeDetails episode={episode} /></article>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: episodeJsonLd(episode) }} />
  </main>;
}
