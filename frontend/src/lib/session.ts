/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Anmeldung, Erneuerung und Abmeldung. Das Erneuerungs-Token verwaltet der Browser als
// HttpOnly-Cookie; die Oberfläche bekommt es nie zu sehen.

export const AUTH_HEADERS = { 'Content-Type': 'application/json', 'X-HD-Auth': '1' };

// Altbestand aus localStorage: wird einmal mitgeschickt, gegen das Cookie getauscht
// und danach gelöscht.
const altToken = () => localStorage.getItem('refreshToken') || undefined;

export async function erneuereSitzung(basis = '/api'): Promise<Response> {
  const res = await fetch(`${basis}/auth/refresh`, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify({ refreshToken: altToken() }),
  });
  if (res.ok) localStorage.removeItem('refreshToken');
  return res;
}

export async function beendeSitzung(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: AUTH_HEADERS,
      body: JSON.stringify({ refreshToken: altToken() }),
    });
  } catch {
    // Ohne Netz bleibt das Cookie bis zum Ablauf; lokal wird trotzdem abgemeldet.
  }
}

/** WebSocket mit Token im Unterprotokoll statt in der URL. */
export const authSocket = (url: string, token: string) => new WebSocket(url, ['bearer', token]);
