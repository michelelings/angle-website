'use client';
import type { ComponentProps } from 'react';
import { artworkFallback } from '@/lib/artwork-fallback';
export function ArtworkImage({ original, ...props }: ComponentProps<'img'> & { original: string | null }) {
  return <img {...props} crossOrigin="anonymous" decoding="async" onError={event => artworkFallback(event.currentTarget, original)} />;
}
