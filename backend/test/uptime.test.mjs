/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import './umgebung.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';

const { initDatabase, cleanupOldUptimeData } = await import('../src/services/database.js');
const { summenSeit } = await import('../src/services/uptimeRollup.js');
const { getUptimeTimeline, getUptimePercent } = await import('../src/services/uptime.js');
const db = initDatabase();
const ins = db.prepare('INSERT INTO uptime_checks (service_id, server_id, online, response_time, status_code, checked_at) VALUES (?, ?, ?, ?, 200, ?)');
const vor = (stunden) => new Date(Date.now() - stunden * 3600_000).toISOString();

test('Stundenwerte entsprechen den Rohdaten', () => {
  for (let i = 0; i < 500; i++) ins.run('a', 's', i % 10 ? 1 : 0, 100, vor(i / 20));
  const [summe] = summenSeit(db, vor(48));
  assert.equal(summe.total, 500);
  assert.equal(summe.up, 450);
  assert.equal(getUptimePercent('a', 48), 90);
});

test('Rohdaten bleiben 48 Stunden, Stundenwerte 92 Tage', () => {
  ins.run('b', 's', 1, 50, vor(24 * 40));
  ins.run('b', 's', 1, 50, vor(24 * 120));
  cleanupOldUptimeData();
  assert.equal(db.prepare("SELECT COUNT(*) n FROM uptime_checks WHERE service_id = 'b'").get().n, 0);
  assert.equal(db.prepare("SELECT SUM(total) n FROM uptime_hourly WHERE service_id = 'b'").get().n, 1);
  const verlauf = getUptimeTimeline('b', 90);
  assert.equal(verlauf.timeline.length, 90);
  assert.equal(verlauf.totalChecks, 1);
});

test('RAM-Trend ignoriert Nullwerte aus Messlücken', async () => {
  const { getMemoryTrends } = await import('../src/services/metrics.js');
  db.prepare("INSERT INTO servers (id, name, host) VALUES ('t', 'Test', 'x')").run();
  getMemoryTrends(); // legt die Tabellen an
  const h = db.prepare('INSERT INTO metrics_hourly (server_id, hour, mem_avg) VALUES (?, ?, ?)');
  for (let tag = 10; tag >= 1; tag--) {
    for (let stunde = 0; stunde < 14; stunde++) {
      const d = new Date(Date.now() - tag * 86400_000);
      d.setUTCHours(stunde, 0, 0, 0);
      h.run('t', d.toISOString().slice(0, 13), tag > 6 ? 0 : 50);
    }
  }
  const t = getMemoryTrends().find(x => x.serverId === 't');
  assert.ok(t.days <= 6, `gezählte Tage: ${t.days}`);
  assert.notEqual(t.status, 'steigend');
});
