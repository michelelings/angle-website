'use client';
import type { progressiveArtworkProps } from '@/lib/artwork';
import { ArtworkImage } from './artwork-image';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { EpisodePlaybackContext, type EpisodePlaybackHandle } from './episode-playback';
import { extractArtworkColors } from '@/lib/artwork-palette';
import { AudioPlayer } from './audio-player';

export function EpisodeExperience({ id, artwork, artworkSources, title, audioUrl, artworkHeader, children }: {
  id: string; artwork: string; artworkSources: ReturnType<typeof progressiveArtworkProps>; title: string; audioUrl: string | null; artworkHeader: ReactNode; children: ReactNode;
}) {
  const image = useRef<HTMLImageElement>(null);
  const playback = useRef<EpisodePlaybackHandle>(null);
  const playFrom = useCallback((seconds: number) => playback.current?.playFrom(seconds), []);
  const player = useRef<HTMLDivElement>(null);
  const [playerHeight, setPlayerHeight] = useState(92);
  useEffect(() => {
    const element = player.current;
    if (!element) return;
    const measure = () => setPlayerHeight(element.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [audioUrl]);
  const [palette, setPalette] = useState<{ source: string; colors: string[]; dominant: string; darkText: boolean } | null>(null);
  useEffect(() => {
    const element = image.current!;
    let cancelled = false;
    async function extract() {
      try {
        const colors = await extractArtworkColors(element);
        if (!cancelled && colors) setPalette({ source: artwork, colors: colors.palette, dominant: colors.dominant, darkText: colors.darkText });
      } catch { /* A blocked or unavailable image keeps the readable fallback mesh. */ }
    }
    if (element.complete && element.naturalWidth) void extract();
    element.addEventListener('load', extract);
    return () => { cancelled = true; element.removeEventListener('load', extract); };
  }, [artwork, artworkSources.src]);
  const colors = palette?.source === artwork ? palette.colors : [];
  const style = {
    ...Object.fromEntries(colors.map((color, i) => [`--mesh-${i + 1}`, color])),
    '--episode-player-height': `${audioUrl ? playerHeight : 0}px`,
  } as CSSProperties;
  const playerStyle = palette?.source === artwork ? {
    '--player-background': palette.dominant,
    '--player-ink': palette.darkText ? '#000' : '#fff',
    '--player-track': palette.darkText ? '#00000030' : '#ffffff35',
  } as CSSProperties : undefined;
  return <EpisodePlaybackContext.Provider value={playFrom}><div className="episode-view" style={style}>
    <div className="artwork-mesh" aria-hidden="true" />
    <section className="episode-media" aria-label="Artwork and audio player">
      <div className="episode-media-card">
        <ArtworkImage previewRef={image} cornerShade className="modal-image" {...artworkSources} fetchPriority="high" crossOrigin="anonymous" alt={title} width="600" height="800" />
        {artworkHeader}
        {audioUrl && <div ref={player} className="episode-listen-panel" style={playerStyle}>
          <AudioPlayer key={`${id}:${audioUrl}`} src={audioUrl} episodeId={id} playbackRef={playback} />
        </div>}
      </div>
    </section>
    <div className="episode-reading">{children}</div>
  </div></EpisodePlaybackContext.Provider>;
}
