'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Episode, Renditions } from '@/lib/episodes';
import { ContinuousGallery } from '@/lib/gallery/continuous-gallery.js';
import { createGalleryCard } from '@/lib/gallery/card';
import { shareEpisode } from './share-button';
import { ORIGIN } from '@/lib/site';
import { useArtworkTheme } from './artwork-theme';
import { EpisodeCard } from './episode-card';
export function Gallery({ episodes, paused = false }: { episodes: Episode[]; paused?: boolean }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('');
  const [ready, setReady] = useState(false);
  const fallback = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const updateTheme = useArtworkTheme();
  const instance = useRef<ContinuousGallery | undefined>(undefined);
  const latest = useRef({ episodes, paused });
  latest.current = { episodes, paused };
  useEffect(() => {
    instance.current?.setItems(episodes);
    instance.current?.pause('search', paused);
  }, [episodes, paused]);
  useEffect(() => {
    let disposed = false;
    let gallery: ContinuousGallery | undefined;
    const abort = new AbortController();
    async function initialize() {
      let renditions: Renditions = {};
      try {
        const response = await fetch('/images/cover-renditions.json', { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(1500)]) });
        if (response.ok) renditions = await response.json();
      } catch { /* Original artwork remains available. */ }
      if (disposed || !wrapper.current) return;
      gallery = new ContinuousGallery(wrapper.current, episode => createGalleryCard(episode, renditions),
        episode => router.push(`/episode/${encodeURIComponent(episode.id)}`, { scroll: false }),
        async episode => {
          try { setStatus(await shareEpisode(episode.id)); } catch (error) {
            if (!(error instanceof Error && error.name === 'AbortError')) setStatus(`Copy this link: ${ORIGIN}/episode/${episode.id}`);
          }
        }, (_episode, image) => updateTheme(image));
      instance.current = gallery;
      gallery.setItems(latest.current.episodes);
      gallery.pause('search', latest.current.paused);
      gallery.pause('modal', !!document.querySelector('dialog[open]'));
      // Keep the accessible fallback if it currently owns keyboard focus.
      if (!fallback.current?.contains(document.activeElement)) setReady(true);
    }
    const pause = (event: Event) => gallery?.pause('modal', (event as CustomEvent<boolean>).detail);
    window.addEventListener('angle:dialog', pause);
    void initialize();
    return () => { disposed = true; abort.abort(); gallery?.destroy(); instance.current = undefined; updateTheme(null); window.removeEventListener('angle:dialog', pause); };
  }, [router, updateTheme]);
  return <><div ref={fallback} className="gallery-wrapper catalog-fallback" hidden={ready}><div className="collection-grid">
      {episodes.map(episode => <EpisodeCard key={episode.id} episode={episode} gallery />)}
    </div></div>
    <div ref={wrapper} className={`gallery-wrapper${ready ? '' : ' gallery-pending'}`} aria-hidden={!ready} inert={!ready}><div className="collection-grid" /></div>
    <p className="text-center text-sm text-secondary px-5 break-all" role="status">{status}</p>
  </>;
}
