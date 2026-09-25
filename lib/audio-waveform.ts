const waveforms = new Map<string, number[]>();

export function waveformPeaks(samples: Float32Array, count = 80): number[] {
  const peaks = Array.from({ length: count }, (_, index) => {
    const start = Math.floor(index * samples.length / count);
    const end = Math.floor((index + 1) * samples.length / count);
    let sum = 0;
    for (let i = start; i < end; i++) sum += samples[i] * samples[i];
    return Math.sqrt(sum / Math.max(1, end - start));
  });
  const max = Math.max(...peaks, .001);
  return peaks.map(peak => Math.max(.08, peak / max));
}

export function cachedWaveform(src: string): number[] | undefined { return waveforms.get(src); }

export async function loadWaveform(src: string, signal: AbortSignal): Promise<number[]> {
  const cached = waveforms.get(src);
  if (cached) return cached;
  const response = await fetch(src, { signal });
  if (!response.ok) throw new Error('Waveform unavailable');
  const encoded = await response.arrayBuffer();
  signal.throwIfAborted();
  // A low sample rate keeps long speech episodes inexpensive to analyse.
  const context = new OfflineAudioContext(1, 1, 8000);
  const decoded = await context.decodeAudioData(encoded);
  signal.throwIfAborted();
  const peaks = waveformPeaks(decoded.getChannelData(0));
  if (waveforms.size >= 16) waveforms.delete(waveforms.keys().next().value!);
  waveforms.set(src, peaks);
  return peaks;
}
