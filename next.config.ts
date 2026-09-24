import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from './lib/opennext-context.js';
if (process.env.NODE_ENV === 'development') void initOpenNextCloudflareForDev();
const config: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/home-v2.html', destination: '/home-v2', permanent: true },
      { source: '/sitemap_index.xml', destination: '/sitemap.xml', permanent: true },
      { source: '/api/render/episode/:id', destination: '/episode/:id', permanent: true },
      { source: '/api/render/:category', destination: '/:category', permanent: true },
    ];
  },
};
export default config;
