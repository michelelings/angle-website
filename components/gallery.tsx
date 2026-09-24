'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Episode, Renditions } from '@/lib/episodes';
import { ContinuousGallery } from '@/lib/gallery/continuous-gallery.js';
import { createGalleryCard } from '@/lib/gallery/card';
import { shareEpisode } from './share-button';
import { ORIGIN } from '@/lib/site';
export function Gallery({ episodes }: { episodes: Episode[] }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('');
  const router = useRouter();
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
        });
      gallery.setItems(episodes);
      gallery.pause('modal', !!document.querySelector('dialog[open]'));
    }
    const pause = (event: Event) => gallery?.pause('modal', (event as CustomEvent<boolean>).detail);
    window.addEventListener('angle:dialog', pause);
    void initialize();
    return () => { disposed = true; abort.abort(); gallery?.destroy(); window.removeEventListener('angle:dialog', pause); };
  }, [episodes, router]);
  return <><div ref={wrapper} className="gallery-wrapper"><div className="collection-grid" /></div>
    <p className="text-center text-sm text-secondary px-5 break-all" role="status">{status}</p>
    <noscript><div className="p-6 flex flex-wrap gap-4">{episodes.map(episode => <a key={episode.id} href={`/episode/${episode.id}`}>{episode.title}</a>)}</div></noscript>
  </>;
}
