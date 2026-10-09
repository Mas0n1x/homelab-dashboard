/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import type { Metadata } from 'next';

// Freigabelinks gehören nicht in Suchmaschinen und nicht in Link-Vorschauen mit Inhalt.
export const metadata: Metadata = {
  title: 'Download',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
