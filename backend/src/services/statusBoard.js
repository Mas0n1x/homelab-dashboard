/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { getDb } from './database.js';
import serverManager from './serverManager.js';
import { getDiscoverySnapshot } from './discovery.js';
import { getVanishedServices, getFirstSeenMap } from './serviceRegistry.js';

// Ein Dienst gilt als „neu", solange er weniger als so lange bekannt ist.
const NEW_FOR_HOURS = 24;

/**
 * Das komplette Status-Board für ALLE Server in einem Rutsch.
 *
 * Bewusst ohne jeden Netz-/SSH-Aufruf: die Dienstliste kommt aus dem Snapshot
 * des Hintergrund-Discovery-Jobs, die Verfügbarkeit aus der lokalen Datenbank.
 * Die Seite lädt damit in Millisekunden statt in „Server × Docker-über-SSH".
 */
export function buildStatusBoard(days = 30) {
  const db = getDb();
  const servers = serverManager.getAllServers();

  const sinceDays = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const newCutoff = new Date(Date.now() - NEW_FOR_HOURS * 60 * 60 * 1000).toISOString();

  // Alle Kennzahlen als je EINE gruppierte Abfrage über den ganzen Zeitraum,
  // statt vier Abfragen pro Dienst. Bei ~60 Diensten sind das 4 statt 240.
  const agg = (since) => {
    const rows = db.prepare(`
      SELECT service_id, server_id, COUNT(*) AS total, SUM(online) AS up, AVG(response_time) AS rt
      FROM uptime_checks WHERE checked_at > ? GROUP BY service_id, server_id
    `).all(since);
    const map = new Map();
    for (const r of rows) map.set(`${r.server_id}|${r.service_id}`, r);
    return map;
  };

  const agg24 = agg(since24);
  const agg7 = agg(since7);

  const dayRows = db.prepare(`
    SELECT service_id, server_id, date(checked_at) AS day, COUNT(*) AS total, SUM(online) AS up
    FROM uptime_checks WHERE checked_at > ? GROUP BY service_id, server_id, date(checked_at)
  `).all(sinceDays);
  const byDay = new Map();
  for (const r of dayRows) {
    const key = `${r.server_id}|${r.service_id}`;
    if (!byDay.has(key)) byDay.set(key, new Map());
    byDay.get(key).set(r.day, r);
  }

  // Letzter Check je Dienst — mit einem Fensterausdruck statt N Einzelabfragen.
  const lastRows = db.prepare(`
    SELECT service_id, server_id, online, response_time, checked_at FROM (
      SELECT service_id, server_id, online, response_time, checked_at,
             ROW_NUMBER() OVER (PARTITION BY server_id, service_id ORDER BY checked_at DESC) AS rn
      FROM uptime_checks WHERE checked_at > ?
    ) WHERE rn = 1
  `).all(since7);
  const lastCheck = new Map();
  for (const r of lastRows) lastCheck.set(`${r.server_id}|${r.service_id}`, r);

  // Tagesraster einmal vorbereiten — für jeden Dienst identisch.
  const dayKeys = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dayKeys.push(d.toISOString().slice(0, 10));
  }

  const buildEntry = (serverId, serviceId) => {
    const key = `${serverId}|${serviceId}`;
    const a24 = agg24.get(key);
    const a7 = agg7.get(key);
    const last = lastCheck.get(key);
    const days_ = byDay.get(key);

    return {
      uptime24h: a24?.total ? parseFloat(((a24.up / a24.total) * 100).toFixed(1)) : null,
      uptime7d: a7?.total ? parseFloat(((a7.up / a7.total) * 100).toFixed(1)) : null,
      avgResponseTime: Math.round(a24?.rt || 0),
      current: last ? !!last.online : null,
      lastCheck: last ? last.checked_at : null,
      timeline: dayKeys.map(ds => {
        const row = days_?.get(ds);
        return {
          date: ds,
          uptime: row?.total ? parseFloat(((row.up / row.total) * 100).toFixed(1)) : null,
          checks: row?.total || 0,
        };
      }),
    };
  };

  const groups = [];
  let up = 0, down = 0, total = 0;

  for (const server of servers) {
    const snapshot = getDiscoverySnapshot(server.id);
    const discovered = snapshot?.services ?? [];

    const overrides = db.prepare('SELECT * FROM service_overrides WHERE server_id = ?').all(server.id);
    const overrideMap = new Map(overrides.map(o => [o.service_id, o]));

    const manual = db.prepare(
      'SELECT id, name, url, category FROM manual_services WHERE server_id = ? ORDER BY sort_order ASC'
    ).all(server.id);

    const firstSeen = getFirstSeenMap(server.id);

    const services = [];

    for (const s of discovered) {
      const o = overrideMap.get(s.id);
      if (o?.hidden) continue;
      const entry = buildEntry(server.id, s.id);
      // Ohne Messwerte zählt der Container-Zustand — so steht ein frisch
      // deployter Dienst sofort auf „online" statt eine Minute lang auf „–".
      const isUp = entry.current !== null ? entry.current : s.state === 'running';
      const seen = firstSeen[s.id];

      services.push({
        id: s.id,
        name: o?.name || s.name,
        url: o?.url || s.url,
        category: o?.category || s.category,
        project: s.project,
        source: 'docker',
        state: s.state,
        isNew: !!seen && seen > newCutoff,
        firstSeen: seen || null,
        vanished: false,
        ...entry,
        current: isUp,
      });

      total++;
      if (isUp) up++; else down++;
    }

    for (const m of manual) {
      const entry = buildEntry(server.id, m.id);
      const isUp = entry.current !== null ? entry.current : true;
      services.push({
        id: m.id,
        name: m.name,
        url: m.url,
        category: m.category || 'Extern',
        source: 'manual',
        isNew: false,
        vanished: false,
        ...entry,
        current: isUp,
      });
      total++;
      if (isUp) up++; else down++;
    }

    // Kürzlich verschwundene Dienste sichtbar machen, statt sie wortlos zu
    // schlucken — sonst merkt man ein versehentlich abgeräumtes Compose-Projekt
    // erst, wenn ein Kunde anruft.
    if (discovered.length > 0) {
      for (const v of getVanishedServices(server.id, discovered.map(s => s.id))) {
        services.push({
          ...v,
          source: 'docker',
          state: 'gone',
          isNew: false,
          vanished: true,
          current: null,
          uptime24h: null,
          uptime7d: null,
          avgResponseTime: 0,
          lastCheck: v.lastSeen,
          timeline: dayKeys.map(ds => ({ date: ds, uptime: null, checks: 0 })),
        });
      }
    }

    groups.push({
      server: { id: server.id, name: server.name, status: server.status },
      // Reihenfolge: offline zuerst, dann neu, dann alphabetisch — was Ärger
      // macht oder frisch ist, steht oben.
      services: services.sort((a, b) => {
        const rank = (s) => (s.vanished ? 0 : s.current === false ? 1 : s.isNew ? 2 : 3);
        return rank(a) - rank(b) || a.name.localeCompare(b.name, 'de');
      }),
      stale: snapshot ? Date.now() - snapshot.at > 5 * 60 * 1000 : true,
      lastDiscovery: snapshot ? new Date(snapshot.at).toISOString() : null,
    });
  }

  return {
    groups,
    summary: { up, down, total, servers: servers.length },
    generatedAt: new Date().toISOString(),
  };
}
