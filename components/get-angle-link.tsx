'use client';
import { APP_URL } from '@/lib/site';
import { trackEvent } from '@/lib/analytics';

export function GetAngleLink({ location, episodeId }: { location: 'header' | 'modal'; episodeId?: string }) {
  return <a href={APP_URL} className={location === 'header' ? 'button' : 'audio-get-angle-btn'}
    target={location === 'modal' ? '_blank' : undefined} rel={location === 'modal' ? 'noopener noreferrer' : undefined}
    onClick={() => {
      trackEvent('download_click', { link_location: location }, episodeId);
    }}>{location === 'modal' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 16v5h14v-5" /></svg>}Get Angle</a>;
}
