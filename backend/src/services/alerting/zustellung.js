/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Wann eine Meldung rausgeht: sofort, nach der Ruhezeit oder als Tagesübersicht.
import { getDb } from '../database.js';
import { ortszeit, istUhrzeit, imZeitraum, naechsteZeit } from '../ortszeit.js';

export const ARTEN = ['dringend', 'sofort', 'gesammelt'];

// dringend = auch nachts; sofort = außerhalb der Ruhezeit; gesammelt = Tagesübersicht
const STANDARD_ARTEN = {
  server_offline: 'dringend', backup_failed: 'dringend', disk_high: 'dringend', temp_high: 'dringend',
  cpu_high: 'sofort', ram_high: 'sofort', container_crash: 'sofort', container_restart: 'sofort',
  service_offline: 'sofort', new_portfolio_request: 'sofort', new_portfolio_customer: 'sofort', status_report: 'sofort',
  image_updates: 'gesammelt', reboot: 'gesammelt', ram_trend: 'gesammelt', disk_forecast: 'gesammelt', backup_completed: 'gesammelt',
};
const STANDARD = { quiet: { enabled: true, from: '22:00', to: '07:00' }, digestAt: '08:00', modes: STANDARD_ARTEN };

export function getZustellung() {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'alert_delivery'").get();
  let eigen = {};
  try { eigen = row?.value ? JSON.parse(row.value) : {}; } catch { /* Standard */ }
  return {
    quiet: { ...STANDARD.quiet, ...eigen.quiet },
    digestAt: eigen.digestAt || STANDARD.digestAt,
    modes: { ...STANDARD_ARTEN, ...eigen.modes },
  };
}

export function setZustellung({ quiet = {}, digestAt, modes = {} } = {}) {
  const alt = getZustellung();
  const zeit = (neu, bisher) => (istUhrzeit(neu) ? neu : bisher);
  const cfg = {
    quiet: {
      enabled: typeof quiet.enabled === 'boolean' ? quiet.enabled : alt.quiet.enabled,
      from: zeit(quiet.from, alt.quiet.from),
      to: zeit(quiet.to, alt.quiet.to),
    },
    digestAt: zeit(digestAt, alt.digestAt),
    modes: { ...alt.modes },
  };
  for (const [ereignis, art] of Object.entries(modes)) {
    if (ereignis in STANDARD_ARTEN && ARTEN.includes(art)) cfg.modes[ereignis] = art;
  }
  getDb().prepare("INSERT INTO settings (key, value) VALUES ('alert_delivery', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(JSON.stringify(cfg));
  return cfg;
}

/** Zeitpunkt, bis zu dem eine Meldung wartet — oder null für „jetzt“. */
export function wartetBis(eventType, jetzt = new Date()) {
  const ereignis = String(eventType || '').split('::')[0];
  if (ereignis === 'test') return null;
  const cfg = getZustellung();
  const art = cfg.modes[ereignis] || 'sofort';
  if (art === 'dringend') return null;
  if (art === 'gesammelt') return naechsteZeit(cfg.digestAt, jetzt);
  const { enabled, from, to } = cfg.quiet;
  return enabled && imZeitraum(ortszeit(jetzt).minuten, from, to) ? naechsteZeit(to, jetzt) : null;
}

export function stelleZurueck(channelId, payload, bis) {
  const felder = (payload.fields || []).map(f => `${f.name}: ${f.value}`);
  const text = [payload.message, ...felder].filter(Boolean).join('\n');
  getDb().prepare('INSERT INTO alert_queue (channel_id, event_type, title, message, created_at, due_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(channelId, payload.event || null, String(payload.title), text, new Date().toISOString(), bis.toISOString());
}

const uhr = (iso) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
const MAX_ZEILEN = 20;

/** Fasst die Warteschlange eines Kanals zu einer Meldung zusammen. */
export function fasseZusammen(eintraege) {
  // Alarm samt Entwarnung wird eine Zeile.
  const behoben = new Set(eintraege.filter(e => e.event_type?.endsWith('::ok')).map(e => e.event_type.slice(0, -4)));
  const alarme = new Set(eintraege.map(e => e.event_type));
  const zeilen = eintraege
    .filter(e => !(e.event_type?.endsWith('::ok') && alarme.has(e.event_type.slice(0, -4))))
    .map(e => {
      const text = e.message.replace(/\s*\n\s*/g, ' · ');
      return `• ${uhr(e.created_at)} **${e.title}**${behoben.has(e.event_type) ? ' (inzwischen behoben)' : ''}\n${text.length > 140 ? `${text.slice(0, 139)}…` : text}`;
    });
  const rest = zeilen.length - MAX_ZEILEN;
  return {
    event: 'digest',
    title: `🗞️ Zusammenfassung: ${zeilen.length} ${zeilen.length === 1 ? 'Meldung' : 'Meldungen'}`,
    message: zeilen.slice(0, MAX_ZEILEN).join('\n') + (rest > 0 ? `\n… und ${rest} weitere` : ''),
    color: 0x6366f1,
    record: false,
    sofort: true,
  };
}

/** Liefert alles Fällige aus. `sende` ist sendWebhook (hereingereicht, sonst Importkreis). */
export async function liefereFaellige(sende, jetzt = new Date()) {
  const db = getDb();
  db.prepare('DELETE FROM alert_queue WHERE channel_id NOT IN (SELECT id FROM alert_channels WHERE enabled = 1)').run();
  const kanaele = db.prepare('SELECT DISTINCT channel_id FROM alert_queue WHERE due_at <= ?').all(jetzt.toISOString());
  let geliefert = 0;
  for (const { channel_id } of kanaele) {
    const kanal = db.prepare('SELECT * FROM alert_channels WHERE id = ?').get(channel_id);
    if (!kanal) continue;
    const eintraege = db.prepare('SELECT * FROM alert_queue WHERE channel_id = ? AND due_at <= ? ORDER BY id').all(channel_id, jetzt.toISOString());
    // Erst nach erfolgreicher Zustellung löschen — sonst beim nächsten Lauf erneut.
    if (await sende(kanal, fasseZusammen(eintraege))) {
      db.prepare(`DELETE FROM alert_queue WHERE id IN (${eintraege.map(() => '?').join(',')})`).run(...eintraege.map(e => e.id));
      geliefert += eintraege.length;
    }
  }
  return geliefert;
}
