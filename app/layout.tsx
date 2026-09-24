import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { ORIGIN } from '@/lib/site';
export const metadata: Metadata = { metadataBase: new URL(ORIGIN), icons: { icon: '/images/icon.webp' } };
export default function RootLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  return <html lang="en"><body>{children}{modal}
    <Script src="https://www.googletagmanager.com/gtag/js?id=G-RRQ8EPNMPQ" strategy="afterInteractive" />
    <Script id="analytics" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-RRQ8EPNMPQ');`}</Script>
  </body></html>;
}
