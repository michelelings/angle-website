import { notFound } from 'next/navigation';
import { getEpisode } from '@/lib/server/catalog';
import { EpisodeDetails } from '@/components/episode-details';
import { StoryDialog } from '@/components/story-dialog';
import { episodeMetadata } from '@/lib/metadata';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props) {
  const episode = await getEpisode((await params).id);
  if (!episode) notFound();
  return episodeMetadata(episode);
}
export default async function EpisodeModal({ params }: Props) {
  const episode = await getEpisode((await params).id);
  if (!episode) notFound();
  return <StoryDialog title={episode.title}><EpisodeDetails episode={episode} modal /></StoryDialog>;
}
