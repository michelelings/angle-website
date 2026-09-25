'use client';
import { useEffect, useRef, useState } from 'react';
import { formatTime } from '@/lib/episodes';
import { createListeningTracker } from '@/lib/listening';
import { trackEvent } from '@/lib/analytics';
export function AudioPlayer({ src, episodeId }: { src: string; episodeId: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);
  const [tracker] = useState(() => createListeningTracker(event => trackEvent(event.name,
    event.percent === undefined ? {} : { percent: event.percent }, episodeId)));
  useEffect(() => {
    const element = audio.current;
    if (element) { element.src = src; element.load(); }
    return () => { if (element) { element.pause(); element.removeAttribute('src'); element.load(); } };
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
      <button type="button" className="audio-play-pause" aria-label={playing ? 'Pause audio' : 'Play audio'} onClick={toggle}>{playing ? '⏸' : '▶'}</button>
      <div className="audio-progress-container"><input aria-label="Playback position" type="range" min="0" max={duration || 1} step="0.1" value={time} disabled={!duration}
        aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`} onChange={e => { if (audio.current) audio.current.currentTime = Number(e.target.value); setTime(Number(e.target.value)); }} /></div>
      <div className="audio-time"><span>{formatTime(time)}</span><span>/</span><span>{formatTime(duration)}</span></div>
    </div>
    {error && <p className="audio-error" role="alert">Unable to play audio. Please try again.</p>}
  </div>;
}
