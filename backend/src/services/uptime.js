import { getDb } from './database.js';

export async function checkServiceHealth(serviceId, serverId, url) {
  if (!url) return;

  const db = getDb();
  const start = Date.now();
  let online = false;
  let responseTime = 0;
  let statusCode = 0;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow'
    });

    clearTimeout(timeout);
    online = res.ok || res.status === 401 || res.status === 403; // Auth-protected services count as online
    responseTime = Date.now() - start;
    statusCode = res.status;
  } catch {
    responseTime = Date.now() - start;
  }

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
