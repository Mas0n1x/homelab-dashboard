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

    -- Tracker: Projects
    CREATE TABLE IF NOT EXISTS tracker_projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Tracker: Tasks
    CREATE TABLE IF NOT EXISTS tracker_tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      estimated_time INTEGER DEFAULT 25,
      actual_time INTEGER DEFAULT 0,
      status TEXT DEFAULT 'backlog',
      category TEXT DEFAULT '',
      labels TEXT DEFAULT '[]',
      project_id TEXT REFERENCES tracker_projects(id) ON DELETE SET NULL,
      subtasks TEXT DEFAULT '[]',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tracker_tasks_status ON tracker_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tracker_tasks_project ON tracker_tasks(project_id);

    -- Tracker: Player (single row)
    CREATE TABLE IF NOT EXISTS tracker_player (
      id INTEGER PRIMARY KEY DEFAULT 1,
      level INTEGER DEFAULT 1,
      xp INTEGER DEFAULT 0,
      total_xp INTEGER DEFAULT 0,
      streak INTEGER DEFAULT 0,
      last_active_date TEXT,
      daily_goal INTEGER DEFAULT 120,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Tracker: Achievements
    CREATE TABLE IF NOT EXISTS tracker_achievements (
      id TEXT PRIMARY KEY,
      unlocked_at TEXT DEFAULT (datetime('now'))
    );

    -- Tracker: Daily Stats
    CREATE TABLE IF NOT EXISTS tracker_daily_stats (
      date TEXT PRIMARY KEY,
      completed INTEGER DEFAULT 0,
      total_minutes INTEGER DEFAULT 0,
      categories TEXT DEFAULT '{}'
    );

    -- Tracker: Notes
    CREATE TABLE IF NOT EXISTS tracker_notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

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

  // Ensure local server exists
  const localServer = db.prepare('SELECT id FROM servers WHERE id = ?').get('local');
  if (!localServer) {
    const glancesUrl = process.env.GLANCES_URL || 'http://host.docker.internal:61208';
    db.prepare(
      'INSERT INTO servers (id, name, host, is_local, glances_url, docker_socket) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('local', 'Raspberry Pi 5', '192.168.2.103', 1, glancesUrl, '/var/run/docker.sock');
  }

  // Ensure tracker player row exists
  const playerExists = db.prepare('SELECT id FROM tracker_player WHERE id = 1').get();
  if (!playerExists) {
    db.prepare('INSERT INTO tracker_player (id) VALUES (1)').run();
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
