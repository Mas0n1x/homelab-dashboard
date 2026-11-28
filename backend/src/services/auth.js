/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getDb } from './database.js';

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '24h';
// 7 Tage waren der Grund für das ständige Neuanmelden am Handy: wer das
// Dashboard eine Woche nicht aufmacht, ist raus. 90 Tage, gleitend verlängert
// bei jeder Erneuerung.
const REFRESH_TOKEN_EXPIRY_DAYS = 90;

// Nach einer Erneuerung bleibt das alte Token noch kurz gültig. Ohne diese
// Schonfrist reicht EIN paralleler Aufruf (zweiter Tab, Wiederholung nach
// Netzwechsel), damit das gerade ersetzte Token abgelehnt wird und die Sitzung
// scheinbar grundlos endet.
const ROTATION_GRACE_SECONDS = 60;

// Kein Fallback-Default: mit bekanntem Secret könnte jeder gültige Tokens
// signieren (und es ist zugleich der Mail-Verschlüsselungs-Key). Fehlt es,
// wird der Start bewusst abgebrochen statt still unsicher weiterzulaufen.
export const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET ist nicht gesetzt. Start abgebrochen — bitte ein starkes JWT_SECRET in der .env setzen.');
}

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// `sid` bindet das Zugriffs-Token an seine Sitzung: wird das Gerät abgemeldet, ist es sofort ungültig.
export function generateAccessToken(user, sid) {
  return jwt.sign(
    { id: user.id, username: user.username, ...(sid ? { sid } : {}) },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

export function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');
// Ablaufzeiten stehen als ISO-Zeit in der Datenbank. Der Vergleich muss deshalb mit einer
// ISO-Zeit erfolgen: gegen datetime('now') („JJJJ-MM-TT hh:mm:ss“) galt wegen des „T“
// jedes am selben Tag abgelaufene Token weiter als gültig.
const jetztIso = () => new Date().toISOString();

export const neueSitzungsId = () => crypto.randomBytes(12).toString('hex');

export function storeRefreshToken(userId, token, { sitzung = neueSitzungsId(), geraet = '', ip = '', begonnen } = {}) {
  const db = getDb();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO refresh_tokens (user_id, token_hash, expires_at, sitzung, geraet, ip, begonnen, zuletzt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(userId, tokenHash(token), expiresAt, sitzung, String(geraet).slice(0, 300), String(ip).slice(0, 60), begonnen || jetztIso(), jetztIso());
  return sitzung;
}

export function validateRefreshToken(token) {
  return getDb().prepare('SELECT * FROM refresh_tokens WHERE token_hash = ? AND expires_at > ?').get(tokenHash(token), jetztIso()) || null;
}

/** Beendet die ganze Sitzung, zu der das Token gehört. Liefert deren Kennung. */
export function revokeRefreshToken(token) {
  const db = getDb();
  const zeile = db.prepare('SELECT sitzung FROM refresh_tokens WHERE token_hash = ?').get(tokenHash(token));
  if (!zeile) return null;
  db.prepare('DELETE FROM refresh_tokens WHERE sitzung = ? OR token_hash = ?').run(zeile.sitzung, tokenHash(token));
  return zeile.sitzung;
}

export function sitzungAktiv(sid) {
  return !!getDb().prepare('SELECT 1 FROM refresh_tokens WHERE sitzung = ? AND expires_at > ? LIMIT 1').get(sid, jetztIso());
}

/** Je angemeldetem Gerät eine Zeile (neueste Angaben). */
export function listeSitzungen(userId) {
  return getDb().prepare(`
    SELECT sitzung AS id, geraet, ip, begonnen, MAX(COALESCE(zuletzt, created_at)) AS zuletzt
    FROM refresh_tokens WHERE user_id = ? AND expires_at > ? GROUP BY sitzung ORDER BY zuletzt DESC
  `).all(userId, jetztIso());
}

export function beendeSitzungVon(userId, sid) {
  return getDb().prepare('DELETE FROM refresh_tokens WHERE user_id = ? AND sitzung = ?').run(userId, sid).changes > 0;
}

export function beendeAndereSitzungen(userId, behalten) {
  const andere = listeSitzungen(userId).map(s => s.id).filter(id => id !== behalten);
  getDb().prepare('DELETE FROM refresh_tokens WHERE user_id = ? AND sitzung IS NOT ?').run(userId, behalten);
  return andere;
}

/**
 * Altes Token nach der Erneuerung NICHT sofort löschen, sondern nur noch
 * kurz gültig lassen. Parallele Anfragen, die noch mit dem alten Token
 * unterwegs sind, laufen damit sauber durch, statt die Sitzung zu beenden.
 */
export function retireRefreshToken(token) {
  const db = getDb();
  const hash = tokenHash(token);
  const graceUntil = new Date(Date.now() + ROTATION_GRACE_SECONDS * 1000).toISOString();
  db.prepare(
    'UPDATE refresh_tokens SET expires_at = ? WHERE token_hash = ? AND expires_at > ?'
  ).run(graceUntil, hash, graceUntil);
}

export function revokeAllUserTokens(userId) {
  const db = getDb();
  db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
}

export async function ensureDefaultUser() {
  const db = getDb();
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count === 0) {
    // Zufälliges Erst-Passwort statt fest 'admin' — kein öffentlich bekanntes
    // Default-Login mehr. Wird genau einmal ins Log geschrieben.
    const initialPassword = crypto.randomBytes(9).toString('base64url');
    const hash = await hashPassword(initialPassword);
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run('admin', hash);
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('setup_completed', 'false');
    console.log('════════════════════════════════════════════════════');
    console.log('  Ersteinrichtung — Admin-Zugang wurde erstellt:');
    console.log('    Benutzer: admin');
    console.log(`    Passwort: ${initialPassword}`);
    console.log('  Bitte direkt nach dem ersten Login ändern.');
    console.log('════════════════════════════════════════════════════');
  }
}

export function cleanupExpiredTokens() {
  const db = getDb();
  const result = db.prepare('DELETE FROM refresh_tokens WHERE expires_at < ?').run(jetztIso());
  if (result.changes > 0) {
    console.log(`Cleaned up ${result.changes} expired refresh tokens`);
  }
}
