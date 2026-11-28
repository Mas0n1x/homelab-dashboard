/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';
import { getDb } from '../services/database.js';
import { authenticateToken } from '../middleware/auth.js';
import * as authService from '../services/auth.js';
import { logAudit } from '../services/audit.js';
import { clientIp } from '../middleware/clientIp.js';
import { schliesseSitzungen, schliesseSitzung } from '../services/sitzungen.js';
import { istBrowser, setzeCookie, loescheCookie, tokenAusCookie } from '../middleware/sitzungsCookie.js';

const router = Router();

// Einfaches In-Memory-Rate-Limit für Login (Brute-Force-Schutz)
const loginAttempts = new Map();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;
function loginRateLimited(ip) {
  const rec = loginAttempts.get(ip);
  if (!rec) return false;
  if (Date.now() - rec.first > WINDOW_MS) { loginAttempts.delete(ip); return false; }
  return rec.count >= MAX_ATTEMPTS;
}
function recordLoginFail(ip) {
  const now = Date.now();
  let rec = loginAttempts.get(ip);
  if (!rec || now - rec.first > WINDOW_MS) rec = { count: 0, first: now };
  rec.count++;
  loginAttempts.set(ip, rec);
}
setInterval(() => {
  for (const [ip, rec] of loginAttempts) if (Date.now() - rec.first > WINDOW_MS) loginAttempts.delete(ip);
}, WINDOW_MS).unref();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const ip = clientIp(req);
    if (loginRateLimited(ip)) {
      return res.status(429).json({ error: 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.' });
    }
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });
    }

    // Schon vor der Prüfung zählen, sonst laufen parallele Anfragen an der Sperre vorbei.
    recordLoginFail(ip);

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      logAudit('auth.login_failed', String(username).slice(0, 60), { ip });
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    const valid = await authService.verifyPassword(password, user.password_hash);
    if (!valid) {
      logAudit('auth.login_failed', user.username, { ip }, user.id);
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }
    loginAttempts.delete(ip);

    // Meldet sich derselbe Browser erneut an, ersetzt das seine alte Sitzung.
    const bisher = tokenAusCookie(req);
    if (bisher) authService.revokeRefreshToken(bisher);

    const refreshToken = authService.generateRefreshToken();
    const sitzung = authService.storeRefreshToken(user.id, refreshToken, { geraet: req.headers['user-agent'], ip });
    const accessToken = authService.generateAccessToken(user, sitzung);

    const setupCompleted = db.prepare("SELECT value FROM settings WHERE key = 'setup_completed'").get();

    logAudit('auth.login', user.username, null, user.id);

    setzeCookie(req, res, refreshToken);
    res.json({
      accessToken,
      ...(istBrowser(req) ? {} : { refreshToken }),
      user: { id: user.id, username: user.username },
      setupCompleted: setupCompleted?.value === 'true',
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', (req, res) => {
  try {
    // Token im Anfragetext (Altbestand, Skripte) hat Vorrang vor dem Cookie.
    const ausText = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : null;
    const refreshToken = ausText || tokenAusCookie(req);
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const tokenRecord = authService.validateRefreshToken(refreshToken);
    if (!tokenRecord) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(tokenRecord.user_id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Rotieren: altes Token in die Schonfrist schieben, neues ausgeben.
    authService.retireRefreshToken(refreshToken);
    const newRefreshToken = authService.generateRefreshToken();
    const sitzung = authService.storeRefreshToken(user.id, newRefreshToken, {
      sitzung: tokenRecord.sitzung, begonnen: tokenRecord.begonnen, geraet: req.headers['user-agent'], ip: clientIp(req),
    });
    const newAccessToken = authService.generateAccessToken(user, sitzung);

    setzeCookie(req, res, newRefreshToken);
    res.json({
      accessToken: newAccessToken,
      ...(istBrowser(req) ? {} : { refreshToken: newRefreshToken }),
      user: { id: user.id, username: user.username },
    });
  } catch (error) {
    console.error('Token refresh error:', error.message);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const ausText = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : null;
  for (const token of [ausText, tokenAusCookie(req)]) {
    const sitzung = token && authService.revokeRefreshToken(token);
    if (sitzung) schliesseSitzung(sitzung);
  }
  loescheCookie(req, res);
  res.json({ ok: true });
});

// PUT /api/auth/password
router.put('/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Aktuelles und neues Passwort erforderlich' });
    }
    if (newPassword.length < 12) {
      return res.status(400).json({ error: 'Passwort muss mindestens 12 Zeichen lang sein' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    const valid = await authService.verifyPassword(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Aktuelles Passwort ist falsch' });
    }

    const newHash = await authService.hashPassword(newPassword);
    // tokens_valid_after mitsetzen: sonst bleibt ein bereits ausgestelltes
    // Access-Token noch bis zu 24 Stunden gültig. Ein Passwortwechsel ist die
    // erste Reaktion auf einen Verdacht — er muss auch laufende Sitzungen
    // beenden, nicht nur die Refresh-Token.
    db.prepare("UPDATE users SET password_hash = ?, tokens_valid_after = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(newHash, user.id);
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('setup_completed', 'true')").run();

    // Revoke all refresh tokens - force re-login
    authService.revokeAllUserTokens(user.id);
    // Offene Terminals und Live-Verbindungen sofort trennen.
    schliesseSitzungen(user.id);

    logAudit('auth.password_change', req.user.username, null, req.user.id);
    loescheCookie(req, res);

    res.json({ ok: true, message: 'Passwort geändert. Bitte erneut anmelden.' });
  } catch (error) {
    console.error('Password change error:', error.message);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// ── Angemeldete Geräte ──
router.get('/sessions', authenticateToken, (req, res) => {
  res.json(authService.listeSitzungen(req.user.id).map(s => ({ ...s, aktuell: s.id === req.user.sid })));
});

// Alle außer dem eigenen Gerät abmelden
router.post('/sessions/others', authenticateToken, (req, res) => {
  if (!req.user.sid) return res.status(409).json({ error: 'Bitte die Seite neu laden und erneut versuchen' });
  const beendet = authService.beendeAndereSitzungen(req.user.id, req.user.sid);
  beendet.forEach(schliesseSitzung);
  logAudit('auth.sessions_revoked', req.user.username, { anzahl: beendet.length }, req.user.id);
  res.json({ ok: true, beendet: beendet.length });
});

router.delete('/sessions/:id', authenticateToken, (req, res) => {
  if (!authService.beendeSitzungVon(req.user.id, req.params.id)) return res.status(404).json({ error: 'Sitzung nicht gefunden' });
  schliesseSitzung(req.params.id);
  logAudit('auth.sessions_revoked', req.user.username, { anzahl: 1 }, req.user.id);
  res.json({ ok: true });
});

// GET /api/auth/status
router.get('/status', authenticateToken, (req, res) => {
  const db = getDb();
  const setupCompleted = db.prepare("SELECT value FROM settings WHERE key = 'setup_completed'").get();
  res.json({
    authenticated: true,
    user: { id: req.user.id, username: req.user.username },
    setupCompleted: setupCompleted?.value === 'true',
  });
});

export default router;
