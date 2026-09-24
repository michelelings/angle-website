'use client';
import { APP_URL } from '@/lib/site';

export function GetAngleLink({ location }: { location: 'header' | 'modal' }) {
  return <a href={APP_URL} className={location === 'header' ? 'button' : 'audio-get-angle-btn'}
    target={location === 'modal' ? '_blank' : undefined} rel={location === 'modal' ? 'noopener noreferrer' : undefined}
    onClick={() => {
      const analytics = window as Window & { gtag?: (...args: unknown[]) => void };
      analytics.gtag?.('event', 'download_click', { link_location: location });
    }}>Get Angle</a>;
}
