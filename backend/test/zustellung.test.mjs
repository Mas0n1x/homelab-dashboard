/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import './umgebung.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';

const { initDatabase } = await import('../src/services/database.js');
const z = await import('../src/services/alerting/zustellung.js');
const { sendWebhook } = await import('../src/services/alerting/senden.js');
const plan = await import('../src/services/autoCleanup.js');
const { notifyImageUpdates } = await import('../src/services/alerting/meldungen.js');
const db = initDatabase();
db.prepare("INSERT INTO alert_channels (id, type, name, webhook_url, events) VALUES ('k', 'discord', 'Test', 'http://127.0.0.1:1/x', '[\"image_updates\"]')").run();
const kanal = db.prepare("SELECT * FROM alert_channels WHERE id = 'k'").get();
const warteschlange = () => db.prepare('SELECT * FROM alert_queue ORDER BY id').all();

// Winterzeit in Berlin: UTC+1
const tag = new Date('2026-12-01T12:00:00Z');
const nacht = new Date('2026-12-01T22:30:00Z'); // 23:30 Ortszeit

test('Dringendes geht immer raus, Sofortiges wartet in der Ruhezeit, Gesammeltes bis 08:00', () => {
  assert.equal(z.wartetBis('server_offline::x', nacht), null);
  assert.equal(z.wartetBis('cpu_high::x', tag), null);
  assert.equal(z.wartetBis('cpu_high::x', nacht).toISOString(), '2026-12-02T06:00:00.000Z');
  assert.equal(z.wartetBis('image_updates', tag).toISOString(), '2026-12-02T07:00:00.000Z');
  z.setZustellung({ quiet: { enabled: false } });
  assert.equal(z.wartetBis('cpu_high', nacht), null);
});

test('zurückgehaltene Meldungen landen in Warteschlange und Verlauf', async () => {
  assert.equal(await sendWebhook(kanal, { event: 'image_updates', title: 'Neue Images', message: 'a, b' }), true);
  assert.equal(warteschlange().length, 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM alert_history WHERE event_type = 'image_updates'").get().n, 1);
});

test('Zusammenfassung: Alarm und Entwarnung werden eine Zeile', () => {
  const e = (event_type, title) => ({ event_type, title, message: 'Text', created_at: tag.toISOString() });
  const r = z.fasseZusammen([e('ram_trend::a', 'RAM steigt'), e('ram_trend::a::ok', 'RAM stabil'), e('reboot', 'Neustart')]);
  assert.match(r.title, /2 Meldungen/);
  assert.match(r.message, /inzwischen behoben/);
  assert.doesNotMatch(r.message, /RAM stabil/);
});

test('Auslieferung löscht erst nach Erfolg', async () => {
  const spaeter = new Date(Date.now() + 3 * 86400_000);
  assert.equal(await z.liefereFaellige(async () => false, spaeter), 0);
  assert.equal(warteschlange().length, 1);
  assert.equal(await z.liefereFaellige(async () => true, spaeter), 1);
  assert.equal(warteschlange().length, 0);
});

test('Image-Meldung nur bei neu veralteten Containern', async () => {
  const lauf = (...namen) => ({ outdated: namen, servers: [{ serverId: 's', serverName: 'S', containers: namen.map(n => ({ containerName: n, hasUpdate: true })) }] });
  const zaehle = () => warteschlange().filter(e => e.event_type === 'image_updates').length;
  await notifyImageUpdates(lauf('a', 'b'));
  await notifyImageUpdates(lauf('a', 'b'));
  await notifyImageUpdates(lauf('a'));
  assert.equal(zaehle(), 1);
  await notifyImageUpdates(lauf('a', 'c'));
  assert.equal(zaehle(), 2);
});

test('Aufräumen ist sonntags ab 04:00 genau einmal fällig', async () => {
  const sonntag = new Date('2026-12-06T03:30:00Z'); // 04:30 Ortszeit
  assert.equal(plan.istFaellig(new Date('2026-12-06T02:00:00Z')), false);
  assert.equal(plan.istFaellig(new Date('2026-12-07T03:30:00Z')), false);
  assert.equal(plan.istFaellig(sonntag), true);
  await plan.laufeWennFaellig(sonntag);
  assert.equal(plan.istFaellig(sonntag), false);
});
