/*
 * Homelab Dashboard — Bot-Runtime
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.BOT_DB_PATH || '/app/data/bots.db';

let db;

function initDb() {
  // Datenverzeichnis sicherstellen
  const dir = path.dirname(DB_PATH);
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* egal */ }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // ── Portfolio-Bot ────────────────────────────────────────────────
  // Key/Value-Store für die gesamte Bot-Konfiguration (1:1 aus dem Portfolio).
  db.exec(`
    CREATE TABLE IF NOT EXISTS discord_config (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS discord_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT,
      channel_id TEXT,
      message_id TEXT,
      user_id TEXT,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_discord_logs_type_time ON discord_logs(type, created_at);
  `);

  return db;
}

function getDb() {
  if (!db) throw new Error('Bot-DB nicht initialisiert');
  return db;
}

// ── Synchrone Helfer, kompatibel zur Portfolio-DiscordBot-Klasse ────
// Die Klasse ruft dbGet/dbAll/dbRun synchron mit (sql, paramsArray) auf —
// das entspricht exakt better-sqlite3 (prepare().get/all/run(...params)).
function dbGet(sql, params = []) {
  return getDb().prepare(sql).get(...params);
}

function dbAll(sql, params = []) {
  return getDb().prepare(sql).all(...params);
}

function dbRun(sql, params = []) {
  return getDb().prepare(sql).run(...params);
}

module.exports = { initDb, getDb, dbGet, dbAll, dbRun };
