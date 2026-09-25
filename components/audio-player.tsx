'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { formatTime } from '@/lib/episodes';
import { createListeningTracker } from '@/lib/listening';
import { trackEvent } from '@/lib/analytics';
import { cachedWaveform, loadWaveform } from '@/lib/audio-waveform';
// A stable speech-like silhouette renders immediately, including before hydration.
// These are decorative placeholder peaks; decoded audio replaces them when ready.
const pendingWaveform = Array.from({ length: 80 }, (_, index) =>
  .42 + .22 * Math.abs(Math.sin(index * 1.73 + .8)) + .2 * Math.abs(Math.sin(index * .37 + 1.2)));
export function AudioPlayer({ src, episodeId }: { src: string; episodeId: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);
  const [waveform, setWaveform] = useState<number[] | undefined>(undefined);
  const [tracker] = useState(() => createListeningTracker(event => trackEvent(event.name,
    event.percent === undefined ? {} : { percent: event.percent }, episodeId)));
  useEffect(() => {
    const element = audio.current;
    if (element) { element.src = src; element.load(); }
    return () => { if (element) { element.pause(); element.removeAttribute('src'); element.load(); } };
  }, [src]);
  useEffect(() => {
    const cached = cachedWaveform(src);
    setWaveform(cached);
    if (cached) return;
    const controller = new AbortController();
    void loadWaveform(src, controller.signal).then(peaks => {
      if (!controller.signal.aborted) setWaveform(peaks);
    }).catch(() => { /* Playback and seeking remain available without waveform data. */ });
    return () => controller.abort();
  }, [src]);
  async function toggle() {
    const element = audio.current;
    if (!element) return;
    if (!element.paused) element.pause();
    else { setError(false); try { await element.play(); } catch { setError(true); } }
  }
  return <div className="modal-audio-player">
    <audio ref={audio} src={src} preload="metadata" onPlay={() => setPlaying(true)}
      onPlaying={e => tracker.start(e.currentTarget.currentTime)}
      onPause={() => { setPlaying(false); tracker.resetPosition(); }}
      onSeeking={() => tracker.resetPosition()} onSeeked={() => tracker.resetPosition()}
      onEnded={e => { setPlaying(false); tracker.end(e.currentTarget.duration); }}
      onLoadedMetadata={e => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
      onTimeUpdate={e => { const element = e.currentTarget; setTime(element.currentTime);
        if (!element.paused && !element.seeking) tracker.sample(element.currentTime, element.duration);
      }} onError={() => setError(true)} />
    <div className="audio-controls">
      <button type="button" className="audio-play-pause" aria-label={playing ? 'Pause audio' : 'Play audio'} onClick={toggle}>
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{playing ? <path d="M6 4h4v16H6zm8 0h4v16h-4z" /> : <path d="M8 4.5v15l12-7.5z" />}</svg>
      </button>
      <div className="audio-waveform" data-ready={!!waveform} style={{ '--audio-progress': `${duration ? Math.min(100, time / duration * 100) : 0}%` } as CSSProperties}>
        <svg className="audio-waveform-bars" viewBox="0 0 320 48" preserveAspectRatio="none" aria-hidden="true">
          {(waveform || pendingWaveform).map((peak, index) => <rect key={index} x={index * 4} y="2" width="2" height="44" style={{ transform: `scaleY(${peak})` }} fill={duration && index / 80 < time / duration ? 'var(--player-ink, #fff)' : 'var(--player-track, #ffffff35)'} />)}
        </svg>
        {playing && <span className="audio-playhead-time" aria-hidden="true">{formatTime(time)}</span>}
        <input aria-label="Playback position" type="range" min="0" max={duration || 1} step="0.1" value={time} disabled={!duration}
          aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`} onChange={e => { if (audio.current) audio.current.currentTime = Number(e.target.value); setTime(Number(e.target.value)); }} />
      </div>
    </div>
    {error && <p className="audio-error" role="alert">Unable to play audio. Please try again.</p>}
  </div>;
}
