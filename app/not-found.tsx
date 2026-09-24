import Link from 'next/link';
export default function NotFound() {
  return <main className="mx-auto max-w-2xl p-8 py-24"><h1>Story unavailable</h1><p className="my-6">This page could not be found.</p><Link className="button" href="/">Browse current stories</Link></main>;
}
