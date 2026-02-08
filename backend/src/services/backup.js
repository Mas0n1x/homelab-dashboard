import { getDb } from './database.js';
import { execSync } from 'child_process';
import { existsSync, mkdirSync, statSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { logAudit } from './audit.js';

const BACKUP_DIR = process.env.BACKUP_DIR || '/app/data/backups';
const MAX_BACKUPS = 10;

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

    return db.prepare('SELECT * FROM backups WHERE id = ?').get(backupId);
  } catch (error) {
    db.prepare(
      "UPDATE backups SET status = 'failed', error = ?, completed_at = datetime('now') WHERE id = ?"
    ).run(error.message, backupId);
    logAudit('backup.failed', type, { error: error.message }, userId);
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
