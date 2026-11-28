/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { getDb } from './database.js';
import { summenSeit } from './uptimeRollup.js';
import serverManager from './serverManager.js';
import { pruefeDienst } from './dienstPruefung.js';

export async function checkServiceHealth(serviceId, serverId, url, container = null) {
  if (!url) return;

  const db = getDb();
  const verbindung = serverManager.getConnection(serverId);
  const agent = verbindung?.sshAgent;
  const start = Date.now();
  const ergebnis = await pruefeDienst(url, {
    serverId,
    server: verbindung?.config,
    weiterleiten: agent?.weiterleiten,
    container,
    sprachHttp: !!db.prepare('SELECT 1 FROM uptime_http WHERE server_id = ? AND service_id = ?').get(serverId, serviceId),
  });
  const responseTime = Date.now() - start;

  // Nicht prüfbar: keine Messung erfinden, nur vermerken.
  if (ergebnis.zustand === 'unbekannt') {
    db.prepare('INSERT INTO uptime_unchecked (server_id, service_id, reason, since) VALUES (?, ?, ?, ?) ON CONFLICT (server_id, service_id) DO UPDATE SET reason = excluded.reason')
      .run(serverId, serviceId, ergebnis.grund || null, new Date().toISOString());
    return { serviceId, online: null, responseTime: 0, statusCode: 0 };
  }

  const online = ergebnis.zustand === 'online';
  if (ergebnis.statusCode > 0) db.prepare('INSERT OR IGNORE INTO uptime_http (server_id, service_id) VALUES (?, ?)').run(serverId, serviceId);
  db.prepare('DELETE FROM uptime_unchecked WHERE server_id = ? AND service_id = ?').run(serverId, serviceId);
  db.prepare(
    'INSERT INTO uptime_checks (service_id, server_id, online, response_time, status_code, checked_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(serviceId, serverId, online ? 1 : 0, responseTime, ergebnis.statusCode, new Date().toISOString());

  return { serviceId, online, responseTime, statusCode: ergebnis.statusCode };
}

export async function checkAllServices(services) {
  const results = await Promise.allSettled(
    services
      .filter(s => s.url)
      .map(s => checkServiceHealth(s.id, s.serverId || 'local', s.url, s.container || null))
  );

  return results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);
}

// Stunde als Schlüssel der Stundenwerte („2026-11-28T13“)
const seitStunde = (ms) => new Date(Date.now() - ms).toISOString().slice(0, 13);

export function getUptimePercent(serviceId, hours = 24) {
  const row = getDb().prepare('SELECT SUM(total) AS total, SUM(up) AS up FROM uptime_hourly WHERE service_id = ? AND hour >= ?')
    .get(serviceId, seitStunde(hours * 3600000));
  if (!row?.total) return null;
  return parseFloat(((row.up / row.total) * 100).toFixed(1));
}

// Einzelmessungen gibt es nur für die letzten 48 Stunden.
export function getUptimeHistory(serviceId, hours = 24) {
  const since = new Date(Date.now() - Math.min(hours, 48) * 3600000).toISOString();
  return getDb().prepare(
    'SELECT online, response_time, checked_at FROM uptime_checks WHERE service_id = ? AND checked_at > ? ORDER BY checked_at ASC'
  ).all(serviceId, since);
}

export function getUptimeTimeline(serviceId, days = 30) {
  const rows = getDb().prepare(`
    SELECT substr(hour, 1, 10) AS day, SUM(total) AS total, SUM(up) AS up, ROUND(SUM(rt_sum) * 1.0 / SUM(total)) AS rt
    FROM uptime_hourly WHERE service_id = ? AND hour >= ? GROUP BY day ORDER BY day ASC
  `).all(serviceId, seitStunde(days * 86400000));
  const nachTag = new Map(rows.map(r => [r.day, r]));

  const timeline = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayStr = date.toISOString().split('T')[0];
    const row = nachTag.get(dayStr);
    timeline.push({
      date: dayStr,
      uptime: row?.total ? parseFloat(((row.up / row.total) * 100).toFixed(1)) : null,
      checks: row?.total || 0,
      avgResponseTime: row?.rt || 0,
    });
  }

  const totalChecks = rows.reduce((sum, r) => sum + r.total, 0);
  const totalUp = rows.reduce((sum, r) => sum + r.up, 0);
  return {
    serviceId,
    days,
    timeline,
    overallUptime: totalChecks > 0 ? parseFloat(((totalUp / totalChecks) * 100).toFixed(2)) : null,
    totalChecks,
  };
}

export function getUptimeSummary(serverId = 'local') {
  const db = getDb();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const nurDieser = (rows) => rows.filter(r => r.server_id === serverId);
  const services24h = nurDieser(summenSeit(db, since24h));
  const services7d = nurDieser(summenSeit(db, since7d));

  // Entfernte Dienste (seit über 2 h nicht mehr entdeckt) zählen nicht mehr mit — sonst
  // drücken ihre alten Messungen einen Tag lang die Verfügbarkeit.
  const vorhanden = new Set([
    ...db.prepare("SELECT service_id FROM service_registry WHERE server_id = ? AND last_seen > ?")
      .all(serverId, new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()).map(r => r.service_id),
    ...db.prepare('SELECT id FROM manual_services WHERE server_id = ?').all(serverId).map(r => r.id),
  ]);
  const summary = {};
  for (const s of services24h) {
    if (!vorhanden.has(s.service_id)) continue;
    summary[s.service_id] = {
      uptime24h: s.total > 0 ? parseFloat(((s.up / s.total) * 100).toFixed(1)) : null,
      avgResponseTime: Math.round(s.rt || 0)
    };
  }
  for (const s of services7d) {
    if (!vorhanden.has(s.service_id)) continue;
    if (!summary[s.service_id]) summary[s.service_id] = {};
    summary[s.service_id].uptime7d = s.total > 0 ? parseFloat(((s.up / s.total) * 100).toFixed(1)) : null;
  }

  return summary;
}
