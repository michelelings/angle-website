'use client';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { extractArtworkPalette } from '@/lib/artwork-palette';
import { AudioPlayer } from './audio-player';
import { GetAngleLink } from './get-angle-link';
import { ShareButton } from './share-button';

export function EpisodeExperience({ id, artwork, title, audioUrl, children }: {
  id: string; artwork: string; title: string; audioUrl: string | null; children: ReactNode;
}) {
  const image = useRef<HTMLImageElement>(null);
  const [palette, setPalette] = useState<{ source: string; colors: string[] } | null>(null);
  useEffect(() => {
    const element = image.current!;
    let cancelled = false;
    async function extract() {
      try {
        const colors = await extractArtworkPalette(element);
        if (!cancelled && colors) setPalette({ source: artwork, colors });
      } catch { /* A blocked or unavailable image keeps the readable fallback mesh. */ }
    }
    if (element.complete && element.naturalWidth) void extract();
    element.addEventListener('load', extract);
    return () => { cancelled = true; element.removeEventListener('load', extract); };
  }, [artwork]);
  const colors = palette?.source === artwork ? palette.colors : [];
  const style = Object.fromEntries(colors.map((color, i) => [`--mesh-${i + 1}`, color])) as CSSProperties;
  return <div className="episode-view" style={style}>
    <div className="artwork-mesh" aria-hidden="true" />
    <section className="episode-media" aria-label="Artwork and audio player">
      <img ref={image} className="modal-image" src={artwork} crossOrigin="anonymous" alt={title} width="600" height="800"
        onError={event => { if (!event.currentTarget.src.endsWith('/images/icon.webp')) event.currentTarget.src = '/images/icon.webp'; }} />
      {audioUrl && <AudioPlayer key={audioUrl} src={audioUrl} />}
      <div className="episode-actions"><GetAngleLink location="modal" /><ShareButton id={id} /></div>
    </section>
    <div className="episode-reading">{children}</div>
  </div>;
}
