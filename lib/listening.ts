export type ListeningEvent = { name: 'audio_start' | 'audio_progress' | 'audio_complete'; percent?: number };

// Count played time, not the playhead position: seeking to the end is not a listen.
export function createListeningTracker(emit: (event: ListeningEvent) => void) {
  let started = false;
  let previous: number | null = null;
  let listened = 0;
  const sent = new Set<number>();
  return {
    start(position: number) {
      previous = position;
      if (!started) { started = true; emit({ name: 'audio_start' }); }
    },
    resetPosition() { previous = null; },
    sample(position: number, duration: number) {
      const delta = previous === null ? 0 : position - previous;
      previous = position;
      // Normal timeupdate ticks are small; do not credit seeks or long gaps.
      if (delta > 0 && delta <= 2) listened += delta;
      if (!Number.isFinite(duration) || duration <= 0) return;
      for (const percent of [25, 50, 75]) {
        if (listened / duration * 100 >= percent && !sent.has(percent)) {
          sent.add(percent); emit({ name: 'audio_progress', percent });
        }
      }
    },
    end(duration: number) {
      if (Number.isFinite(duration) && duration > 0 && listened >= duration * 0.9 && !sent.has(100)) {
        sent.add(100); emit({ name: 'audio_complete', percent: 100 });
      }
      previous = null;
    },
  };
}
