/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Wöchentliches Aufräumen auf allen Docker-Servern. Nur Reste, die sich von selbst neu
// bilden: Build-Zwischenspeicher und Images ohne Namen. Container, benannte Images (auch
// Stände zum Zurückrollen) und Volumes bleiben unangetastet.
import { getDb } from './database.js';
import serverManager from './serverManager.js';
import { aufraeumen } from './cleanup.js';
import { logAudit } from './audit.js';
import { ortszeit, istUhrzeit, alsMinuten } from './ortszeit.js';

const AUSWAHL = { buildCache: true, danglingImages: true };
const STANDARD = { enabled: true, weekday: 0, time: '04:00' };
const ZEITLIMIT_JE_SERVER_MS = 10 * 60 * 1000;

const lese = (key) => {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  try { return row?.value ? JSON.parse(row.value) : null; } catch { return null; }
};
const schreibe = (key, wert) => getDb()
  .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
  .run(key, JSON.stringify(wert));

export function getAufraeumPlan() {
  return { ...STANDARD, ...lese('auto_cleanup'), letzter: lese('auto_cleanup_state') };
}

export function setAufraeumPlan({ enabled, weekday, time } = {}) {
  const { letzter, ...alt } = getAufraeumPlan();
  schreibe('auto_cleanup', {
    enabled: typeof enabled === 'boolean' ? enabled : alt.enabled,
    weekday: Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 ? weekday : alt.weekday,
    time: istUhrzeit(time) ? time : alt.time,
  });
  return getAufraeumPlan();
}

// Fällig am gewählten Wochentag ab der Uhrzeit, höchstens einmal am Tag. Das Fenster
// reicht bis Mitternacht, damit ein Neustart zur falschen Zeit den Lauf nicht verschluckt.
export function istFaellig(jetzt = new Date()) {
  const plan = getAufraeumPlan();
  if (!plan.enabled) return false;
  const t = ortszeit(jetzt);
  return t.wochentag === plan.weekday && t.minuten >= alsMinuten(plan.time) && plan.letzter?.datum !== t.datum;
}

const mitFrist = (versprechen) => new Promise((resolve, reject) => {
  const frist = setTimeout(() => reject(new Error('Zeitlimit überschritten')), ZEITLIMIT_JE_SERVER_MS);
  frist.unref?.();
  versprechen.then(resolve, reject).finally(() => clearTimeout(frist));
});

export async function laufeWennFaellig(jetzt = new Date()) {
  if (!istFaellig(jetzt)) return null;
  const stand = { datum: ortszeit(jetzt).datum, lauf: jetzt.toISOString(), server: [] };
  schreibe('auto_cleanup_state', stand); // zuerst merken: ein Neustart soll nicht von vorn beginnen

  for (const s of serverManager.getAllServers()) {
    const docker = serverManager.getConnection(s.id)?.docker;
    if (!docker) continue;
    try {
      const r = await mitFrist(aufraeumen(docker, AUSWAHL));
      const fehler = Object.values(r.ergebnis).find(e => !e.ok)?.error;
      stand.server.push({ name: s.name, ok: !fehler, freigegeben: r.freigegeben, ...(fehler ? { fehler } : {}) });
    } catch (error) {
      stand.server.push({ name: s.name, ok: false, freigegeben: 0, fehler: error.message });
    }
    schreibe('auto_cleanup_state', stand);
  }

  const summe = stand.server.reduce((a, s) => a + s.freigegeben, 0);
  logAudit('docker.cleanup_auto', 'alle Server', { freigegeben: summe, server: stand.server.length }, null);
  console.log(`Automatisches Aufräumen: ${(summe / 1024 ** 3).toFixed(2)} GB auf ${stand.server.length} Servern freigegeben`);
  return stand;
}
