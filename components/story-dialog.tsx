'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
export function StoryDialog({ children, title }: { children: React.ReactNode; title: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
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
    onCancel={event => { event.preventDefault(); router.back(); }}
    onClick={event => { if (event.target === event.currentTarget) router.back(); }}>
    <div className="modal-content"><div className="modal-header"><button type="button" className="modal-close" aria-label="Close story" autoFocus onClick={() => router.back()}>×</button></div>{children}</div>
  </dialog>;
}
