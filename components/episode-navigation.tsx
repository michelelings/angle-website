'use client';
import { episodeHeadline } from '@/lib/episode-headlines';

import { createContext, useCallback, useContext, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { PrefetchKind } from 'next/dist/client/components/router-reducer/router-reducer-types';
import { type Episode, formatDate, formatMinutes } from '@/lib/episodes';
import { progressiveArtworkProps } from '@/lib/artwork';
import { categoryLabel } from '@/lib/catalog-copy';
import { ArtworkImage } from './artwork-image';
import { EpisodeTitle } from './episode-title';
import { StoryDialog } from './story-dialog';

const Navigation = createContext<{ open: (episode: Episode) => void; prefetch: (episode: Episode) => void } | null>(null);
export const useEpisodeNavigation = () => useContext(Navigation);

export function EpisodeNavigation({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, setPending] = useState<{ episode: Episode; origin: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const prefetched = useRef(new Map<string, number>());
  const prefetch = useCallback((episode: Episode) => {
    const href = `/episode/${encodeURIComponent(episode.id)}`;
    const now = Date.now();
    if ((prefetched.current.get(href) ?? 0) > now) return;
    for (const [key, expires] of prefetched.current) if (expires <= now) prefetched.current.delete(key);
    if (prefetched.current.size >= 24) prefetched.current.delete(prefetched.current.keys().next().value!);
    prefetched.current.set(href, now + 30_000);
    router.prefetch(href, { kind: PrefetchKind.FULL, onInvalidate: () => { prefetched.current.delete(href); } });
  }, [router]);
  const open = useCallback((episode: Episode) => {
    setPending({ episode, origin: window.location.pathname + window.location.search });
    startTransition(() => router.push(`/episode/${encodeURIComponent(episode.id)}`, { scroll: false }));
  }, [router]);
  const value = useMemo(() => ({ open, prefetch }), [open, prefetch]);
  return <Navigation.Provider value={value}>{children}
    {isPending && pending && <StoryDialog title={episodeHeadline(pending.episode)} onClose={() => {
      const origin = pending.origin;
      setPending(null);
      // Supersede the in-flight navigation so a late response cannot reopen it.
      startTransition(() => router.replace(origin, { scroll: false }));
    }}><EpisodePreview episode={pending.episode} /></StoryDialog>}
  </Navigation.Provider>;
}

function EpisodePreview({ episode }: { episode: Episode }) {
  return <div className="episode-view" aria-busy="true" data-episode-preview={episode.id}>
    <div className="artwork-mesh" aria-hidden="true" />
    <section className="episode-media" aria-label="Artwork">
      <div className="episode-media-card">
        <ArtworkImage className="modal-image" cornerShade {...progressiveArtworkProps(episode)} alt={episode.title} width="600" height="800" fetchPriority="high" />
        {episode.category && <div className="episode-breadcrumb">{categoryLabel(episode.category)}</div>}
      </div>
    </section>
    <div className="episode-reading"><div className="modal-body">
      <EpisodeTitle title={episodeHeadline(episode)} modal />
      {episode.hookLine && <p className="story-hook">{episode.hookLine}</p>}
      <div className="modal-meta">
        {episode.duration !== null && <span className="modal-meta-item">{formatMinutes(episode.duration)}</span>}
        <time className="modal-meta-item" dateTime={episode.createdAt}>{formatDate(episode.createdAt)}</time>
      </div>
      <p className="modal-description" role="status">Loading story…</p>
    </div></div>
  </div>;
}
