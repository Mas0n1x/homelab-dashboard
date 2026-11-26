/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Offene WebSockets je Benutzer. Das Token wird nur beim Verbinden geprüft —
// ohne diese Liste überlebte eine Root-Shell jeden Passwortwechsel.
const offene = new Map(); // userId -> Set<ws>

export function merkeSitzung(userId, ws) {
  if (!offene.has(userId)) offene.set(userId, new Set());
  offene.get(userId).add(ws);
  ws.on('close', () => {
    offene.get(userId)?.delete(ws);
    if (offene.get(userId)?.size === 0) offene.delete(userId);
  });
}

export function schliesseSitzungen(userId) {
  const liste = [...(offene.get(userId) || [])];
  for (const ws of liste) {
    try { ws.close(4001, 'Sitzung beendet'); } catch { /* schon zu */ }
    // Antwortet die Gegenseite nicht auf den Abschied, hart trennen.
    setTimeout(() => ws.terminate?.(), 2000).unref();
  }
  offene.delete(userId);
  return liste.length;
}
