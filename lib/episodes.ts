import type { Episode } from '../worker/catalog';
export type { Episode } from '../worker/catalog';
export { categorySlug, categoriesFor, resolveCategory } from '../worker/catalog';
export function filterEpisodes(episodes: Episode[], filter: string): Episode[] {
  if (filter === 'all') return episodes;
  const sorted = [...episodes].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  if (filter === 'new') return sorted;
  if (filter === 'popular') return sorted.filter(e => (e.listenCount || 0) > 0)
    .sort((a, b) => (b.listenCount || 0) - (a.listenCount || 0));
  return episodes.filter(episode => episode.category === filter);
}
export function formatTime(seconds: number | null): string {
  if (!seconds || !Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total % 3600 / 60);
  return `${hours ? `${hours}:${String(minutes).padStart(2, '0')}` : minutes}:${String(total % 60).padStart(2, '0')}`;
}
export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}
export type Renditions = Record<string, { sources: { url: string; width: number }[] }>;

export function formatMinutes(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '';
  const minutes = Math.floor(seconds / 60);
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}
