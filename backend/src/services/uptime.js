/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { getDb } from './database.js';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';

const CHECK_TIMEOUT = 8000;

// Private/Loopback-Hosts, die der Backend-Container NICHT direkt erreicht.
// Fuer lokale Dienste laeuft der Zugriff ueber das Host-Gateway.
function isPrivateHost(hostname) {
  return hostname === 'localhost' ||
    /^127\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
}

// Der Checker laeuft IM Container. Lokale LAN-/Loopback-URLs sind von dort nicht
// erreichbar -> auf host.docker.internal umbiegen. Oeffentliche Domains bleiben.
function toReachableUrl(serverId, url) {
  if (serverId !== 'local') return url;
  try {
    const u = new URL(url);
    if (isPrivateHost(u.hostname)) {
      u.hostname = 'host.docker.internal';
      return u.toString();
    }
  } catch { /* ungueltige URL -> unveraendert lassen */ }
  return url;
}

// HTTP(S)-Probe ueber node:http/https. Wichtig: rejectUnauthorized:false —
// interne Dienste (Stalwart, Vaultwarden, Syncthing-GUI …) nutzen self-signed
// Zertifikate; global fetch wuerfe die als Fehler -> faelschlich "offline".
// Ergebnis: { ok, statusCode, responded }. responded=true, sobald ueberhaupt
// eine HTTP-Antwort kam (auch 5xx) — sonst greift der TCP-Fallback.
function httpProbe(target) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(target); } catch { return resolve({ ok: false, statusCode: 0, responded: false }); }
    const lib = u.protocol === 'https:' ? https : http;
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };

    const req = lib.request(target, {
      method: 'GET',
      timeout: CHECK_TIMEOUT,
      rejectUnauthorized: false,
      headers: { 'User-Agent': 'HomelabDashboard-Uptime/1.0', 'Range': 'bytes=0-0' },
    }, (res) => {
      const status = res.statusCode || 0;
      res.destroy(); // Body nicht laden — es zaehlt nur, dass geantwortet wurde
      // Alles < 500 = laeuft (Redirect, 401/403 Auth, 404 ohne Root-Route).
      done({ ok: status > 0 && status < 500, statusCode: status, responded: true });
    });
    req.on('error', () => done({ ok: false, statusCode: 0, responded: false }));
    req.on('timeout', () => { req.destroy(); done({ ok: false, statusCode: 0, responded: false }); });
    req.end();
  });
}

// TCP-Fallback: Dienste, die kein HTTP auf dem erkannten Port sprechen
// (Syncthing-Sync-Port, Mail-Ports, rohe TCP-Dienste), gelten als online,
// sobald der Port eine Verbindung annimmt. Verhindert falsche "offline".
function tcpProbe(hostname, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; socket.destroy(); resolve(v); } };
    socket.setTimeout(CHECK_TIMEOUT);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, hostname);
  });
}

export async function checkServiceHealth(serviceId, serverId, url) {
  if (!url) return;

  const db = getDb();
  const target = toReachableUrl(serverId, url);
  const start = Date.now();
  let online = false;
  let statusCode = 0;

  let u = null;
  try { u = new URL(target); } catch { /* ungueltige URL */ }

  if (u) {
    const probe = await httpProbe(target);
    statusCode = probe.statusCode;
    if (probe.ok) {
      online = true;
    } else if (!probe.responded) {
      // Keine HTTP-Antwort (Nicht-HTTP-Port, Protokoll-Mismatch, Reset):
      // Port-Verbindung pruefen. Offen -> Dienst laeuft.
      const port = u.port ? parseInt(u.port, 10) : (u.protocol === 'https:' ? 443 : 80);
      online = await tcpProbe(u.hostname, port);
    }
    // probe.responded && !probe.ok => 5xx => bleibt offline
  }

  const responseTime = Date.now() - start;

  db.prepare(
    'INSERT INTO uptime_checks (service_id, server_id, online, response_time, status_code, checked_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(serviceId, serverId, online ? 1 : 0, responseTime, statusCode, new Date().toISOString());

  return { serviceId, online, responseTime, statusCode };
}

export async function checkAllServices(services) {
  const results = await Promise.allSettled(
    services
      .filter(s => s.url)
      .map(s => checkServiceHealth(s.id, s.serverId || 'local', s.url))
  );

  return results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);
}

export function getUptimePercent(serviceId, hours = 24) {
  const db = getDb();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const row = db.prepare(
    'SELECT COUNT(*) as total, SUM(online) as up FROM uptime_checks WHERE service_id = ? AND checked_at > ?'
  ).get(serviceId, since);

  if (!row || row.total === 0) return null;
  return parseFloat(((row.up / row.total) * 100).toFixed(1));
}

export function getUptimeHistory(serviceId, hours = 24) {
  const db = getDb();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  return db.prepare(
    'SELECT online, response_time, checked_at FROM uptime_checks WHERE service_id = ? AND checked_at > ? ORDER BY checked_at ASC'
  ).all(serviceId, since);
}

