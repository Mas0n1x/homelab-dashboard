/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { getDb } from './database.js';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, statSync, unlinkSync } from 'fs';
import { basename, join } from 'path';
import { logAudit } from './audit.js';
import { notify } from './alerting.js';

const BACKUP_DIR = process.env.BACKUP_DIR || '/app/data/backups';
const MAX_BACKUPS = 10;

function fmtBytes(b) {
  if (!b || b <= 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = b, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${u[i]}`;
}

const TYPE_LABEL = { database: 'Datenbank', full: 'Vollständig' };

function ensureBackupDir() {
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

export function getBackups(limit = 20) {
  const db = getDb();
  return db.prepare('SELECT * FROM backups ORDER BY started_at DESC LIMIT ?').all(limit);
}

export function getBackupStatus() {
  const db = getDb();
  const running = db.prepare("SELECT * FROM backups WHERE status = 'running'").get();
  const latest = db.prepare("SELECT * FROM backups WHERE status = 'completed' ORDER BY completed_at DESC LIMIT 1").get();
  return { running: !!running, latest };
}

export async function runBackup(type, userId = null) {
  const db = getDb();

  // Check if backup is already running
  const running = db.prepare("SELECT * FROM backups WHERE status = 'running'").get();
  if (running) {
    throw new Error('A backup is already running');
  }

  ensureBackupDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const result = db.prepare(
    "INSERT INTO backups (type, status, started_at) VALUES (?, 'running', datetime('now'))"
  ).run(type);
  const backupId = result.lastInsertRowid;

  try {
    let backupPath;
    let size;

    switch (type) {
      case 'database': {
        const dbPath = process.env.DB_PATH || '/app/data/dashboard.db';
        backupPath = join(BACKUP_DIR, `dashboard-${timestamp}.db`);
        // Use SQLite backup API via CLI
        execSync(`sqlite3 "${dbPath}" ".backup '${backupPath}'"`, { timeout: 30000 });
        size = statSync(backupPath).size;
        break;
      }
      case 'full': {
        const dbPath = process.env.DB_PATH || '/app/data/dashboard.db';
        backupPath = join(BACKUP_DIR, `full-backup-${timestamp}.tar.gz`);
        // Backup entire data directory excluding the backups folder
        execSync(`tar -czf "${backupPath}" --exclude='backups' -C /app/data .`, { timeout: 120000 });
        size = statSync(backupPath).size;
        break;
      }
      default:
        throw new Error(`Unknown backup type: ${type}`);
    }

    db.prepare(
      "UPDATE backups SET status = 'completed', size = ?, path = ?, completed_at = datetime('now') WHERE id = ?"
    ).run(size, backupPath, backupId);

    logAudit('backup.completed', type, { size, path: backupPath }, userId);

    // Cleanup old backups (keep MAX_BACKUPS)
    cleanupOldBackups(type);

    // Erfolgs-Benachrichtigung an alle Kanäle mit dem Event 'backup_completed'.
    notify('backup_completed', {
      title: '💾 Backup erstellt',
      message: `${TYPE_LABEL[type] || type}-Backup erfolgreich abgeschlossen.`,
      color: 0x00ff88,
      fields: [
        { name: 'Typ', value: TYPE_LABEL[type] || type, inline: true },
        { name: 'Größe', value: fmtBytes(size), inline: true },
      ],
    }).catch(() => {});

    return db.prepare('SELECT * FROM backups WHERE id = ?').get(backupId);
  } catch (error) {
    db.prepare(
      "UPDATE backups SET status = 'failed', error = ?, completed_at = datetime('now') WHERE id = ?"
    ).run(error.message, backupId);
    logAudit('backup.failed', type, { error: error.message }, userId);

    // Fehler-Benachrichtigung an alle Kanäle mit dem Event 'backup_failed'.
    notify('backup_failed', {
      title: '⚠️ Backup fehlgeschlagen',
      message: `Das ${TYPE_LABEL[type] || type}-Backup ist fehlgeschlagen.`,
      color: 0xff4444,
      fields: [{ name: 'Fehler', value: String(error.message).substring(0, 1000), inline: false }],
    }).catch(() => {});

    throw error;
  }
}

function cleanupOldBackups(type) {
  const db = getDb();
  const oldBackups = db.prepare(
    "SELECT * FROM backups WHERE type = ? AND status = 'completed' ORDER BY completed_at DESC"
  ).all(type);

  if (oldBackups.length > MAX_BACKUPS) {
    const toDelete = oldBackups.slice(MAX_BACKUPS);
    for (const backup of toDelete) {
      if (backup.path && existsSync(backup.path)) {
        try { unlinkSync(backup.path); } catch {}
      }
      db.prepare('DELETE FROM backups WHERE id = ?').run(backup.id);
    }
  }
}

// Einzelnes Backup samt Datei löschen.
export function deleteBackup(id, userId = null) {
  const db = getDb();
  const backup = db.prepare('SELECT * FROM backups WHERE id = ?').get(id);
  if (!backup) throw new Error('Backup nicht gefunden');
  if (backup.status === 'running') throw new Error('Laufendes Backup kann nicht gelöscht werden');

  if (backup.path && existsSync(backup.path)) {
    try { unlinkSync(backup.path); } catch {}
  }
  db.prepare('DELETE FROM backups WHERE id = ?').run(id);
  logAudit('backup.deleted', backup.type, { path: backup.path }, userId);
  return { success: true };
}

// Datei-Infos für den Download bereitstellen (mit Existenz-/Status-Prüfung).
export function getBackupFile(id) {
  const db = getDb();
  const backup = db.prepare('SELECT * FROM backups WHERE id = ?').get(id);
  if (!backup) throw new Error('Backup nicht gefunden');
  if (backup.status !== 'completed' || !backup.path) throw new Error('Backup ist nicht abgeschlossen');
  if (!existsSync(backup.path)) throw new Error('Backup-Datei existiert nicht mehr');
  return { path: backup.path, filename: basename(backup.path) };
}

// ==================== AUTOMATISCHE BACKUPS (ZEITPLAN) ====================

const DEFAULT_SCHEDULE = { enabled: false, type: 'database', intervalHours: 24 };

export function getBackupSchedule() {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'backup_schedule'").get();
  if (!row?.value) return { ...DEFAULT_SCHEDULE };
  try {
    return { ...DEFAULT_SCHEDULE, ...JSON.parse(row.value) };
  } catch {
    return { ...DEFAULT_SCHEDULE };
  }
}

export function setBackupSchedule(cfg = {}) {
  const db = getDb();
  const merged = { ...getBackupSchedule(), ...cfg };
  merged.enabled = !!merged.enabled;
  if (!['database', 'full'].includes(merged.type)) merged.type = 'database';
  merged.intervalHours = Math.max(1, Math.min(720, Number(merged.intervalHours) || 24));
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('backup_schedule', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(JSON.stringify(merged));
  logAudit('backup.schedule', merged.type, merged);
  return merged;
}

// Vom Hintergrund-Ticker aufgerufen: startet ein Backup, wenn der Zeitplan aktiv
// und seit dem letzten erfolgreichen Backup des Typs das Intervall verstrichen ist.
export async function runDueBackups() {
  const schedule = getBackupSchedule();
  if (!schedule.enabled) return;

  const db = getDb();
  const running = db.prepare("SELECT id FROM backups WHERE status = 'running'").get();
  if (running) return;

  const last = db.prepare(
    "SELECT completed_at FROM backups WHERE type = ? AND status = 'completed' ORDER BY completed_at DESC LIMIT 1"
  ).get(schedule.type);

  const intervalMs = schedule.intervalHours * 60 * 60 * 1000;
  if (last?.completed_at) {
    const lastMs = Date.parse(last.completed_at.replace(' ', 'T') + 'Z');
    if (!Number.isNaN(lastMs) && Date.now() - lastMs < intervalMs) return;
  }

  console.log(`[backup] Geplantes ${schedule.type}-Backup wird gestartet`);
  await runBackup(schedule.type, null);
}
