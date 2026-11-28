/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Berichte und Hinweise (Status, Prognose, RAM-Trend, Images)
import { getDb } from '../database.js';
import { getMemoryTrends } from '../metrics.js';
import { sendWebhook } from './senden.js';
import { handleThreshold } from './zustand.js';
import { fmtPct, progressBar } from './format.js';
import { getServerOverrides, maintenanceFor } from './einstellungen.js';

// Periodischer Gesamt-Statusbericht an alle Channels mit 'status_report'.
// report: { servers: [{ name, online, cpuPercent, memPercent, disks:[{mountPoint,percent}], maxTemp, uptime, containers:{running,total} }] }
export async function sendStatusReport(report) {
  const db = getDb();
  const channels = db.prepare('SELECT * FROM alert_channels WHERE enabled = 1').all();
  if (channels.length === 0) return;

  const targets = channels.filter(c => JSON.parse(c.events || '[]').includes('status_report'));
  if (targets.length === 0) return;

  const servers = report?.servers || [];
  const fields = servers.map(s => {
    if (!s.online) {
      return { name: `🔴 ${s.name}`, value: 'Offline / nicht erreichbar', inline: false };
    }
    const lines = [
      `CPU: ${progressBar(s.cpuPercent)} ${fmtPct(s.cpuPercent)}`,
      `RAM: ${progressBar(s.memPercent)} ${fmtPct(s.memPercent)}`,
    ];
    const rootDisk = (s.disks || []).find(d => d.mountPoint === '/') || (s.disks || [])[0];
    if (rootDisk) lines.push(`Disk (${rootDisk.mountPoint}): ${progressBar(rootDisk.percent)} ${fmtPct(rootDisk.percent)}`);
    if (s.maxTemp != null) lines.push(`Temp: ${Number(s.maxTemp).toFixed(1)} °C`);
    if (s.containers) lines.push(`Container: ${s.containers.running}/${s.containers.total} aktiv`);
    if (s.uptime && s.uptime !== 'N/A') lines.push(`Uptime: ${s.uptime}`);
    return { name: `🟢 ${s.name}`, value: lines.join('\n'), inline: false };
  });

  const anyOffline = servers.some(s => !s.online);
  for (const channel of targets) {
    await sendWebhook(channel, {
      event: 'status_report',
      title: '📊 Server-Statusbericht',
      message: servers.length ? `Übersicht über ${servers.length} Server.` : 'Keine Server konfiguriert.',
      color: anyOffline ? 0xff8800 : 0x00ff88,
      fields,
    });
  }
}

// Einzel-Event an alle aktivierten Kanäle senden, die dieses Event abonniert haben.
// Für punktuelle Ereignisse (z. B. Backup fertig/fehlgeschlagen) statt Schwellwert-Polling.
export async function notify(event, payload) {
  const db = getDb();
  const channels = db.prepare('SELECT * FROM alert_channels WHERE enabled = 1').all();
  for (const channel of channels) {
    const events = JSON.parse(channel.events || '[]');
    if (!events.includes(event)) continue;
    await sendWebhook(channel, { event, ...payload });
  }
}

// ── Speicher-Prognose: warnen, wenn eine Platte in absehbarer Zeit voll läuft ──
// Zustandsbasiert (Alarm + Entwarnung) über dieselbe Streak-Logik wie die Schwellwerte;
// aufgerufen alle 15 Minuten, bewusst NICHT im 30-s-Zyklus (die Prognose ändert sich nur täglich).
const FORECAST_WARN_DAYS = 30;

function tageText(tage) {
  if (tage <= 1) return 'binnen eines Tages';
  return `in ca. ${tage} Tagen`;
}

