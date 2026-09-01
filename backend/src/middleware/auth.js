/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../services/auth.js';
import { getDb } from '../services/database.js';

// Eine gültige Signatur allein reichte bisher als Zugangsbeweis: das Token trägt
// nur { id, username }, es gab keinen Blick in die Datenbank. Folgen davon:
//   - Ein gelöschter Benutzer behielt bis zu 24 Stunden vollen Zugriff.
//   - Ein Passwortwechsel widerrief nur die Refresh-Token; ein gestohlenes
//     Access-Token blieb bis zum Ablauf gültig — genau falsch, denn Passwort
//     ändern ist die erste Reaktion auf einen Verdacht.
// Deshalb wird hier zusätzlich geprüft, dass der Benutzer noch existiert und
// das Token nach `tokens_valid_after` ausgestellt wurde.
function pruefeBenutzer(decoded) {
  const db = getDb();
  const user = db.prepare('SELECT id, username, tokens_valid_after FROM users WHERE id = ?').get(decoded.id);
  if (!user) return { ok: false, grund: 'Benutzer existiert nicht mehr' };

  if (user.tokens_valid_after) {
    // `iat` steht in Sekunden. Gleichstand gilt als gültig, sonst würde ein
    // unmittelbar nach dem Wechsel ausgestelltes Token in derselben Sekunde
    // wieder verworfen.
    // SQLite liefert `datetime('now')` als "YYYY-MM-DD HH:MM:SS" in UTC. Mit dem
    // Leerzeichen ist das kein ISO-Format und wird je nach Laufzeit anders (oder
    // gar nicht) geparst — deshalb explizit auf ISO+Z umschreiben.
    const iso = `${String(user.tokens_valid_after).trim().replace(' ', 'T')}Z`;
    const gueltigAb = Math.floor(new Date(iso).getTime() / 1000);
    if (!Number.isFinite(gueltigAb)) {
      // Unlesbarer Wert darf niemanden aussperren, muss aber auffallen.
      console.warn(`[auth] tokens_valid_after für Benutzer ${user.id} ist unlesbar ("${user.tokens_valid_after}") — Prüfung übersprungen.`);
    } else if (typeof decoded.iat === 'number' && decoded.iat < gueltigAb) {
      return { ok: false, grund: 'Token vor der letzten Passwortänderung ausgestellt' };
    }
  }
  return { ok: true, user };
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const geprueft = pruefeBenutzer(decoded);
  if (!geprueft.ok) {
    return res.status(401).json({ error: 'Invalid or expired token', reason: geprueft.grund });
  }

  req.user = decoded;
  next();
}

// Für Stellen ohne Express-Request (WebSocket-Upgrades, MC-Konsole). Wirft
// bewusst, damit der Aufrufer die Verbindung schließen kann.
export function verifyToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  const geprueft = pruefeBenutzer(decoded);
  if (!geprueft.ok) {
    throw new Error(geprueft.grund);
  }
  return decoded;
}
