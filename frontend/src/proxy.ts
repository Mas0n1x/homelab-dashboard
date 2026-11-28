/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Content-Security-Policy für alle Seiten: Skripte laufen nur mit dem je Aufruf neu
// erzeugten Merkmal. Eingeschleuste Skripte (aus Mails, Logs, Dienstnamen) laufen nicht.
import { NextResponse, type NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV === 'development';
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    // Inline-Stile setzen Animationen, Terminal und HTML-Mails.
    "style-src 'self' 'unsafe-inline'",
    // Dienst-Symbole und freigegebene Mail-Bilder kommen von fremden Adressen.
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' data:",
    // Wetteranzeige in der Kopfleiste, GitHub-Kachel
    "connect-src 'self' https://api.open-meteo.com https://api.github.com",
    // Dateivorschau (blob:) und die Minecraft-Karte
    "frame-src 'self' blob: https: http:",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ');

  // Next liest das Merkmal aus der Anfrage und setzt es an seine eigenen Skripte.
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: ['/((?!api|ws|_next/static|_next/image|favicon.svg|icons/|manifest.webmanifest).*)'],
};
