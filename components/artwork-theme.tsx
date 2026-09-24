'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { extractArtworkPalette } from '@/lib/artwork-palette';

const ArtworkThemeContext = createContext<(image: HTMLImageElement | null) => void>(() => {});
export const useArtworkTheme = () => useContext(ArtworkThemeContext);

export function ArtworkTheme({ children }: { children: ReactNode }) {
  const [colors, setColors] = useState<string[]>([]);
  const request = useRef(0);
  const update = useCallback((image: HTMLImageElement | null) => {
    const id = ++request.current;
    if (!image) { setColors([]); return; }
    void (async () => {
      try {
        await image.decode();
        if (request.current !== id) return;
        const palette = await extractArtworkPalette(image);
        if (request.current === id) setColors(palette || []);
      } catch { if (request.current === id) setColors([]); }
    })();
  }, []);
  useEffect(() => () => { request.current++; }, []);
  const style = Object.fromEntries(colors.map((color, i) => [`--mesh-${i + 1}`, color])) as CSSProperties;
  return <ArtworkThemeContext.Provider value={update}>
    <div className="site-artwork-theme">
      <div className="artwork-mesh site-artwork-mesh" style={style} aria-hidden="true" />
      {children}
    </div>
  </ArtworkThemeContext.Provider>;
}

export function ArtworkThemeSource({ src }: { src: string }) {
  const update = useArtworkTheme();
  useEffect(() => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = src;
    update(image);
    return () => update(null);
  }, [src, update]);
  return null;
}
