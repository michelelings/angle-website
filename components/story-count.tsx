'use client';
import { useEffect, useRef, useState } from 'react';

export function StoryCount({ count }: { count: number }) {
  const [displayed, setDisplayed] = useState(count);
  const current = useRef(count);
  const first = useRef(true);
  useEffect(() => {
    const start = first.current ? 0 : current.current;
    first.current = false;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const finish = () => {
      cancelAnimationFrame(frame);
      current.current = count;
      setDisplayed(count);
    };
    const changed = () => { if (motion.matches) finish(); };
    if (motion.matches) { finish(); return; }
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - started) / 800, 1);
      current.current = Math.round(start + (count - start) * (1 - (1 - progress) ** 3));
      setDisplayed(current.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    motion.addEventListener('change', changed);
    return () => { cancelAnimationFrame(frame); motion.removeEventListener('change', changed); };
  }, [count]);
  return <><span aria-hidden="true">{displayed} {displayed === 1 ? 'story' : 'stories'} worth listening.</span>
    <span className="sr-only">{count} {count === 1 ? 'story' : 'stories'} worth listening.</span></>;
}
