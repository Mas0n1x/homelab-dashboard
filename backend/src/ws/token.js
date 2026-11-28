/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Der Browser kann beim WebSocket keine Kopfzeilen setzen außer dem Unterprotokoll.
// Dort steht `bearer, <Token>` — in der URL stünde das Token in jedem Zugriffsprotokoll.
// (`ws` bestätigt von sich aus nur das erste Protokoll, also nie das Token.)
export function tokenAusAnfrage(req) {
  const [art, token] = String(req.headers['sec-websocket-protocol'] || '').split(',').map(s => s.trim());
  return art === 'bearer' && token ? token : null;
}