export async function checkForecastAlerts(forecast) {
  const db = getDb();
  const channels = db.prepare('SELECT * FROM alert_channels WHERE enabled = 1').all();
  for (const channel of channels) {
    const events = JSON.parse(channel.events || '[]');
    if (!events.includes('disk_forecast')) continue;
    for (const s of forecast.servers || []) {
      const knapp = s.daysUntilFull !== null && s.daysUntilFull <= FORECAST_WARN_DAYS;
      await handleThreshold(db, channel, {
        event: 'disk_forecast',
        scope: s.serverId,
        subject: s.serverName,
        isHigh: knapp,
        alert: (name) => ({
          title: `🗄️ Speicherplatz wird knapp: ${name}`,
          message: `Die Platte${s.mountPoint ? ` \`${s.mountPoint}\`` : ''} von **${name}** ist laut Prognose${tageText(s.daysUntilFull)} voll (${fmtPct(s.percent)} belegt, Zuwachs ca. ${((s.bytesPerDay || 0) / 1e9).toFixed(1).replace('.', ',')} GB/Tag).`,
          color: s.daysUntilFull <= 7 ? 0xff4444 : 0xff8800,
        }),
        recovery: (name) => ({
          title: `✅ Speicherplatz entspannt: ${name}`,
          message: `Die Prognose für **${name}** zeigt keinen Engpass mehr (${fmtPct(s.percent)} belegt).`,
          color: 0x10b981,
        }),
      });
    }
  }
}

// ── RAM-Trend: dauerhaft steigender Grundbedarf = Speicherleck-Verdacht ──
// Alle 15 Minuten aus dem Job; die Trenddaten ändern sich nur stündlich.
export async function checkMemoryTrendAlerts() {
  const db = getDb();
  const channels = db.prepare('SELECT * FROM alert_channels WHERE enabled = 1').all();
  if (!channels.length) return;
  const trends = getMemoryTrends();
  for (const channel of channels) {
    const events = JSON.parse(channel.events || '[]');
    if (!events.includes('ram_trend')) continue;
    for (const t of trends) {
      if (maintenanceFor(t.serverId)) continue;
      if (muteMetric(t.serverId, 'ram')) continue;
      await handleThreshold(db, channel, {
        event: 'ram_trend',
        scope: t.serverId,
        subject: t.serverName,
        isHigh: t.status === 'steigend',
        isOk: t.status !== 'steigend',
        alert: (name) => ({
          title: `📈 RAM-Bedarf steigt: ${name}`,
          message: `Der Grundbedarf an Arbeitsspeicher von **${name}** wächst seit ${t.days} Tagen um ca. **${String(t.slopePerDay).replace('.', ',')} Prozentpunkte pro Tag**${t.daysUntilFull ? ` — bei gleichem Tempo ist er in etwa ${t.daysUntilFull} Tagen voll` : ''}. Typisch für ein Speicherleck.`,
          color: 0xff8800,
        }),
        recovery: (name) => ({
          title: `✅ RAM-Bedarf stabil: ${name}`,
          message: `Der RAM-Grundbedarf von **${name}** steigt nicht mehr.`,
          color: 0x10b981,
        }),
      });
    }
  }
}

function muteMetric(serverId, metric) {
  return getServerOverrides(serverId)[metric] === null;
}

// ── Image-Updates: nur melden, wenn ein Container NEU veraltet ist ──
// Gemerkt in der Datenbank — im Arbeitsspeicher kam nach jedem Deploy dieselbe Meldung erneut.
// Wer eine Woche lang nicht mehr als veraltet auftaucht, gilt wieder als neu.
const IMAGE_VERGESSEN_MS = 7 * 24 * 60 * 60 * 1000;

function neuVeraltet(namen) {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'image_meldung'").get();
  let gemerkt = {};
  try { gemerkt = row?.value ? JSON.parse(row.value) : {}; } catch { /* neu beginnen */ }
  const jetzt = Date.now();
  for (const [name, zeit] of Object.entries(gemerkt)) if (jetzt - zeit > IMAGE_VERGESSEN_MS) delete gemerkt[name];
  const neu = namen.filter(n => !(n in gemerkt));
  for (const n of namen) gemerkt[n] = jetzt;
  db.prepare("INSERT INTO settings (key, value) VALUES ('image_meldung', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(JSON.stringify(gemerkt));
  return neu;
}

export async function notifyImageUpdates(lauf) {
  const veraltet = lauf?.outdated || [];
  // Name statt Container-ID: die ID wechselt bei jedem Neuanlegen.
  const namen = (lauf?.servers || []).flatMap(s => s.containers.filter(c => c.hasUpdate).map(c => `${s.serverId}/${c.containerName}`));
  if (neuVeraltet(namen).length === 0) return;

  const proServer = new Map();
  for (const s of lauf.servers || []) {
    const namen = s.containers.filter(c => c.hasUpdate).map(c => c.containerName);
    if (namen.length) proServer.set(s.serverName, namen);
  }
  const zeilen = [...proServer].slice(0, 12).map(([name, namen]) => `**${name}**: ${namen.slice(0, 8).join(', ')}${namen.length > 8 ? ` und ${namen.length - 8} weitere` : ''}`);

  await notify('image_updates', {
    title: `🐳 ${veraltet.length} Container laufen auf einem veralteten Image`,
    message: zeilen.join('\n'),
    color: 0xff8800,
  });
}
