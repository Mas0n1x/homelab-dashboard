import { Router } from 'express';
import { getDb } from '../services/database.js';
import { authenticateToken } from '../middleware/auth.js';
import * as authService from '../services/auth.js';
import { logAudit } from '../services/audit.js';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    const valid = await authService.verifyPassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    const accessToken = authService.generateAccessToken(user);
    const refreshToken = authService.generateRefreshToken();
    authService.storeRefreshToken(user.id, refreshToken);

    const setupCompleted = db.prepare("SELECT value FROM settings WHERE key = 'setup_completed'").get();

    logAudit('auth.login', user.username, null, user.id);

    res.json({
      accessToken,
      refreshToken,
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
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
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

    // Rotate: revoke old, issue new
    authService.revokeRefreshToken(refreshToken);
    const newAccessToken = authService.generateAccessToken(user);
    const newRefreshToken = authService.generateRefreshToken();
    authService.storeRefreshToken(user.id, newRefreshToken);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: { id: user.id, username: user.username },
    });
  } catch (error) {
    console.error('Token refresh error:', error.message);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    authService.revokeRefreshToken(refreshToken);
  }
  res.json({ ok: true });
});

// PUT /api/auth/password
router.put('/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Aktuelles und neues Passwort erforderlich' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen lang sein' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    const valid = await authService.verifyPassword(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Aktuelles Passwort ist falsch' });
    }

    const newHash = await authService.hashPassword(newPassword);
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(newHash, user.id);
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('setup_completed', 'true')").run();

    // Revoke all refresh tokens - force re-login
    authService.revokeAllUserTokens(user.id);

    logAudit('auth.password_change', req.user.username, null, req.user.id);

    res.json({ ok: true, message: 'Passwort geändert. Bitte erneut anmelden.' });
  } catch (error) {
    console.error('Password change error:', error.message);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
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
