/*
 * Homelab Dashboard — Bot-Runtime (SaleNet-Bot)
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 *
 * Adaptierte, schlanke DB für den ausgelagerten SaleNet-Bot. Enthält nur die
 * Tabellen, die der Bot braucht (settings + Bot-Tabellen + products/audit_logs
 * für die geerbten Models). Die eigentliche SaleNet-DB bleibt unangetastet in
 * SaleNet; Produkte werden hierhin gespiegelt (siehe /salenet/sync-products).
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.SALENET_DB_PATH
  || path.join(process.env.BOT_DATA_DIR || '/app/data', 'salenet.db');

try { fs.mkdirSync(path.dirname(dbPath), { recursive: true }); } catch { /* egal */ }

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    ip_address TEXT,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    monthly_price REAL,
    yearly_price REAL,
    stripe_monthly_price_id TEXT,
    stripe_yearly_price_id TEXT,
    features TEXT,
    position INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bot_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    payload TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_bot_logs_event ON bot_logs(event_type, created_at);

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT,
    category TEXT,
    status TEXT DEFAULT 'open',
    transcript TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    closed_by TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status, created_at);

  CREATE TABLE IF NOT EXISTS mod_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    target_user_id TEXT,
    target_username TEXT,
    moderator_user_id TEXT,
    moderator_username TEXT,
    reason TEXT,
    channel_id TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_mod_actions_target ON mod_actions(target_user_id, created_at);

  CREATE TABLE IF NOT EXISTS automod_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    pattern TEXT,
    action TEXT NOT NULL DEFAULT 'delete',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS github_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_full_name TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    events TEXT NOT NULL DEFAULT '[]',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_gh_subs_repo ON github_subscriptions(repo_full_name);
`);

// Migrationen aus SaleNet übernommen
try { db.exec('ALTER TABLE products ADD COLUMN icon TEXT DEFAULT ""'); } catch { /* existiert */ }
try { db.exec('ALTER TABLE products ADD COLUMN is_featured INTEGER DEFAULT 0'); } catch { /* existiert */ }

module.exports = db;
