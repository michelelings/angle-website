'use client';
import { createContext, useContext, useSyncExternalStore } from 'react';
export interface EpisodePlaybackHandle { playFrom(seconds: number): void }
export const EpisodePlaybackContext = createContext<((seconds: number) => void) | null>(null);

/** Current audio position, or null before listening starts. Subscribers select what they need. */
export interface PlaybackClock { position(): number | null; subscribe(listener: () => void): () => void; set(seconds: number | null): void }
export function createPlaybackClock(): PlaybackClock {
  let position: number | null = null;
  const listeners = new Set<() => void>();
  return {
    position: () => position,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    set(seconds) { if (seconds === position) return; position = seconds; for (const listener of listeners) listener(); },
  };
}
export const EpisodePlaybackClock = createContext<PlaybackClock | null>(null);
const unsubscribed = () => () => {};
/** Re-renders only when the selected value changes, not on every time update. */
export function usePlaybackPosition<T extends string | number | boolean | null>(select: (seconds: number | null) => T): T {
  const clock = useContext(EpisodePlaybackClock);
  return useSyncExternalStore(clock?.subscribe ?? unsubscribed, () => select(clock?.position() ?? null), () => select(null));
}

export function HearStoryMoment({ seconds, title }: { seconds: number; title: string }) {
  const playFrom = useContext(EpisodePlaybackContext);
  return <button type="button" className="story-hear" onClick={() => playFrom?.(seconds)} aria-label={`Hear this moment: ${title}`} title="Hear this moment">
    <span className="story-hear-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="m8 5 11 7-11 7z" /></svg></span>{title}
  </button>;
}
