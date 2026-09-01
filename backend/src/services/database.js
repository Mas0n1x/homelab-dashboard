/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { readFile, rename } from 'fs/promises';

const DB_PATH = process.env.DB_PATH || '/app/data/dashboard.db';
const CONFIG_PATH = process.env.CONFIG_PATH || '/app/data/config.json';

let db;

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

export function initDatabase() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      is_local INTEGER DEFAULT 0,
      glances_url TEXT,
      docker_socket TEXT,
      docker_host TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS manual_services (
      id TEXT PRIMARY KEY,
      server_id TEXT REFERENCES servers(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      icon TEXT DEFAULT 'link',
      description TEXT DEFAULT '',
      category TEXT DEFAULT 'Extern',
      sort_order INTEGER DEFAULT 999,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS service_overrides (
      service_id TEXT NOT NULL,
      server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      name TEXT,
      icon TEXT,
      url TEXT,
      description TEXT,
      category TEXT,
      sort_order INTEGER,
      hidden INTEGER DEFAULT 0,
      PRIMARY KEY (service_id, server_id)
    );

    CREATE TABLE IF NOT EXISTS uptime_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id TEXT NOT NULL,
      server_id TEXT NOT NULL,
      online INTEGER NOT NULL,
      response_time INTEGER DEFAULT 0,
      status_code INTEGER,
      checked_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_uptime_service_time ON uptime_checks(service_id, checked_at);
    CREATE INDEX IF NOT EXISTS idx_uptime_server_time ON uptime_checks(server_id, checked_at);

    CREATE TABLE IF NOT EXISTS metrics_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      server_id TEXT NOT NULL,
      cpu REAL,
      mem REAL,
      disk REAL,
      rx REAL,
      tx REAL,
      ts TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_metrics_server_time ON metrics_history(server_id, ts);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS favorites (
      service_id TEXT NOT NULL,
      server_id TEXT NOT NULL DEFAULT 'local',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (service_id, server_id)
    );

    CREATE TABLE IF NOT EXISTS speedtest_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      download REAL NOT NULL,
      upload REAL NOT NULL,
      ping REAL NOT NULL,
      server TEXT,
      tested_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS alert_channels (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      webhook_url TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      events TEXT DEFAULT '["container_crash","service_offline","cpu_high"]',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS alert_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT,
      event_type TEXT NOT NULL,
      message TEXT NOT NULL,
      sent_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      icon TEXT DEFAULT 'link',
      category TEXT DEFAULT 'Allgemein',
      sort_order INTEGER DEFAULT 999,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      pinned INTEGER DEFAULT 0,
      color TEXT DEFAULT 'default',
      updated_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Aufgaben-Tracker (Todos mit Priorität, Fälligkeit, Projekt und Checkliste)
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      notes TEXT DEFAULT '',
      status TEXT DEFAULT 'open',
      priority TEXT DEFAULT 'medium',
      project TEXT DEFAULT '',
      due_date TEXT,
      sort_order INTEGER DEFAULT 0,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status_order ON tasks(status, sort_order);
    CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);

    CREATE TABLE IF NOT EXISTS task_subtasks (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      done INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_task_subtasks_task ON task_subtasks(task_id);

    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      date TEXT NOT NULL,
      time TEXT,
      color TEXT DEFAULT 'indigo',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS container_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      image TEXT NOT NULL,
      ports TEXT DEFAULT '[]',
      env TEXT DEFAULT '[]',
      volumes TEXT DEFAULT '[]',
      restart_policy TEXT DEFAULT 'unless-stopped',
      category TEXT DEFAULT 'Allgemein',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expiry ON refresh_tokens(expires_at);

    -- Mail: Credentials per dashboard user (DEPRECATED - use mail_accounts)
    CREATE TABLE IF NOT EXISTS mail_credentials (
      user_id INTEGER PRIMARY KEY,
      email TEXT NOT NULL,
      password_encrypted TEXT NOT NULL,
      account_id TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Mail: Multi-account support
    CREATE TABLE IF NOT EXISTS mail_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      password_encrypted TEXT NOT NULL,
      account_id TEXT,
      display_name TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 0,
      added_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, email)
    );

    CREATE INDEX IF NOT EXISTS idx_mail_accounts_user ON mail_accounts(user_id);
    CREATE INDEX IF NOT EXISTS idx_mail_accounts_active ON mail_accounts(user_id, is_active);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      target TEXT,
      details TEXT,
      user_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'running',
      size INTEGER,
      path TEXT,
      error TEXT,
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );
  `);

  // Business-Anfragen (SaleNet/Portfolio) lokal als "erledigt" markieren —
  // die Quell-DBs sind readonly bzw. extern, daher wird nur hier ausgeblendet.
  db.exec(`
    CREATE TABLE IF NOT EXISTS dismissed_requests (
      ref TEXT PRIMARY KEY,
      dismissed_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migration: SSH-Spalten für sicheren Remote-Docker-Zugriff (ohne offenen Port)
  const serverCols = db.prepare('PRAGMA table_info(servers)').all().map(c => c.name);
  const sshCols = [
    ['ssh_host', 'TEXT'],
    ['ssh_port', 'INTEGER'],
    ['ssh_user', 'TEXT'],
    ['ssh_key_path', 'TEXT'],
  ];
  for (const [col, type] of sshCols) {
    if (!serverCols.includes(col)) {
      db.exec(`ALTER TABLE servers ADD COLUMN ${col} ${type}`);
    }
  }

  // Migration: Betriebs-/Kosten-Metadaten je Server (Fleet-Betriebskarte)
  const metaCols = [
    ['provider', 'TEXT'],
    ['location', 'TEXT'],
    ['monthly_cost', 'REAL'],
    ['currency', 'TEXT'],
    ['expires_at', 'TEXT'],
    ['tunnel_name', 'TEXT'],
    ['notes', 'TEXT'],
  ];
  for (const [col, type] of metaCols) {
    if (!serverCols.includes(col)) {
      db.exec(`ALTER TABLE servers ADD COLUMN ${col} ${type}`);
    }
  }

  // Migration: Stichzeit, ab der Access-Token eines Benutzers gültig sind.
  // Ein Passwortwechsel widerrief bisher nur die Refresh-Token — ein bereits
  // gestohlenes Access-Token blieb volle 24 Stunden gültig. Beim Wechsel wird
  // dieser Wert hochgesetzt, die Middleware verwirft dann alles Ältere.
  const userCols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  if (!userCols.includes('tokens_valid_after')) {
    db.exec('ALTER TABLE users ADD COLUMN tokens_valid_after TEXT');
  }

  // Ensure local server exists
  const localServer = db.prepare('SELECT id FROM servers WHERE id = ?').get('local');
  if (!localServer) {
    const glancesUrl = process.env.GLANCES_URL || 'http://host.docker.internal:61208';
    db.prepare(
      'INSERT INTO servers (id, name, host, is_local, glances_url, docker_socket) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('local', 'Raspberry Pi 5', '192.168.2.103', 1, glancesUrl, '/var/run/docker.sock');
  }

  // Migrate mail credentials to multi-account table
  migrateMailCredentials();

  return db;
}

export async function migrateFromConfigJson() {
  if (!existsSync(CONFIG_PATH)) return;

  try {
    const data = await readFile(CONFIG_PATH, 'utf8');
    const config = JSON.parse(data);

    if (!config.services || config.services.length === 0) return;

    const insert = db.prepare(
      'INSERT OR IGNORE INTO manual_services (id, server_id, name, url, icon, description, category) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    const insertMany = db.transaction((services) => {
      for (const s of services) {
        insert.run(
          `migrated-${s.id}`,
          'local',
          s.name,
          s.url,
          s.icon || 'link',
          s.description || '',
          'Allgemein'
        );
      }
    });

    insertMany(config.services);
    await rename(CONFIG_PATH, CONFIG_PATH + '.migrated');
    console.log(`Migrated ${config.services.length} services from config.json to SQLite`);
  } catch (error) {
    console.error('Error migrating config.json:', error.message);
  }
}

export function migrateMailCredentials() {
  // Check if migration already ran
  const migrated = db.prepare("SELECT value FROM settings WHERE key = 'mail_migration_v1'").get();
  if (migrated?.value === 'true') return;

  console.log('Running mail credentials migration...');

  try {
    // Migrate existing credentials to new table
    const existing = db.prepare('SELECT * FROM mail_credentials').all();

    if (existing.length > 0) {
      const insert = db.prepare(`
        INSERT OR IGNORE INTO mail_accounts (user_id, email, password_encrypted, account_id, is_active, sort_order)
        VALUES (?, ?, ?, ?, 1, 0)
      `);

      db.transaction(() => {
        for (const cred of existing) {
          insert.run(cred.user_id, cred.email, cred.password_encrypted, cred.account_id);
        }
        // Mark migration complete
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('mail_migration_v1', 'true')").run();
      })();

      console.log(`✓ Migrated ${existing.length} mail account(s) to new schema`);
    } else {
      // No data to migrate, just mark as complete
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('mail_migration_v1', 'true')").run();
      console.log('✓ No mail accounts to migrate');
    }
  } catch (error) {
    console.error('Failed to migrate mail credentials:', error.message);
  }
}

export function cleanupOldUptimeData() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const result = db.prepare('DELETE FROM uptime_checks WHERE checked_at < ?').run(thirtyDaysAgo);
  if (result.changes > 0) {
    console.log(`Cleaned up ${result.changes} old uptime records`);
  }
}
