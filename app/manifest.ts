import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PocketLog Personal Finance',
    short_name: 'PocketLog',
    description: 'Personal finance and budget tracking application',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0D110F',
    theme_color: '#5B7966',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
