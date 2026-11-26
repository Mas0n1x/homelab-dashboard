/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Schwellwerte, Ausnahmen je Server und Wartungsfenster
import { getDb } from '../database.js';

// Standard-Schwellen (mit Hysterese: alarmieren über high, Entwarnung unter ok)
const DEFAULT_TH = {
  cpu: { high: 90, ok: 80 },
  ram: { high: 90, ok: 80 },
  disk: { high: 90, ok: 85 },
  temp: { high: 75, ok: 65 },
};

// Konfigurierbare Schwellen aus den Settings (nur die "high"-Werte; ok = high - gap).
export function getThresholds() {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'alert_thresholds'").get();
    if (!row?.value) return DEFAULT_TH;
    const cfg = JSON.parse(row.value);
    const clamp = (v, d) => (typeof v === 'number' && v > 0 && v <= 200 ? v : d);
    const mk = (key, defHigh, gap) => {
      const high = clamp(cfg[key], defHigh);
      return { high, ok: Math.max(0, high - gap) };
    };
    return {
      cpu: mk('cpu', 90, 10),
      ram: mk('ram', 90, 10),
      disk: mk('disk', 90, 5),
      temp: mk('temp', 75, 10),
    };
  } catch {
    return DEFAULT_TH;
  }
}

// Pro-Server-Overrides (Settings-Key `alert_overrides`, JSON):
// {"truenas": {"cpu": null, "ram": 95}} → null schaltet die Metrik für diesen
// Server ab, eine Zahl ersetzt die "high"-Schwelle (ok = high - gap).
// Gedacht für Server, die dauerhaft nahe der Schwelle laufen (z. B. NAS-VM).
export const OK_GAP = { cpu: 10, ram: 10, disk: 5, temp: 10 };
export const OVERRIDE_METRIKEN = ['cpu', 'ram', 'disk', 'temp'];

function leseSetting(key, standard) {
  try {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row?.value ? JSON.parse(row.value) : standard;
  } catch {
    return standard;
  }
}
function schreibeSetting(key, wert) {
  getDb().prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, JSON.stringify(wert));
}

export function getAllOverrides() {
  const o = leseSetting('alert_overrides', {});
  return o && typeof o === 'object' ? o : {};
}

export function getServerOverrides(serverId) {
  return getAllOverrides()[serverId] || {};
}

/** Overrides komplett ersetzen; ungültige Einträge werden verworfen. */
export function setAllOverrides(eingabe) {
  const sauber = {};
  for (const [serverId, werte] of Object.entries(eingabe || {})) {
    if (typeof serverId !== 'string' || !serverId || serverId.length > 64 || !werte || typeof werte !== 'object') continue;
    const e = {};
    for (const k of OVERRIDE_METRIKEN) {
      const v = werte[k];
      if (v === null) e[k] = null;
      else if (typeof v === 'number' && v > 0 && v <= 200) e[k] = v;
    }
    if (Object.keys(e).length) sauber[serverId] = e;
  }
  schreibeSetting('alert_overrides', sauber);
  return sauber;
}

// ── Wartungsfenster ──────────────────────────────────────────────
// Während eines Fensters laufen die Messungen weiter (Live-Zustand), es gehen
// aber keine Benachrichtigungen raus — für geplante Neustarts, Updates, Umbauten.
export function getMaintenance() {
  const liste = leseSetting('alert_maintenance', []);
  const jetzt = Date.now();
  return (Array.isArray(liste) ? liste : []).filter(w => new Date(w.until).getTime() > jetzt);
}

export function addMaintenance({ serverId, minutes, reason }) {
  const min = Math.min(7 * 24 * 60, Math.max(5, parseInt(minutes, 10) || 60));
  const fenster = {
    id: `wf-${Date.now()}`,
    serverId: typeof serverId === 'string' && serverId ? serverId.substring(0, 64) : '*',
    until: new Date(Date.now() + min * 60000).toISOString(),
    reason: String(reason || '').substring(0, 120),
    createdAt: new Date().toISOString(),
  };
  schreibeSetting('alert_maintenance', [...getMaintenance(), fenster]);
  return fenster;
}

export function removeMaintenance(id) {
  schreibeSetting('alert_maintenance', getMaintenance().filter(w => w.id !== id));
}

export function maintenanceFor(serverId) {
  return getMaintenance().find(w => w.serverId === '*' || w.serverId === serverId) || null;
}
