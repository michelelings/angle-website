'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-2xl p-8 py-24"><h1>Stories are temporarily unavailable</h1><p className="my-6">Please try again in a moment.</p><button className="button" onClick={reset}>Try again</button></main>;
}
