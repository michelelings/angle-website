'use client';
import { APP_URL } from '@/lib/site';
import { trackEvent } from '@/lib/analytics';

export function GetAngleLink({ location, episodeId }: { location: 'header' | 'modal'; episodeId?: string }) {
  return <a href={APP_URL} className={location === 'header' ? 'button' : 'audio-get-angle-btn'}
    target={location === 'modal' ? '_blank' : undefined} rel={location === 'modal' ? 'noopener noreferrer' : undefined}
    onClick={() => {
      trackEvent('download_click', { link_location: location }, episodeId);
    }}>Get Angle</a>;
}
