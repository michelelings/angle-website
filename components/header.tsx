import Link from 'next/link';
import type { ReactNode } from 'react';
import { GetAngleLink } from './get-angle-link';
import { StoryCount } from './story-count';
import { QuickSearch } from './quick-search';
export function Header({ count, stream = false, search }: { count?: number; stream?: boolean; search?: ReactNode }) {
  // Catalog pages own the page heading; episode pages render theirs in EpisodeDetails.
  const Intro = count === undefined ? 'p' : 'h1';
  return <header className="header-section">
    <Link href="/" aria-label="Angle home"><img src="/images/icon.webp" alt="Angle" className="app-icon" width="48" height="48" /></Link>
    <Intro className="intro">{count === undefined ? 'Stories worth listening.' : <StoryCount count={count} />}</Intro>
    <div className="cta-buttons"><GetAngleLink location="header" /></div>
    {stream && <Link href="/" className="switch-link">← Back to gallery</Link>}
    {search === undefined ? <QuickSearch /> : search}
  </header>;
}
