import Link from 'next/link';
import { APP_URL } from '@/lib/site';
export function Header({ count, stream = false }: { count?: number; stream?: boolean }) {
  return <header className="header-section">
    <Link href="/" aria-label="Angle home"><img src="/images/icon.webp" alt="Angle" className="app-icon" width="48" height="48" /></Link>
    <p className="intro">{count === undefined ? 'Stories worth listening.' : `${count} stories worth listening.`}</p>
    <div className="cta-buttons"><a href={APP_URL} className="button">Get Angle</a></div>
    <Link href={stream ? '/' : '/home-v2'} className="switch-link">{stream ? '← Back to gallery' : 'Try stream view →'}</Link>
  </header>;
}
