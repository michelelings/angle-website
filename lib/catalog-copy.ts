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
  const introductions: Record<string, string> = {
    technology: 'Understand the systems behind the headlines: AI, cryptography, computing, and space exploration. Listen to a story or read its transcript and sources.',
    economy: 'Explore how work, money, and public policy shape everyday life, from cash trials to the costs of building. Read the evidence alongside each audio story.',
    science: 'Follow the questions behind scientific claims, with stories that connect research, uncertainty, and practical limits. Read along and explore the cited sources.',
    business: 'Explore the decisions behind companies and markets, from investment funds to technology businesses. Listen to the story and examine its sources.',
    health: 'Explore health research and public-health debates through audio stories, readable transcripts, and source links.',
    politics: 'Follow the people, institutions, and trade-offs behind political proposals. Explore each story’s timeline and sources alongside the audio.',
    security: 'Explore defense technology, oversight, and the rules governing their use. Read the context and source material behind each story.',
    sports: 'Understand the rules, finances, and disputes shaping sport, with audio stories and source material to read alongside them.',
    world: 'Explore international events through the decisions and constraints behind them. Follow the timelines and sources that connect each story.',
  };
  return { heading: `${categoryLabel(category)} audio stories`,
    description: introductions[categorySlug(category)] || `Explore ${categoryLabel(category).toLowerCase()} through audio stories, episode summaries, and transcripts.` };
}