export function getUptimeTimeline(serviceId, days = 30) {
  const db = getDb();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const rows = db.prepare(`
    SELECT
      date(checked_at) as day,
      COUNT(*) as total,
      SUM(online) as up,
      ROUND(AVG(response_time)) as avg_response_time,
      MIN(response_time) as min_response_time,
      MAX(response_time) as max_response_time
    FROM uptime_checks
    WHERE service_id = ? AND checked_at > ?
    GROUP BY date(checked_at)
    ORDER BY day ASC
  `).all(serviceId, since);

  // Build full timeline filling gaps with null
  const timeline = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dayStr = date.toISOString().split('T')[0];
    const row = rows.find(r => r.day === dayStr);

    timeline.push(row ? {
      date: dayStr,
      uptime: row.total > 0 ? parseFloat(((row.up / row.total) * 100).toFixed(1)) : null,
      checks: row.total,
      avgResponseTime: row.avg_response_time || 0,
    } : {
      date: dayStr,
      uptime: null,
      checks: 0,
      avgResponseTime: 0,
    });
  }

  const totalChecks = rows.reduce((sum, r) => sum + r.total, 0);
  const totalUp = rows.reduce((sum, r) => sum + r.up, 0);

  return {
    serviceId,
    days,
    timeline,
    overallUptime: totalChecks > 0 ? parseFloat(((totalUp / totalChecks) * 100).toFixed(2)) : null,
    totalChecks
  };
}

// Komplettes Status-Board fuer eine Status-Seite: je Service 24h/7d-Uptime,
// aktueller Zustand und eine Tages-Timeline ueber N Tage. Ein einziger Call.
export function getStatusBoard(serverId = 'local', days = 30) {
  const db = getDb();
  const sinceDays = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const svcIds = db.prepare(
    'SELECT DISTINCT service_id FROM uptime_checks WHERE server_id = ? AND checked_at > ?'
  ).all(serverId, sinceDays).map(r => r.service_id);

  const out = {};
  for (const sid of svcIds) {
    const s24 = db.prepare('SELECT COUNT(*) t, SUM(online) up, AVG(response_time) rt FROM uptime_checks WHERE service_id = ? AND server_id = ? AND checked_at > ?').get(sid, serverId, since24);
    const s7 = db.prepare('SELECT COUNT(*) t, SUM(online) up FROM uptime_checks WHERE service_id = ? AND server_id = ? AND checked_at > ?').get(sid, serverId, since7);
    const last = db.prepare('SELECT online, checked_at, response_time FROM uptime_checks WHERE service_id = ? AND server_id = ? ORDER BY checked_at DESC LIMIT 1').get(sid, serverId);
    const dayRows = db.prepare('SELECT date(checked_at) day, COUNT(*) t, SUM(online) up FROM uptime_checks WHERE service_id = ? AND server_id = ? AND checked_at > ? GROUP BY date(checked_at)').all(sid, serverId, sinceDays);

    const timeline = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const row = dayRows.find(r => r.day === ds);
      timeline.push({ date: ds, uptime: row && row.t ? parseFloat((row.up / row.t * 100).toFixed(1)) : null, checks: row ? row.t : 0 });
    }

    out[sid] = {
      uptime24h: s24.t ? parseFloat((s24.up / s24.t * 100).toFixed(1)) : null,
      uptime7d: s7.t ? parseFloat((s7.up / s7.t * 100).toFixed(1)) : null,
      avgResponseTime: Math.round(s24.rt || 0),
      current: last ? !!last.online : null,
      lastCheck: last ? last.checked_at : null,
      timeline,
    };
  }
  return out;
}

export function getUptimeSummary(serverId = 'local') {
  const db = getDb();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const services24h = db.prepare(`
    SELECT service_id, COUNT(*) as total, SUM(online) as up,
      AVG(response_time) as avg_response_time
    FROM uptime_checks
    WHERE server_id = ? AND checked_at > ?
    GROUP BY service_id
  `).all(serverId, since24h);

  const services7d = db.prepare(`
    SELECT service_id, COUNT(*) as total, SUM(online) as up
    FROM uptime_checks
    WHERE server_id = ? AND checked_at > ?
    GROUP BY service_id
  `).all(serverId, since7d);

  const summary = {};
  for (const s of services24h) {
    summary[s.service_id] = {
      uptime24h: s.total > 0 ? parseFloat(((s.up / s.total) * 100).toFixed(1)) : null,
      avgResponseTime: Math.round(s.avg_response_time || 0)
    };
  }
  for (const s of services7d) {
    if (!summary[s.service_id]) summary[s.service_id] = {};
    summary[s.service_id].uptime7d = s.total > 0 ? parseFloat(((s.up / s.total) * 100).toFixed(1)) : null;
  }

  return summary;
}
