'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Episode } from '@/lib/episodes';
import { ContinuousGallery } from '@/lib/gallery/continuous-gallery.js';
import { createGalleryCard } from '@/lib/gallery/card';
import { useArtworkTheme } from './artwork-theme';
export function Gallery({ episodes, paused = false, children }: { episodes: Episode[]; paused?: boolean; children: ReactNode }) {
  const wrapper = useRef<HTMLDivElement>(null);
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
    let gallery: ContinuousGallery | undefined;
    function initialize() {
      if (!wrapper.current) return;
      gallery = new ContinuousGallery(wrapper.current, episode => createGalleryCard(episode),
        episode => router.push(`/episode/${encodeURIComponent(episode.id)}`, { scroll: false }),
        () => {}, (_episode, image) => updateTheme(image));
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
    return () => { gallery?.destroy(); instance.current = undefined; updateTheme(null); window.removeEventListener('angle:dialog', pause); };
  }, [router, updateTheme]);
  return <><div ref={fallback} className="gallery-wrapper catalog-fallback" hidden={ready}><div className="collection-grid">
      {children}
    </div></div>
    <div ref={wrapper} data-fit-height="true" className={`gallery-wrapper${ready ? '' : ' gallery-pending'}`} aria-hidden={!ready} inert={!ready}><div className="collection-grid" /></div>
  </>;
}
