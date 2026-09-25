import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { ORIGIN } from '@/lib/site';
import { ArtworkTheme } from '@/components/artwork-theme';
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };
export const metadata: Metadata = {
  metadataBase: new URL(ORIGIN),
  // Use a new filename when the artwork changes: Safari can retain old site icons.
  icons: {
    icon: { url: '/icons/angle-silver-23626682.png', type: 'image/png', sizes: '64x64' },
    shortcut: '/icons/angle-silver-23626682.png',
    apple: { url: '/icons/angle-silver-apple-653f77db.png', type: 'image/png', sizes: '180x180' },
  },
};
export default function RootLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  return <html lang="en"><body><ArtworkTheme>{children}{modal}</ArtworkTheme>
    <Script src="https://www.googletagmanager.com/gtag/js?id=G-RRQ8EPNMPQ" strategy="afterInteractive" />
    <Script id="analytics" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-RRQ8EPNMPQ');`}</Script>
  </body></html>;
}
