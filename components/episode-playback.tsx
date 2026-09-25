'use client';
import { createContext, useContext } from 'react';
export interface EpisodePlaybackHandle { playFrom(seconds: number): void }
export const EpisodePlaybackContext = createContext<((seconds: number) => void) | null>(null);
export function HearStoryMoment({ seconds, title }: { seconds: number; title: string }) {
  const playFrom = useContext(EpisodePlaybackContext);
  return <button type="button" className="story-hear" onClick={() => playFrom?.(seconds)} aria-label={`Hear this moment: ${title}`} title="Hear this moment">
    <span className="story-hear-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="m8 5 11 7-11 7z" /></svg></span>{title}
  </button>;
}
