/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { getDb } from './database.js';

// Wie lange ein verschwundener Dienst noch auf der Statusseite steht, bevor er
// samt Historie aufgeräumt wird. Puffer für einen Redeploy, der ein paar Minuten
// dauert, oder einen Server, der über Nacht nicht erreichbar war.
const GRACE_HOURS = 24;

// Nach dieser Zeit ohne Sichtkontakt gilt der Dienst als endgültig entfernt und
// wird mitsamt Uptime-Historie und Override gelöscht.
const PURGE_DAYS = 3;

/**
 * Merkt sich die aktuell entdeckten Dienste eines Servers.
 *
 * Damit weiß die Statusseite, was seit wann existiert — die Grundlage dafür,
 * dass ein frischer Deploy von selbst auftaucht und ein entferntes Compose-
 * Projekt von selbst wieder verschwindet, ohne dass jemand etwas pflegt.
 *
 * `discovered` sind die Rohdaten aus discoverServices().
 */
export function recordSeenServices(serverId, discovered) {
  if (!Array.isArray(discovered) || discovered.length === 0) return;
  const db = getDb();
  const now = new Date().toISOString();

  const upsert = db.prepare(`
    INSERT INTO service_registry (service_id, server_id, name, category, url, project, container_name, first_seen, last_seen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(service_id, server_id) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      url = excluded.url,
      project = excluded.project,
      container_name = excluded.container_name,
      last_seen = excluded.last_seen
  `);

  db.transaction(() => {
    for (const s of discovered) {
      upsert.run(s.id, serverId, s.name || null, s.category || null, s.url || null, s.project || null, s.containerName || null, now, now);
    }
  })();
}

/**
 * Einmalige Umschlüsselung der Uptime-Historie von der alten, container-
 * gebundenen Kennung (`docker-<12 Zeichen>`) auf die stabile Kennung.
 *
 * Läuft bei jedem Discovery-Durchlauf, kostet aber nach dem ersten Mal nichts:
 * Sobald keine Zeile mehr unter der alten Kennung liegt, tut das UPDATE nichts.
 * Ohne das wären mit der Umstellung sämtliche 30-Tage-Balken leer.
 */
export function migrateLegacyServiceIds(serverId, discovered) {
  if (!Array.isArray(discovered) || discovered.length === 0) return 0;
  const db = getDb();

  const moveChecks = db.prepare(
    'UPDATE uptime_checks SET service_id = ? WHERE service_id = ? AND server_id = ?'
  );
  // OR IGNORE: liegt schon ein Eintrag unter der neuen Kennung, bleibt der
  // stehen und die alte Zeile wird anschließend verworfen.
  const moveOverride = db.prepare(
    'UPDATE OR IGNORE service_overrides SET service_id = ? WHERE service_id = ? AND server_id = ?'
  );
  const dropOverride = db.prepare(
    'DELETE FROM service_overrides WHERE service_id = ? AND server_id = ?'
  );
  // Favoriten hängen ebenfalls an der Dienst-Kennung — ohne Umschlüsselung
  // wäre die Schnellzugriff-Leiste nach dem Update leer.
  const moveFavorite = db.prepare(
    'UPDATE OR IGNORE favorites SET service_id = ? WHERE service_id = ? AND server_id = ?'
  );
  const dropFavorite = db.prepare(
    'DELETE FROM favorites WHERE service_id = ? AND server_id = ?'
  );

  let moved = 0;
  db.transaction(() => {
    for (const s of discovered) {
      if (!s.legacyId || s.legacyId === s.id) continue;
      moved += moveChecks.run(s.id, s.legacyId, serverId).changes;
      moveOverride.run(s.id, s.legacyId, serverId);
      dropOverride.run(s.legacyId, serverId);
      moveFavorite.run(s.id, s.legacyId, serverId);
      dropFavorite.run(s.legacyId, serverId);
    }
  })();

  return moved;
}

/**
 * Räumt Dienste weg, die seit PURGE_DAYS nicht mehr auf ihrem Server auftauchen:
 * Registereintrag, Uptime-Historie und Override verschwinden zusammen.
 *
 * Genau das ist der zweite Teil von „taucht beim Deploy auf, verschwindet beim
 * Entfernen": ohne das Aufräumen wüchse die Historie ewig weiter und die
 * Statusseite würde langsam von Leichen zugestellt.
 */
export function purgeVanishedServices() {
  const db = getDb();
  const cutoff = new Date(Date.now() - PURGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const gone = db.prepare(
    'SELECT service_id, server_id, name FROM service_registry WHERE last_seen < ?'
  ).all(cutoff);

  if (gone.length === 0) return { purged: 0, names: [] };

  const delChecks = db.prepare('DELETE FROM uptime_checks WHERE service_id = ? AND server_id = ?');
  const delOverride = db.prepare('DELETE FROM service_overrides WHERE service_id = ? AND server_id = ?');
  const delEntry = db.prepare('DELETE FROM service_registry WHERE service_id = ? AND server_id = ?');

  db.transaction(() => {
    for (const g of gone) {
      delChecks.run(g.service_id, g.server_id);
      delOverride.run(g.service_id, g.server_id);
      delEntry.run(g.service_id, g.server_id);
    }
  })();

  return { purged: gone.length, names: gone.map(g => g.name || g.service_id) };
}

/**
 * Dienste, die im Register stehen, aber beim letzten Durchlauf nicht mehr
 * gefunden wurden — innerhalb der Karenzzeit. Die Statusseite zeigt sie als
 * „entfernt" an, statt sie wortlos verschwinden zu lassen.
 */
export function getVanishedServices(serverId, currentIds) {
  const db = getDb();
  const graceCutoff = new Date(Date.now() - GRACE_HOURS * 60 * 60 * 1000).toISOString();
  const known = db.prepare(
    'SELECT service_id, name, category, url, project, first_seen, last_seen FROM service_registry WHERE server_id = ? AND last_seen > ?'
  ).all(serverId, graceCutoff);

  const present = new Set(currentIds);
  return known
    .filter(k => !present.has(k.service_id))
    .map(k => ({
      id: k.service_id,
      name: k.name || k.service_id,
      category: k.category || 'Dienste',
      url: k.url,
      project: k.project,
      firstSeen: k.first_seen,
      lastSeen: k.last_seen,
    }));
}

/** Erst-Sichtkontakt je Dienst eines Servers — für die „Neu"-Markierung. */
export function getFirstSeenMap(serverId) {
  const db = getDb();
  const rows = db.prepare('SELECT service_id, first_seen FROM service_registry WHERE server_id = ?').all(serverId);
  const map = {};
  for (const r of rows) map[r.service_id] = r.first_seen;
  return map;
}
