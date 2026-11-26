/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Client-Adresse für Sperren gegen Durchprobieren.
//
// Nur X-Real-IP zählt: nginx setzt den Kopf selbst und überschreibt, was der
// Aufrufer mitschickt. X-Forwarded-For wird ANGEHÄNGT — der erste Eintrag ist
// frei erfunden, damit ließ sich jede Sperre umgehen.
export function clientIp(req) {
  const ip = String(req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unbekannt').trim().replace(/^::ffff:/, '');
  if (!ip.includes(':')) return ip;
  // IPv6: ein Anschluss hat ein ganzes /64, sonst gäbe jede Adresse neue Versuche.
  const [vorn, hinten = ''] = ip.split('::');
  const a = vorn ? vorn.split(':') : [];
  const b = hinten ? hinten.split(':') : [];
  const gruppen = ip.includes('::') ? [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill('0'), ...b] : a;
  return gruppen.slice(0, 4).join(':') + '::/64';
}
