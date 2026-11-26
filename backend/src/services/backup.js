/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { getDb } from './database.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, statSync, copyFileSync, readFileSync, mkdtempSync, rmSync, cpSync } from 'fs';
import { cp } from 'fs/promises';
import { tmpdir } from 'os';
import Database from 'better-sqlite3';

// Async statt execSync: tar synchron würde den kompletten Event-Loop bis zu
// 120 s blockieren (keine HTTP-/WS-Antworten, alle Hintergrundjobs eingefroren).
const execAsync = promisify(exec);
import { basename, dirname, join, resolve } from 'path';
import { Client as SSHClient } from 'ssh2';
import { logAudit } from './audit.js';
import { notify } from './alerting.js';
import { begleiter, loescheSicherung, veralteteDateien } from './backupDateien.js';
import { sichereBotDatenbanken } from './botSicherung.js';
import { testeBackup } from './backupTest.js';

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

const dbPfad = () => resolve(process.env.DB_PATH || '/app/data/dashboard.db');

/**
 * Beim Start aufrufen: ein Lauf mit Status „running“ kann dann nicht mehr laufen.
 * Bliebe er stehen, würde er jedes weitere Backup blockieren.
 */
export function markiereAbgebrocheneBackups() {
  return getDb().prepare(
    "UPDATE backups SET status = 'failed', error = 'Durch Neustart abgebrochen', completed_at = datetime('now') WHERE status = 'running'"
  ).run().changes;
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
        backupPath = join(BACKUP_DIR, `dashboard-${timestamp}.db`);
        // Eingebaute Online-Backup-API von better-sqlite3 (kein sqlite3-CLI im
        // Container nötig, WAL-konsistent über dieselbe Verbindung).
        await db.backup(backupPath);
        size = statSync(backupPath).size;
        break;
      }
      case 'full': {
        const dbPath = dbPfad();
        const datenDir = dirname(dbPath);
        backupPath = join(BACKUP_DIR, `full-backup-${timestamp}.tar.gz`);
        // Die laufende Datenbank darf nicht roh in das Archiv: erst die Dateien
        // ohne sie zusammenstellen, dann einen in sich stimmigen Stand dazulegen.
        const ablage = mkdtempSync(join(tmpdir(), 'backup-'));
        try {
          await cp(datenDir, ablage, {
            recursive: true,
            filter: (quelle) => resolve(quelle) === datenDir
              || (basename(quelle) !== 'backups' && !resolve(quelle).startsWith(dbPath)),
          });
          await db.backup(join(ablage, basename(dbPath)));
          await execAsync(`tar -czf "${backupPath}" -C "${ablage}" .`, { timeout: 120000 });
        } finally {
          rmSync(ablage, { recursive: true, force: true });
        }
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

    // Bot-Datenbanken dazulegen; scheitert das, bleibt das Hauptbackup gültig.
    const hinweis = await sichereBotDatenbanken(backupPath);
    if (hinweis) db.prepare('UPDATE backups SET note = ? WHERE id = ?').run(hinweis, backupId);

    // Off-Site-Kopie (falls konfiguriert), nicht-blockierend
    copyOffsite([backupPath, ...begleiter(backupPath)]).catch(e => {
      console.error('Offsite-Kopie fehlgeschlagen:', e.message);
      merkeOffsite({ ok: false, error: e.message });
    });

    // Restore-Test im Hintergrund; nur ein Fehlschlag meldet sich.
    testeBackup(backupId).then((t) => {
      if (t.ok) return null;
      return notify('backup_failed', {
        title: '⚠️ Restore-Test fehlgeschlagen',
        message: `Das neue ${TYPE_LABEL[type] || type}-Backup lässt sich nicht prüfen.`,
        color: 0xff4444,
        fields: [{ name: 'Ergebnis', value: String(t.detail).substring(0, 1000), inline: false }],
      });
    }).catch(e => console.error('Restore-Test:', e.message));

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

  const toDelete = new Map();

  // Grenze 1: Stückzahl — höchstens MAX_BACKUPS je Art.
  for (const backup of oldBackups.slice(MAX_BACKUPS)) {
    toDelete.set(backup.id, backup);
  }

  // Grenze 2: Alter. Das JÜNGSTE Backup bleibt immer stehen, auch wenn es die
  // Frist reißt — sonst stünde man nach einer längeren Pause ganz ohne Sicherung
  // da, und genau dafür ist sie ja gedacht.
  const { retentionDays } = getBackupSchedule();
  if (retentionDays > 0 && oldBackups.length > 1) {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    for (const backup of oldBackups.slice(1)) {
      const ts = Date.parse(String(backup.completed_at || backup.started_at || '').replace(' ', 'T') + 'Z');
      if (!Number.isNaN(ts) && ts < cutoff) toDelete.set(backup.id, backup);
    }
  }

  for (const backup of toDelete.values()) {
    loescheSicherung(backup.path);
    db.prepare('DELETE FROM backups WHERE id = ?').run(backup.id);
  }

  return toDelete.size;
}

