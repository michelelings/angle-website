import { notFound } from 'next/navigation';
import { getEpisode } from '@/lib/server/catalog';
import { episodeMetadata, episodeJsonLd } from '@/lib/metadata';
import { EpisodeDetails } from '@/components/episode-details';
import { Header } from '@/components/header';
import { SiteFooter } from '@/components/site-footer';
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
  return <main><Header /><article className="modal-content episode-page"><EpisodeDetails episode={episode} /></article>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: episodeJsonLd(episode) }} />
    <SiteFooter showStream />
  </main>;
}
