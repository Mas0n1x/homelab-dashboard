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
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

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

export function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

export function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

export function storeRefreshToken(userId, token) {
  const db = getDb();
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)').run(userId, hash, expiresAt);
}

export function validateRefreshToken(token) {
  const db = getDb();
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return db.prepare("SELECT * FROM refresh_tokens WHERE token_hash = ? AND expires_at > datetime('now')").get(hash) || null;
}

export function revokeRefreshToken(token) {
  const db = getDb();
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(hash);
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
  const result = db.prepare("DELETE FROM refresh_tokens WHERE expires_at < datetime('now')").run();
  if (result.changes > 0) {
    console.log(`Cleaned up ${result.changes} expired refresh tokens`);
  }
}
