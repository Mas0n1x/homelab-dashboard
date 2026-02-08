import { getDb } from './database.js';

export function logAudit(action, target, details, userId = null) {
  const db = getDb();
  db.prepare(
    'INSERT INTO audit_log (action, target, details, user_id) VALUES (?, ?, ?, ?)'
  ).run(action, target || null, typeof details === 'object' ? JSON.stringify(details) : details || null, userId);
}

export function getAuditLog(limit = 50, offset = 0) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);
}
