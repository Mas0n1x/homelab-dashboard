/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Vorberechnete Stundenwerte der Verfügbarkeit. Die Statusseite rechnete sonst bei jedem
// Aufruf über Millionen Rohzeilen; so sind es wenige Zehntausend. Ein Trigger hält die
// Werte beim Einfügen aktuell, gelöscht wird zusammen mit den Rohdaten.

const stunde = (iso) => iso.slice(0, 13); // „2026-11-28T13“

export function initUptimeRollup(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS uptime_hourly (
      server_id TEXT NOT NULL,
      service_id TEXT NOT NULL,
      hour TEXT NOT NULL,
      total INTEGER NOT NULL,
      up INTEGER NOT NULL,
      rt_sum INTEGER NOT NULL,
      PRIMARY KEY (server_id, service_id, hour)
    ) WITHOUT ROWID;

    CREATE TABLE IF NOT EXISTS uptime_latest (
      server_id TEXT NOT NULL,
      service_id TEXT NOT NULL,
      online INTEGER NOT NULL,
      response_time INTEGER,
      checked_at TEXT NOT NULL,
      PRIMARY KEY (server_id, service_id)
    ) WITHOUT ROWID;
  `);

  // Der Trigger dient zugleich als Merker: Er entsteht in derselben Transaktion wie die
  // Erstbefüllung, ein abgebrochener Start holt beides vollständig nach.
  if (db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'trigger' AND name = 'trg_uptime_rollup'").get()) return;

  const start = Date.now();
  db.transaction(() => {
    db.exec(`
      DELETE FROM uptime_hourly;
      DELETE FROM uptime_latest;

      INSERT INTO uptime_hourly (server_id, service_id, hour, total, up, rt_sum)
      SELECT server_id, service_id, substr(checked_at, 1, 13), COUNT(*), SUM(online), SUM(COALESCE(response_time, 0))
      FROM uptime_checks GROUP BY 1, 2, 3;

      -- SQLite liefert bei MAX() die übrigen Spalten aus genau dieser Zeile.
      INSERT INTO uptime_latest (server_id, service_id, online, response_time, checked_at)
      SELECT server_id, service_id, online, response_time, MAX(checked_at)
      FROM uptime_checks GROUP BY server_id, service_id;

      CREATE TRIGGER trg_uptime_rollup AFTER INSERT ON uptime_checks BEGIN
        INSERT INTO uptime_hourly (server_id, service_id, hour, total, up, rt_sum)
        VALUES (NEW.server_id, NEW.service_id, substr(NEW.checked_at, 1, 13), 1, NEW.online, COALESCE(NEW.response_time, 0))
        ON CONFLICT (server_id, service_id, hour) DO UPDATE SET
          total = total + 1, up = up + excluded.up, rt_sum = rt_sum + excluded.rt_sum;

        INSERT INTO uptime_latest (server_id, service_id, online, response_time, checked_at)
        VALUES (NEW.server_id, NEW.service_id, NEW.online, NEW.response_time, NEW.checked_at)
        ON CONFLICT (server_id, service_id) DO UPDATE SET
          online = excluded.online, response_time = excluded.response_time, checked_at = excluded.checked_at
          WHERE excluded.checked_at >= uptime_latest.checked_at;
      END;
    `);
  })();
  console.log(`✓ Stundenwerte der Verfügbarkeit aufgebaut (${Date.now() - start} ms)`);
}

/** Summen je Server und Dienst seit `seitIso` (auf die volle Stunde gerundet). */
export function summenSeit(db, seitIso) {
  return db.prepare(`
    SELECT server_id, service_id, SUM(total) AS total, SUM(up) AS up, SUM(rt_sum) * 1.0 / SUM(total) AS rt
    FROM uptime_hourly WHERE hour >= ? GROUP BY server_id, service_id
  `).all(stunde(seitIso));
}

/** Tageswerte je Server und Dienst seit `seitIso`. */
export function tageSeit(db, seitIso) {
  return db.prepare(`
    SELECT server_id, service_id, substr(hour, 1, 10) AS day, SUM(total) AS total, SUM(up) AS up
    FROM uptime_hourly WHERE hour >= ? GROUP BY server_id, service_id, day
  `).all(stunde(seitIso));
}

export function letztePruefungen(db, seitIso) {
  return db.prepare('SELECT * FROM uptime_latest WHERE checked_at > ?').all(seitIso);
}

export function loescheRollupVor(db, grenzeIso) {
  db.prepare('DELETE FROM uptime_hourly WHERE hour < ?').run(stunde(grenzeIso));
  db.prepare('DELETE FROM uptime_latest WHERE checked_at < ?').run(grenzeIso);
}

export function loescheRollupFuer(db, serviceId, serverId) {
  db.prepare('DELETE FROM uptime_hourly WHERE service_id = ? AND server_id = ?').run(serviceId, serverId);
  db.prepare('DELETE FROM uptime_latest WHERE service_id = ? AND server_id = ?').run(serviceId, serverId);
}