/**
 * Aufbewahrungsfrist über ALLE Backup-Arten durchsetzen — auch dann, wenn
 * gerade kein neues Backup läuft. Ohne das würden alte Dateien bei
 * abgeschaltetem Zeitplan ewig liegen bleiben, weil das Aufräumen bisher nur
 * am Ende eines Backup-Laufs hing.
 */
export function enforceBackupRetention() {
  const db = getDb();
  const types = db.prepare("SELECT DISTINCT type FROM backups WHERE status = 'completed'").all();
  let removed = 0;
  for (const t of types) removed += cleanupOldBackups(t.type);
  return removed;
}

// Einzelnes Backup samt Datei löschen.
export function deleteBackup(id, userId = null) {
  const db = getDb();
  const backup = db.prepare('SELECT * FROM backups WHERE id = ?').get(id);
  if (!backup) throw new Error('Backup nicht gefunden');
  if (backup.status === 'running') throw new Error('Laufendes Backup kann nicht gelöscht werden');

  loescheSicherung(backup.path);
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

// retentionDays: Backups, die älter sind, werden automatisch gelöscht.
// 0 = nur die Stückzahl-Grenze (MAX_BACKUPS) greift.
const DEFAULT_SCHEDULE = { enabled: false, type: 'database', intervalHours: 24, retentionDays: 7 };

// Prüft die zurückzuspielende Datenbank und führt dabei ein mitgesichertes WAL ein.
function pruefeDatenbank(pfad) {
  if (!existsSync(pfad)) throw new Error('Backup enthält keine Datenbank');
  const kopie = new Database(pfad);
  try {
    const ergebnis = kopie.pragma('quick_check', { simple: true });
    if (ergebnis !== 'ok') throw new Error(`Datenbank im Backup ist beschädigt: ${ergebnis}`);
    kopie.pragma('wal_checkpoint(TRUNCATE)');
  } finally {
    kopie.close();
  }
}

// Backup wiederherstellen. Erst wird alles bereitgelegt und geprüft, dann die
// laufende Datenbank geschlossen, ersetzt und das Backend neu gestartet.
export async function restoreBackup(id, userId = null, { neustart = () => process.exit(0), verzoegerungMs = 800 } = {}) {
  const db = getDb();
  const backup = db.prepare('SELECT * FROM backups WHERE id = ?').get(id);
  if (!backup) throw new Error('Backup nicht gefunden');
  if (backup.status !== 'completed' || !backup.path || !existsSync(backup.path)) {
    throw new Error('Backup-Datei nicht verfügbar');
  }
  if (!['database', 'full'].includes(backup.type)) throw new Error('Unbekannter Backup-Typ');

  const dbPath = dbPfad();
  ensureBackupDir();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  // Sicherheitskopie des aktuellen Standes — ohne sie wird nichts überschrieben.
  await db.backup(join(BACKUP_DIR, `pre-restore-${ts}.db`));

  const ablage = mkdtempSync(join(tmpdir(), 'restore-'));
  try {
    if (backup.type === 'database') copyFileSync(backup.path, join(ablage, basename(dbPath)));
    else await execAsync(`tar -xzf "${backup.path}" -C "${ablage}"`, { timeout: 120000 });
    pruefeDatenbank(join(ablage, basename(dbPath)));
  } catch (error) {
    rmSync(ablage, { recursive: true, force: true });
    throw error;
  }

  logAudit('backup.restore', backup.type, { id, path: backup.path }, userId);

  // Verzögert, damit die Antwort noch rausgeht. Ab db.close() läuft alles
  // synchron — kein anderer Zugriff kann dazwischenkommen.
  setTimeout(() => {
    try {
      db.close();
      for (const ext of ['-wal', '-shm']) rmSync(dbPath + ext, { force: true });
      cpSync(ablage, dirname(dbPath), { recursive: true, force: true, filter: (q) => !/-(wal|shm)$/.test(q) });
    } catch (error) {
      console.error('Wiederherstellung fehlgeschlagen:', error.message);
    } finally {
      rmSync(ablage, { recursive: true, force: true });
      neustart();
    }
  }, verzoegerungMs);
  return { success: true, restart: true };
}

function merkeOffsite(stand) {
  getDb().prepare("INSERT INTO settings (key, value) VALUES ('offsite_status', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(JSON.stringify({ am: new Date().toISOString(), ...stand }));
}

export function getOffsiteStatus() {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'offsite_status'").get();
  try { return row?.value ? JSON.parse(row.value) : null; } catch { return null; }
}

const alsPromise = (fn) => new Promise((resolve, reject) => fn((err, wert) => (err ? reject(err) : resolve(wert))));

// Off-Site-Kopie eines Backups auf einen Fleet-Server via SFTP (ssh2), danach
// dort Abgelaufenes entfernen — sonst läuft das Ziel mit der Zeit voll.
async function copyOffsite(dateien) {
  const db = getDb();
  const cfg = getOffsiteConfig();
  if (!cfg.enabled || !cfg.serverId) return;
  const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(cfg.serverId);
  if (!server?.ssh_host) throw new Error('Zielserver ohne SSH-Zugang');
  const keyPath = server.ssh_key_path || process.env.SSH_KEY_PATH || '/app/ssh/id_ed25519';
  if (!existsSync(keyPath)) throw new Error(`SSH-Schlüssel fehlt (${keyPath})`);
  const remoteDir = (cfg.path || '/root/dashboard-backups').replace(/\/$/, '');

  const conn = new SSHClient();
  try {
    await new Promise((resolve, reject) => {
      conn.on('ready', resolve).on('error', reject).connect({
        host: server.ssh_host,
        port: server.ssh_port || 22,
        username: server.ssh_user || 'root',
        privateKey: readFileSync(keyPath),
        readyTimeout: 15000,
      });
    });
    const quoted = `'${remoteDir.replace(/'/g, `'\\''`)}'`;
    await new Promise((resolve, reject) => {
      conn.exec(`mkdir -p ${quoted}`, (err, stream) => {
        if (err) return reject(err);
        stream.on('close', (code) => (code ? reject(new Error(`Zielordner nicht anlegbar (${remoteDir})`)) : resolve()));
        stream.resume();
        stream.stderr.resume();
      });
    });
    const sftp = await alsPromise((cb) => conn.sftp(cb));
    for (const datei of dateien) {
      await alsPromise((cb) => sftp.fastPut(datei, `${remoteDir}/${basename(datei)}`, cb));
    }
    const vorhanden = await alsPromise((cb) => sftp.readdir(remoteDir, cb));
    const weg = veralteteDateien(vorhanden.map((e) => e.filename), {
      retentionDays: getBackupSchedule().retentionDays,
      max: MAX_BACKUPS,
    });
    for (const name of weg) await alsPromise((cb) => sftp.unlink(`${remoteDir}/${name}`, cb));
    merkeOffsite({ ok: true, dateien: dateien.length, entfernt: weg.length });
    logAudit('backup.offsite', basename(dateien[0]), { server: cfg.serverId, entfernt: weg.length }, null);
  } finally {
    conn.end();
  }
}

export function getOffsiteConfig() {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'offsite_config'").get();
  return row?.value ? JSON.parse(row.value) : { enabled: false, serverId: '', path: '/root/dashboard-backups' };
}

export function setOffsiteConfig(cfg = {}) {
  const db = getDb();
  const clean = { enabled: !!cfg.enabled, serverId: cfg.serverId || '', path: cfg.path || '/root/dashboard-backups' };
  db.prepare("INSERT INTO settings (key, value) VALUES ('offsite_config', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(clean));
  return clean;
}

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
  merged.retentionDays = Math.max(0, Math.min(365, Number(merged.retentionDays) || 0));
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
