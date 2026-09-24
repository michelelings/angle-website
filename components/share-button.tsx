'use client';
import { useState } from 'react';
import { ORIGIN } from '@/lib/site';
export async function shareEpisode(id: string) {
  const url = `${ORIGIN}/episode/${encodeURIComponent(id)}`;
  if (navigator.share) { await navigator.share({ url }); return 'Shared'; }
  await navigator.clipboard.writeText(url);
  return 'Link copied';
}
export function ShareButton({ id }: { id: string }) {
  const [status, setStatus] = useState('');
  return <><button type="button" className="modal-share-btn" onClick={async () => {
    try { setStatus(await shareEpisode(id)); } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) setStatus(`Copy this link: ${ORIGIN}/episode/${id}`);
    }
  }}>Share</button><p role="status" className="text-secondary text-sm mt-2 break-all">{status}</p></>;
}
