/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { getDb } from './database.js';
import { lineareRegression } from './regression.js';

// Rohdaten: ein Sample alle 30 s, 48 h lang. Daraus werden Stundenwerte
// berechnet, die 90 Tage bleiben — Grundlage für 7-/30-/90-Tage-Ansichten
// und die Speicherleck-Erkennung.
const HOURLY_KEEP_DAYS = 90;

let schemaOk = false;
function ensureSchema(db) {
  if (schemaOk) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS metrics_hourly (
      server_id TEXT NOT NULL,
      hour TEXT NOT NULL,
      cpu_avg REAL, cpu_max REAL,
      mem_avg REAL, mem_max REAL,
      disk_avg REAL,
      rx_avg REAL, tx_avg REAL,
      temp_max REAL,
      samples INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (server_id, hour)
    );
  `);
  const cols = db.prepare('PRAGMA table_info(metrics_history)').all().map(c => c.name);
  if (!cols.includes('temp')) db.exec('ALTER TABLE metrics_history ADD COLUMN temp REAL');
  schemaOk = true;
}

// Ein Metrik-Sample je Server persistieren (für Sparklines/Verlauf).
export function recordMetric(serverId, m) {
  if (!serverId) return;
  const db = getDb();
  ensureSchema(db);
  db.prepare(
    'INSERT INTO metrics_history (server_id, cpu, mem, disk, rx, tx, temp, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    serverId,
    m.cpu ?? null,
    m.mem ?? null,
    m.disk ?? null,
    m.rx ?? null,
    m.tx ?? null,
    m.temp ?? null,
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
  ensureSchema(db);
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const r = db.prepare('DELETE FROM metrics_history WHERE ts < ?').run(cutoff);
  const hourlyCutoff = new Date(Date.now() - HOURLY_KEEP_DAYS * 86400000).toISOString();
  db.prepare('DELETE FROM metrics_hourly WHERE hour < ?').run(hourlyCutoff);
  return r.changes;
}

/**
 * Rohsamples zu Stundenwerten verdichten.
 *
 * `hours` Stunden zurück, auf die volle Stunde ausgerichtet: ein angebrochenes
 * erstes Fenster würde sonst einen bereits vollständigen Stundenwert mit einem
 * Teilmittel überschreiben.
 */
export function rollupHourly(hours = 3) {
  const db = getDb();
  ensureSchema(db);
  const start = new Date(Date.now() - hours * 3600000);
  start.setUTCMinutes(0, 0, 0);
  db.prepare(`
    INSERT INTO metrics_hourly (server_id, hour, cpu_avg, cpu_max, mem_avg, mem_max, disk_avg, rx_avg, tx_avg, temp_max, samples)
    SELECT server_id, substr(ts, 1, 13) || ':00:00.000Z' AS h,
           AVG(cpu), MAX(cpu), AVG(mem), MAX(mem), AVG(disk), AVG(rx), AVG(tx), MAX(temp), COUNT(*)
    FROM metrics_history WHERE ts >= ? GROUP BY server_id, h
    ON CONFLICT(server_id, hour) DO UPDATE SET
      cpu_avg = excluded.cpu_avg, cpu_max = excluded.cpu_max,
      mem_avg = excluded.mem_avg, mem_max = excluded.mem_max,
      disk_avg = excluded.disk_avg, rx_avg = excluded.rx_avg, tx_avg = excluded.tx_avg,
      temp_max = excluded.temp_max, samples = excluded.samples
  `).run(start.toISOString());
}

const RANGES = {
  '1h': { minutes: 60 },
  '6h': { minutes: 360 },
  '24h': { minutes: 1440 },
  '7d': { hourly: 7 * 24 },
  '30d': { hourly: 30 * 24 },
  '90d': { hourly: 90 * 24 },
};
const MAX_POINTS = 240;

function bucket(rows, size, keys) {
  if (size <= 1) return rows;
  const out = [];
  for (let i = 0; i < rows.length; i += size) {
    const grp = rows.slice(i, i + size);
    const o = { ts: grp[Math.floor(grp.length / 2)].ts };
    for (const k of keys) {
      const vals = grp.map(r => r[k]).filter(v => v != null);
      if (!vals.length) { o[k] = null; continue; }
      o[k] = k.endsWith('Max') || k === 'temp'
        ? Math.max(...vals)
        : vals.reduce((s, v) => s + v, 0) / vals.length;
    }
    out.push(o);
  }
  return out;
}

/** Verlauf für die Charts: kurze Zeiträume aus Rohdaten, lange aus Stundenwerten. */
export function getMetricsRange(serverId, range = '24h') {
  const db = getDb();
  ensureSchema(db);
  const cfg = RANGES[range] || RANGES['24h'];
  const keys = ['cpu', 'mem', 'disk', 'rx', 'tx', 'temp', 'cpuMax', 'memMax'];

  let rows;
  if (cfg.minutes) {
    const since = new Date(Date.now() - cfg.minutes * 60000).toISOString();
    rows = db.prepare(
      'SELECT ts, cpu, mem, disk, rx, tx, temp FROM metrics_history WHERE server_id = ? AND ts > ? ORDER BY ts ASC'
    ).all(serverId, since).map(r => ({ ...r, cpuMax: r.cpu, memMax: r.mem }));
  } else {
    const since = new Date(Date.now() - cfg.hourly * 3600000).toISOString();
    rows = db.prepare(
      `SELECT hour AS ts, cpu_avg AS cpu, mem_avg AS mem, disk_avg AS disk, rx_avg AS rx, tx_avg AS tx,
              temp_max AS temp, cpu_max AS cpuMax, mem_max AS memMax
       FROM metrics_hourly WHERE server_id = ? AND hour > ? ORDER BY hour ASC`
    ).all(serverId, since);
  }
  const size = Math.ceil(rows.length / MAX_POINTS);
  return { range, points: bucket(rows, size, keys) };
}

// Ab dieser Steigung (Prozentpunkte RAM pro Tag) gilt ein Anstieg als Leck-Verdacht.
const LECK_STEIGUNG = 0.4;
const LECK_MIN_R2 = 0.6;
const TREND_MIN_TAGE = 3;
const TREND_FENSTER_TAGE = 14;

/**
 * Speicher-Trend je Server aus den Stundenwerten.
 *
 * Je Tag zählt der niedrigste Stundenmittelwert („Boden"): die normale
 * Tagesschwankung (Backups, Builds) fällt damit heraus, und nur ein dauerhaft
 * steigender Grundbedarf — das typische Speicherleck — bleibt übrig. Ein
 * Hinweis darauf: kswapd/middlewared auf der TrueNAS-VM hat so 3 GB in 16 Tagen
 * gefressen, ohne dass irgendein Schwellwert vorher anschlug.
 */
export function getMemoryTrends() {
  const db = getDb();
  ensureSchema(db);
  const since = new Date(Date.now() - TREND_FENSTER_TAGE * 86400000).toISOString();
  const servers = db.prepare('SELECT id, name FROM servers').all();
  const out = [];

  for (const s of servers) {
    const rows = db.prepare(
      'SELECT hour, mem_avg FROM metrics_hourly WHERE server_id = ? AND hour > ? AND mem_avg IS NOT NULL ORDER BY hour ASC'
    ).all(s.id, since);

    const proTag = new Map();
    for (const r of rows) {
      const tag = r.hour.slice(0, 10);
      const g = proTag.get(tag) || { n: 0, min: Infinity };
      g.n += 1;
      g.min = Math.min(g.min, r.mem_avg);
      proTag.set(tag, g);
    }
    // Angebrochene Tage (wenige Stunden) verfälschen den „Boden" — erst ab 12 Stunden.
    const tage = [...proTag.entries()].filter(([, g]) => g.n >= 12).map(([tag, g]) => ({ tag, boden: g.min }));

    const basis = {
      serverId: s.id, serverName: s.name, days: tage.length,
      current: rows.length ? rows[rows.length - 1].mem_avg : null,
      slopePerDay: null, r2: null, daysUntilFull: null, status: 'unbekannt',
      series: tage.map(t => ({ day: t.tag, value: Math.round(t.boden * 10) / 10 })),
    };
    if (tage.length < TREND_MIN_TAGE) { out.push(basis); continue; }

    const t0 = new Date(tage[0].tag).getTime();
    const punkte = tage.map(t => ({ x: (new Date(t.tag).getTime() - t0) / 86400000, y: t.boden }));
    const { steigung, r2 } = lineareRegression(punkte);
    basis.slopePerDay = Math.round(steigung * 100) / 100;
    basis.r2 = Math.round(r2 * 100) / 100;

    const letzter = tage[tage.length - 1].boden;
    if (steigung >= LECK_STEIGUNG && r2 >= LECK_MIN_R2) {
      basis.status = 'steigend';
      basis.daysUntilFull = letzter < 95 ? Math.max(1, Math.ceil((95 - letzter) / steigung)) : 0;
    } else if (steigung <= -LECK_STEIGUNG && r2 >= LECK_MIN_R2) {
      basis.status = 'fallend';
    } else {
      basis.status = 'stabil';
    }
    out.push(basis);
  }
  return out;
}
