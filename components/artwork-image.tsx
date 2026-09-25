'use client';
import { useEffect, useRef, useState, type ComponentProps, type RefObject } from 'react';
import { artworkFallback } from '@/lib/artwork-fallback';

type Props = Omit<ComponentProps<'img'>, 'srcSet' | 'sizes'> & {
  src: string; fullSrc: string; previewRef?: RefObject<HTMLImageElement | null>;
};

export function ArtworkImage({ src, fullSrc, className = '', previewRef, ...props }: Props) {
  const full = useRef<HTMLImageElement>(null);
  const [decodedSource, setDecodedSource] = useState('');
  useEffect(() => {
    let active = true;
    const image = full.current;
    if (image) void image.decode().then(() => { if (active) setDecodedSource(fullSrc); }).catch(() => {});
    return () => { active = false; };
  }, [fullSrc]);
  return <span className={`progressive-artwork ${className}`}>
    <img {...props} ref={previewRef} src={src} crossOrigin="anonymous" decoding="async"
      onError={event => artworkFallback(event.currentTarget, null)} />
    {fullSrc !== src && <img {...props} ref={full} src={fullSrc} crossOrigin="anonymous" decoding="async"
      className={`artwork-full${decodedSource === fullSrc ? ' is-ready' : ''}`} alt="" aria-hidden="true" fetchPriority="low" />}
  </span>;
}
