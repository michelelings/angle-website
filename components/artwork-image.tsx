'use client';
import { useEffect, useRef, useState, type ComponentProps, type RefObject } from 'react';
import { artworkFallback } from '@/lib/artwork-fallback';
import { artworkCornerColor } from '@/lib/artwork-corner';

type Props = Omit<ComponentProps<'img'>, 'srcSet' | 'sizes'> & {
  src: string; fullSrc: string; previewRef?: RefObject<HTMLImageElement | null>; cornerShade?: boolean;
};

export function ArtworkImage({ src, fullSrc, className = '', previewRef, children, cornerShade = false, ...props }: Props) {
  const container = useRef<HTMLSpanElement>(null);
  const full = useRef<HTMLImageElement>(null);
  const [decodedSource, setDecodedSource] = useState('');
  useEffect(() => {
    if (!cornerShade) return;
    const element = container.current!;
    const preview = element.querySelector('img')!;
    let active = true;
    element.style.removeProperty('--artwork-corner');
    const update = () => {
      const source = preview.currentSrc || preview.src;
      void artworkCornerColor(preview).then(color => {
        if (active && color && source === (preview.currentSrc || preview.src)) element.style.setProperty('--artwork-corner', color);
      }).catch(() => { /* Keep the neutral fallback if image sampling is unavailable. */ });
    };
    if (preview.complete) update();
    preview.addEventListener('load', update);
    return () => { active = false; preview.removeEventListener('load', update); };
  }, [src, cornerShade]);
  useEffect(() => {
    let active = true;
    const image = full.current;
    if (image) void image.decode().then(() => { if (active) setDecodedSource(fullSrc); }).catch(() => {});
    return () => { active = false; };
  }, [fullSrc]);
  return <span ref={container} className={`progressive-artwork ${className}${cornerShade ? ' corner-shaded' : ''}`}>
    <img {...props} ref={previewRef} src={src} crossOrigin="anonymous" decoding="async"
      onError={event => artworkFallback(event.currentTarget, null)} />
    {fullSrc !== src && <img {...props} ref={full} src={fullSrc} crossOrigin="anonymous" decoding="async"
      className={`artwork-full${decodedSource === fullSrc ? ' is-ready' : ''}`} alt="" aria-hidden="true" fetchPriority="low" />}
    {children}
  </span>;
}
