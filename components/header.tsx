import Link from 'next/link';
import type { ReactNode } from 'react';
import { GetAngleLink } from './get-angle-link';
import { StoryCount } from './story-count';
import { CatalogSearch } from './catalog-search';
export function Header({ count, stream = false, search, heading }: { count?: number; stream?: boolean; search?: ReactNode; heading?: string }) {
  // Catalog pages own the page heading; episode pages render theirs in EpisodeDetails.
  const Intro = heading || count !== undefined ? 'h1' : 'p';
  return <header className="header-section">
    <Link href="/" aria-label="Angle home"><img src="/images/logo.svg" alt="Angle" className="app-icon brand-logo" width="48" height="48" /></Link>
    <div className="header-introduction"><Intro className="intro">{count !== undefined ? <StoryCount count={count} /> : heading || 'Stories worth listening.'}</Intro></div>
    <div className="cta-buttons"><GetAngleLink location="header" /></div>
    {stream && <Link href="/" className="switch-link">← Back to gallery</Link>}
    {search === undefined ? <CatalogSearch /> : search}
  </header>;
}
