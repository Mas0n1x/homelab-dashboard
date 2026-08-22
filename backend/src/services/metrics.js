/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { getDb } from './database.js';

// Ein Metrik-Sample je Server persistieren (für Sparklines/Verlauf).
export function recordMetric(serverId, m) {
  if (!serverId) return;
  const db = getDb();
  db.prepare(
    'INSERT INTO metrics_history (server_id, cpu, mem, disk, rx, tx, ts) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    serverId,
    m.cpu ?? null,
    m.mem ?? null,
    m.disk ?? null,
    m.rx ?? null,
    m.tx ?? null,
    new Date().toISOString()
  );
}

// Verlauf der letzten N Minuten (aufsteigend nach Zeit).
export function getMetrics(serverId, minutes = 60) {
  const db = getDb();
  const since = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  return db.prepare(
    'SELECT cpu, mem, disk, rx, tx, ts FROM metrics_history WHERE server_id = ? AND ts > ? ORDER BY ts ASC'
  ).all(serverId, since);
}

// Retention: alte Samples entfernen (Standard 48h), damit die DB nicht wächst.
export function pruneMetrics(hours = 48) {
  const db = getDb();
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const r = db.prepare('DELETE FROM metrics_history WHERE ts < ?').run(cutoff);
  return r.changes;
}
