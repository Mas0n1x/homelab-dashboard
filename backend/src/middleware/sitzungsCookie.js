/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Das Erneuerungs-Token liegt im Browser in einem HttpOnly-Cookie: Skripte auf der Seite
// kommen nicht daran. Der Browser meldet sich mit `X-HD-Auth: 1` und bekommt das Token
// dann nie im Antworttext. Ohne den Kopf (Skripte, alte offene Tabs) bleibt der bisherige
// Weg über den Anfragetext bestehen.

const NAME = 'hd_refresh';
const GUELTIG_MS = 90 * 24 * 60 * 60 * 1000;

// TLS endet bei Cloudflare; im Heimnetz läuft das Dashboard über http, dort darf
// das Cookie nicht `Secure` sein.
const optionen = (req) => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https',
  path: '/api/auth',
});

export const istBrowser = (req) => req.headers['x-hd-auth'] === '1';

export function setzeCookie(req, res, token) {
  res.cookie(NAME, token, { ...optionen(req), maxAge: GUELTIG_MS });
}

export function loescheCookie(req, res) {
  res.clearCookie(NAME, optionen(req));
}

/**
 * Token aus dem Cookie — nur für Anfragen der eigenen Oberfläche. Andere Subdomains
 * gelten für SameSite als „gleiche Seite", deshalb zusätzlich Kopf und Herkunft prüfen.
 */
export function tokenAusCookie(req) {
  if (!istBrowser(req)) return null;
  const herkunft = req.headers['sec-fetch-site'];
  if (herkunft && herkunft !== 'same-origin') return null;
  const treffer = String(req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${NAME}=([a-f0-9]+)`));
  return treffer ? treffer[1] : null;
}
