/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { getDb } from './database.js';

export function logAudit(action, target, details, userId = null) {
  const db = getDb();
  // Achtung: typeof null === 'object' — null/undefined zuerst abfangen,
  // sonst landet der String "null" in der Spalte.
  let detailStr = null;
  if (details != null) {
    detailStr = typeof details === 'object' ? JSON.stringify(details) : String(details);
  }
  db.prepare(
    'INSERT INTO audit_log (action, target, details, user_id) VALUES (?, ?, ?, ?)'
  ).run(action, target || null, detailStr, userId);
}

export function getAuditLog(limit = 50, offset = 0) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);
}
