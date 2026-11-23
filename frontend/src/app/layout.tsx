/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Providers } from './providers';
import '@/styles/globals.css';

// Schriften werden beim Build geladen und vom eigenen Server ausgeliefert — kein Aufruf an Google beim Seitenaufbau.
const inter = Inter({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono', display: 'swap' });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#050510',
};

export const metadata: Metadata = {
  title: 'Homelab Dashboard',
  description: 'Homelab Management Dashboard',
  icons: {
    icon: '/favicon.svg',
    apple: '/icons/icon-192.png',
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Homelab', statusBarStyle: 'black-translucent' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${inter.variable} ${mono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
