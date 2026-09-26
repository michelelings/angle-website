'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
export function StoryDialog({ children, title, onClose }: { children: React.ReactNode; title: string; onClose?: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const close = onClose ?? (() => router.back());
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    const previousTitle = document.title;
    document.title = `${title} | Angle`;
    element.showModal();
    element.querySelector<HTMLButtonElement>('.modal-close')?.focus({ preventScroll: true });
    document.body.classList.add('modal-open');
    window.dispatchEvent(new CustomEvent('angle:dialog', { detail: true }));
    return () => {
      element.close();
      document.title = previousTitle;
      document.body.classList.remove('modal-open');
      window.dispatchEvent(new CustomEvent('angle:dialog', { detail: false }));
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [title]);
  return <dialog ref={dialog} className="modal-overlay" aria-labelledby="story-title"
    onCancel={event => { event.preventDefault(); close(); }}
    onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="episode-shell"><div className="modal-header"><button type="button" className="modal-close" aria-label="Close story" autoFocus onClick={close}>×</button></div>{children}</div>
  </dialog>;
}
