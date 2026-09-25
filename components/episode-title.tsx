'use client';

import { useLayoutEffect, useRef } from 'react';

/** Keep the complete headline visible, at the largest size that fits three lines. */
export function EpisodeTitle({ title, modal }: { title: string; modal: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const Tag = modal ? 'h2' : 'h1';

  useLayoutEffect(() => {
    const element = heading.current!;
    let frame = 0;
    let disposed = false;
    let previousWidth = 0;

    function fit() {
      element.style.removeProperty('font-size');
      if (!element.clientWidth) return;
      const maximum = parseFloat(getComputedStyle(element).fontSize);
      const fits = () => element.getBoundingClientRect().height <= parseFloat(getComputedStyle(element).lineHeight) * 3 + 1;
      if (fits()) return;
      let lower = 1;
      let upper = maximum;
      // Measure actual wrapping, including the loaded font and available column width.
      for (let i = 0; i < 10; i++) {
        const size = (lower + upper) / 2;
        element.style.fontSize = `${size}px`;
        if (fits()) lower = size;
        else upper = size;
      }
      element.style.fontSize = `${Math.floor(lower * 4) / 4}px`;
    }

    function scheduleFit() {
      if (disposed) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    }

    fit();
    const observer = new ResizeObserver(([entry]) => {
      // Font changes alter height too; only width changes need another measurement.
      if (entry.contentRect.width === previousWidth) return;
      previousWidth = entry.contentRect.width;
      scheduleFit();
    });
    observer.observe(element);
    window.addEventListener('resize', scheduleFit);
    document.fonts.addEventListener('loadingdone', scheduleFit);
    void document.fonts.ready.then(scheduleFit);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', scheduleFit);
      document.fonts.removeEventListener('loadingdone', scheduleFit);
    };
  }, [title]);

  return <Tag ref={heading} className="modal-title" id="story-title">{title}</Tag>;
}
