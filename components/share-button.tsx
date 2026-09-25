'use client';
import { useState } from 'react';
import { ORIGIN } from '@/lib/site';
export async function shareEpisode(id: string) {
  const url = `${ORIGIN}/episode/${encodeURIComponent(id)}`;
  if (navigator.share) {
    try { await navigator.share({ url }); return 'Shared'; }
    catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
    }
  }
  await navigator.clipboard.writeText(url);
  return 'Link copied';
}
export function ShareButton({ id }: { id: string }) {
  const [status, setStatus] = useState('');
  return <><button type="button" className="modal-share-btn" onClick={async () => {
    try { setStatus(await shareEpisode(id)); } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) setStatus(`Copy this link: ${ORIGIN}/episode/${id}`);
    }
  }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3m-4 4 4-4 4 4M5 12v9h14v-9" /></svg>Share</button><p role="status" className="text-secondary text-sm mt-2 break-all">{status}</p></>;
}
