import Link from 'next/link';
import type { ReactNode } from 'react';
import { APP_URL } from '@/lib/site';
import { QuickSearch } from './quick-search';
export function Header({ count, stream = false, search }: { count?: number; stream?: boolean; search?: ReactNode }) {
  // Catalog pages own the page heading; episode pages render theirs in EpisodeDetails.
  const Intro = count === undefined ? 'p' : 'h1';
  return <header className="header-section">
    <Link href="/" aria-label="Angle home"><img src="/images/icon.webp" alt="Angle" className="app-icon" width="48" height="48" /></Link>
    <Intro className="intro">{count === undefined ? 'Stories worth listening.' : `${count} ${count === 1 ? 'story' : 'stories'} worth listening.`}</Intro>
    <div className="cta-buttons"><a href={APP_URL} className="button">Get Angle</a></div>
    <Link href={stream ? '/' : '/home-v2'} className="switch-link">{stream ? '← Back to gallery' : 'Try stream view →'}</Link>
    {search === undefined ? <QuickSearch /> : search}
  </header>;
}
