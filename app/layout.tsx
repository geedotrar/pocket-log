import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '@/lib/theme/ThemeContext';

export const metadata: Metadata = {
  title: 'PocketLog - Personal Finance & Budget Tracker',
  description: 'Personal finance and budget tracking application.',
  applicationName: 'PocketLog',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PocketLog',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon.png', type: 'image/png', sizes: '48x48' },
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EFEFED' },
    { media: '(prefers-color-scheme: dark)', color: '#0E1310' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('pocketlog_theme');
                  var theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                  document.documentElement.setAttribute('data-theme', theme);
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('light');
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('light');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="h-full antialiased selection:bg-[#A7D7B5] selection:text-[#0C2417]">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
