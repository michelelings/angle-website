import { categorySlug } from './episodes';

export function categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    all: 'All stories', new: 'Latest stories', popular: 'Most listened',
    'greenland-security-announcement-status-decision-channels-and-local-stakes': 'Greenland security',
    'sanctions-and-aviation': 'Sanctions and aviation',
  };
  return labels[categorySlug(category)] || category.replace(/-/g, ' ').replace(/^./, letter => letter.toUpperCase());
}

export function catalogCopy(category: string) {
  if (category === 'all' || category === 'new') return {
    heading: 'Audio stories and news explainers',
    description: 'Listen to stories about technology and world events. Explore audio episodes, read transcripts, and discover Angle.',
  };
  if (category === 'popular') return {
    heading: 'Most-listened audio stories',
    description: 'Explore Angle stories ranked by their recorded listen counts. Listen to an episode or read its transcript.',
  };
  return { heading: `${categoryLabel(category)} audio stories`,
    description: `Explore ${categoryLabel(category).toLowerCase()} through audio stories, episode summaries, and transcripts.` };
}
