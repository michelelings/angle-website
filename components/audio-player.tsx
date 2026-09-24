'use client';
import { useEffect, useRef, useState } from 'react';
import { formatTime } from '@/lib/episodes';
import { GetAngleLink } from './get-angle-link';
export function AudioPlayer({ src }: { src: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);
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
    <audio ref={audio} src={src} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
      onLoadedMetadata={e => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
      onTimeUpdate={e => setTime(e.currentTarget.currentTime)} onError={() => setError(true)} />
    <div className="audio-controls">
      <button type="button" className="audio-play-pause" aria-label={playing ? 'Pause audio' : 'Play audio'} onClick={toggle}>{playing ? '⏸' : '▶'}</button>
      <div className="audio-progress-container"><input aria-label="Playback position" type="range" min="0" max={duration || 1} step="0.1" value={time} disabled={!duration}
        aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`} onChange={e => { if (audio.current) audio.current.currentTime = Number(e.target.value); setTime(Number(e.target.value)); }} /></div>
      <div className="audio-time"><span>{formatTime(time)}</span><span>/</span><span>{formatTime(duration)}</span></div>
    </div>
    <GetAngleLink location="modal" />
    {error && <p className="audio-error" role="alert">Unable to play audio. Please try again.</p>}
  </div>;
}
