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
  `);

  // Ensure local server exists
  const localServer = db.prepare('SELECT id FROM servers WHERE id = ?').get('local');
  if (!localServer) {
    const glancesUrl = process.env.GLANCES_URL || 'http://host.docker.internal:61208';
    db.prepare(
      'INSERT INTO servers (id, name, host, is_local, glances_url, docker_socket) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('local', 'Raspberry Pi 5', '192.168.2.103', 1, glancesUrl, '/var/run/docker.sock');
  }

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

export function cleanupOldUptimeData() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const result = db.prepare('DELETE FROM uptime_checks WHERE checked_at < ?').run(thirtyDaysAgo);
  if (result.changes > 0) {
    console.log(`Cleaned up ${result.changes} old uptime records`);
  }
}
