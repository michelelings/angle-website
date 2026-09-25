import { ORIGIN } from './site';
export function trackEvent(name: string, properties: Record<string, string | number> = {}, episodeId?: string) {
  if (typeof window === 'undefined') return;
  const analytics = window as Window & { gtag?: (...args: unknown[]) => void };
  analytics.gtag?.('event', name, { ...properties, ...(episodeId ? {
    episode_id: episodeId, page_location: `${ORIGIN}/episode/${encodeURIComponent(episodeId)}`,
  } : {}) });
}
