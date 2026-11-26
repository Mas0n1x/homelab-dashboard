/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Laufende Prüfung der Server und Dienste
import { getDb } from '../database.js';
import { sendWebhook } from './senden.js';
import { REQUIRED_HIGH_STREAK, REQUIRED_OK_STREAK, handleThreshold } from './zustand.js';
import { fmtPct, fmtBytes, progressBar, fmtImage, fmtContainerState, contextFields } from './format.js';
import { getThresholds, OK_GAP, OVERRIDE_METRIKEN, getServerOverrides, maintenanceFor } from './einstellungen.js';

// Keine Messung ist nicht dasselbe wie 0 %: ohne Werte darf weder alarmiert noch
// entwarnt werden.
function ramBekannt(stats) {
  return !!stats && !stats.fehlend?.includes('mem');
}

// ── Ausfälle ─────────────────────────────────────────────────────
// Ein Dienst muss seit dem Start einmal erreichbar gewesen sein, bevor sein
// Ausfall meldet — sonst fluten nach jedem Neustart alle dauerhaft toten Dienste.
const warOnline = new Set();

/** services: [{ key, name, online }] eines Servers aus dem Uptime-Lauf. */
export async function checkServiceAlerts({ serverId, serverName, services }) {
  if (maintenanceFor(serverId)) return;
  const db = getDb();
  const channels = db.prepare('SELECT * FROM alert_channels WHERE enabled = 1').all()
    .filter(c => JSON.parse(c.events || '[]').includes('service_offline'));

  for (const s of services) {
    const merk = `${serverId}|${s.key}`;
    if (s.online) warOnline.add(merk);
    for (const channel of channels) {
      await handleThreshold(db, channel, {
        event: 'service_offline',
        scope: serverId,
        subject: s.name,
        isHigh: !s.online && warOnline.has(merk),
        isOk: s.online,
        stateWindow: '-30 days',
        alert: (name) => ({
          title: `🔴 Dienst offline: ${name}`,
          message: `**${name}** auf **${serverName}** ist nicht erreichbar.`,
          color: 0xff4444,
        }),
        recovery: (name) => ({
          title: `✅ Dienst wieder da: ${name}`,
          message: `**${name}** auf **${serverName}** ist wieder erreichbar.`,
          color: 0x00ff88,
        }),
      });
    }
  }
}

// ── Live-Zustand ─────────────────────────────────────────────────
// Unabhängig von Kanälen und Wartungsfenstern: was ist JETZT auffällig? Gleiche
// Streak-/Hysterese-Regeln wie bei den Benachrichtigungen, damit Karte und
// Alarm dasselbe meinen (vorher rechnete die Karte allein aus dem Rohwert und
// blinkte rot, wo nie ein Alarm kam).
const live = new Map(); // serverId -> Map(key -> Eintrag)
const METRIK_LABEL = { cpu: 'CPU', ram: 'RAM', disk: 'Speicher', temp: 'Temperatur' };

function trackLive(data, TH, muted) {
  const serverId = data.serverId;
  if (!serverId || !data.systemStats) return;
  const m = live.get(serverId) || new Map();
  live.set(serverId, m);
  const gesehen = new Set();

  const upd = (metric, subject, value, th) => {
    const key = subject ? `${metric}::${subject}` : metric;
    gesehen.add(key);
    const e = m.get(key) || { metric, subject: subject || null, high: 0, ok: 0, active: false, since: null };
    if (value > th.high) { e.high += 1; e.ok = 0; }
    else if (value < th.ok) { e.ok += 1; e.high = 0; }
    else { e.high = 0; e.ok = 0; }
    if (!e.active && e.high >= REQUIRED_HIGH_STREAK) { e.active = true; e.since = new Date().toISOString(); }
    if (e.active && e.ok >= REQUIRED_OK_STREAK) { e.active = false; e.since = null; }
    e.value = value;
    e.limit = th.high;
    m.set(key, e);
  };

  const stats = data.systemStats;
  if (!muted.has('cpu')) upd('cpu', null, data.cpuPercent || 0, TH.cpu);
  if (!muted.has('ram')) {
    // Fehlt der Speicherwert, bleibt der bisherige Zustand stehen.
    if (ramBekannt(stats)) upd('ram', null, data.memPercent || 0, TH.ram);
    else gesehen.add('ram');
  }
  if (!muted.has('disk')) {
    for (const d of stats.disk || []) upd('disk', d.mountPoint || d.device || 'disk', Number(d.percent) || 0, TH.disk);
  }
  const temps = stats.temperature || [];
  if (temps.length && !muted.has('temp')) upd('temp', null, Math.max(...temps.map(t => Number(t.value) || 0)), TH.temp);

  for (const key of [...m.keys()]) if (!gesehen.has(key)) m.delete(key);
}

function effektiveSchwellen(serverId) {
  const TH = { ...getThresholds() };
  const muted = new Set();
  for (const [k, v] of Object.entries(getServerOverrides(serverId))) {
    if (!TH[k]) continue;
    if (v === null) muted.add(k);
    else if (typeof v === 'number' && v > 0 && v <= 200) TH[k] = { high: v, ok: Math.max(0, v - OK_GAP[k]) };
  }
  return { TH, muted };
}

/** Übersicht für Fleet-Karten, Attention-Center und Alarm-Seite. */
export function getAlertOverview() {
  const servers = getDb().prepare('SELECT id, name FROM servers').all();
  const out = {};
  for (const s of servers) {
    const { TH, muted } = effektiveSchwellen(s.id);
    const wartung = maintenanceFor(s.id);
    const aktiv = [...(live.get(s.id)?.values() || [])].filter(e => e.active).map(e => ({
      metric: e.metric,
      label: METRIK_LABEL[e.metric] + (e.subject ? ` ${e.subject}` : ''),
      subject: e.subject,
      value: Math.round(e.value * 10) / 10,
      limit: e.limit,
      since: e.since,
    }));
    out[s.id] = {
      name: s.name,
      alerts: aktiv,
      // Wirksame Schwellen (null = Metrik abgeschaltet) — Karten färben danach.
      limits: Object.fromEntries(OVERRIDE_METRIKEN.map(k => [k, muted.has(k) ? null : TH[k].high])),
      maintenance: wartung ? { id: wartung.id, until: wartung.until, reason: wartung.reason } : null,
    };
  }
  return out;
}

// Check and fire alerts
export async function checkAlerts(data) {
  const db = getDb();
  const { TH, muted } = effektiveSchwellen(data.serverId); // Kopie: Overrides dürfen nicht auf andere Server durchschlagen
  trackLive(data, TH, muted);
  // Wartungsfenster: Zustand wird weiter geführt, aber nichts versendet.
  if (data.serverId && maintenanceFor(data.serverId)) return;
  const channels = db.prepare('SELECT * FROM alert_channels WHERE enabled = 1').all();
  if (channels.length === 0) return;

  const stats = data.systemStats || null;
  const disks = stats?.disk || [];
  const temps = stats?.temperature || [];
  const maxTemp = temps.length ? Math.max(...temps.map(t => Number(t.value) || 0)) : null;
  // Server-Scope für die Hysterese-Zustände: trennt Alarm/Entwarnung pro Server,
  // damit ein ruhiger Server nicht den Alarm eines anderen quittiert.
  const scope = data.serverId || data.serverName || '';

  for (const channel of channels) {
    const events = JSON.parse(channel.events || '[]');

    // Server nicht erreichbar (online ist nur bei Servern mit Messquelle gesetzt)
    if (events.includes('server_offline') && typeof data.online === 'boolean') {
      await handleThreshold(db, channel, {
        event: 'server_offline',
        scope,
        isHigh: !data.online,
        stateWindow: '-30 days',
        alert: () => ({
          title: `🔴 Server nicht erreichbar: ${data.serverName}`,
          message: `**${data.serverName}** liefert seit rund 90 Sekunden keine Messwerte.`,
          color: 0xff4444,
        }),
        recovery: () => ({
          title: `✅ Server wieder erreichbar: ${data.serverName}`,
          message: `**${data.serverName}** liefert wieder Messwerte.`,
          color: 0x00ff88,
          fields: contextFields(data),
        }),
      });
    }

    // CPU
    if (events.includes('cpu_high') && stats && !muted.has('cpu')) {
      const v = data.cpuPercent || 0;
      await handleThreshold(db, channel, {
        event: 'cpu_high',
        scope,
        isHigh: v > TH.cpu.high,
        isOk: v < TH.cpu.ok,
        alert: () => ({
          title: '🔥 CPU-Auslastung hoch',
          message: `Die CPU-Auslastung liegt bei **${fmtPct(v)}**.`,
          color: 0xff8800,
          fields: [{ name: 'Auslastung', value: `${progressBar(v)} ${fmtPct(v)}`, inline: false }, ...contextFields(data)],
        }),
        recovery: () => ({
          title: '✅ CPU wieder normal',
          message: `Die CPU-Auslastung hat sich normalisiert (**${fmtPct(v)}**).`,
          color: 0x00ff88,
          fields: contextFields(data),
        }),
      });
    }

    // RAM
    if (events.includes('ram_high') && ramBekannt(stats) && !muted.has('ram')) {
      const v = data.memPercent || 0;
      const memInfo = stats?.memory ? `${fmtBytes(stats.memory.used)} / ${fmtBytes(stats.memory.total)}` : null;
      await handleThreshold(db, channel, {
        event: 'ram_high',
        scope,
        isHigh: v > TH.ram.high,
        isOk: v < TH.ram.ok,
        alert: () => ({
          title: '💾 RAM-Auslastung hoch',
          message: `Der Arbeitsspeicher liegt bei **${fmtPct(v)}**.`,
          color: 0xff8800,
          fields: [
            { name: 'Auslastung', value: `${progressBar(v)} ${fmtPct(v)}`, inline: false },
            ...(memInfo ? [{ name: 'Belegt', value: memInfo, inline: true }] : []),
            ...contextFields(data),
          ],
        }),
        recovery: () => ({
          title: '✅ RAM wieder normal',
          message: `Der Arbeitsspeicher hat sich normalisiert (**${fmtPct(v)}**).`,
          color: 0x00ff88,
          fields: contextFields(data),
        }),
      });
    }

    // Festplatte (pro Mountpoint)
    if (events.includes('disk_high') && !muted.has('disk')) {
      for (const d of disks) {
        const v = Number(d.percent) || 0;
        await handleThreshold(db, channel, {
          event: 'disk_high',
          scope,
          subject: d.mountPoint || d.device || 'disk',
          isHigh: v > TH.disk.high,
          isOk: v < TH.disk.ok,
          alert: (subj) => ({
            title: '🗄️ Speicherplatz knapp',
            message: `Die Partition **${subj}** ist zu **${fmtPct(v)}** belegt.`,
            color: 0xff4444,
            fields: [
              { name: 'Belegung', value: `${progressBar(v)} ${fmtPct(v)}`, inline: false },
              { name: 'Genutzt', value: `${fmtBytes(d.used)} / ${fmtBytes(d.total)}`, inline: true },
              { name: 'Frei', value: fmtBytes(d.free), inline: true },
              ...contextFields(data),
            ],
          }),
          recovery: (subj) => ({
            title: '✅ Speicherplatz wieder ok',
            message: `Die Partition **${subj}** hat wieder Luft (**${fmtPct(v)}** belegt).`,
            color: 0x00ff88,
            fields: contextFields(data),
          }),
        });
      }
    }

    // CPU-Temperatur
    if (events.includes('temp_high') && maxTemp !== null && !muted.has('temp')) {
      await handleThreshold(db, channel, {
        event: 'temp_high',
        scope,
        isHigh: maxTemp > TH.temp.high,
        isOk: maxTemp < TH.temp.ok,
        alert: () => ({
          title: '🌡️ CPU-Temperatur hoch',
          message: `Die höchste gemessene Temperatur liegt bei **${maxTemp.toFixed(1)} °C**.`,
          color: 0xff4444,
          fields: [
            ...[...temps].sort((a, b) => Number(b.value) - Number(a.value)).slice(0, 6).map(t => ({ name: t.label || 'Sensor', value: `${Number(t.value).toFixed(1)} °C`, inline: true })),
            ...contextFields(data),
          ],
        }),
        recovery: () => ({
          title: '✅ Temperatur wieder normal',
          message: `Die Temperatur ist wieder im grünen Bereich (**${maxTemp.toFixed(1)} °C**).`,
          color: 0x00ff88,
          fields: contextFields(data),
        }),
      });
    }

    // Reboot erkannt
    if (events.includes('reboot') && data.rebooted) {
      await sendWebhook(channel, {
        event: 'reboot',
        title: '🔄 Neustart erkannt',
        message: `Der Server **${data.serverName || ''}** wurde neu gestartet.`,
        color: 0x00d4ff,
        fields: contextFields(data),
      });
    }

    // Container crash
    if (events.includes('container_crash') && data.crashedContainers?.length > 0) {
      for (const c of data.crashedContainers) {
        const recent = db.prepare(
          "SELECT id FROM alert_history WHERE channel_id = ? AND event_type = 'container_crash' AND message LIKE ? AND sent_at > datetime('now', '-10 minutes')"
        ).get(channel.id, `%${c.name}%`);
        if (!recent) {
          await sendWebhook(channel, {
            event: 'container_crash',
            title: '💀 Container gestoppt',
            message: `Container **${c.name}** ist nicht mehr aktiv.`,
            color: 0xff4444,
            fields: [
              { name: 'Status', value: fmtContainerState(c.state), inline: true },
              ...(data.serverName ? [{ name: '🖥️ Server', value: data.serverName, inline: true }] : []),
              ...(c.image ? [{ name: 'Image', value: fmtImage(c.image), inline: false }] : []),
            ],
          });
        }
      }
    }

    // Container wieder gestartet
    if (events.includes('container_restart') && data.restartedContainers?.length > 0) {
      for (const c of data.restartedContainers) {
        await sendWebhook(channel, {
          event: 'container_restart',
          title: '🟢 Container wieder aktiv',
          message: `Container **${c.name}** läuft wieder.`,
          color: 0x00ff88,
          fields: [
            { name: 'Status', value: fmtContainerState(c.state || 'running'), inline: true },
            ...(data.serverName ? [{ name: '🖥️ Server', value: data.serverName, inline: true }] : []),
          ],
        });
      }
    }

    // New portfolio request
    if (events.includes('new_portfolio_request') && data.portfolioRequests?.length > 0) {
      for (const req of data.portfolioRequests) {
        const reqName = req.name || req.firstName || 'Unbekannt';
        const recent = db.prepare(
          "SELECT id FROM alert_history WHERE channel_id = ? AND event_type = 'new_portfolio_request' AND message LIKE ? AND sent_at > datetime('now', '-10 minutes')"
        ).get(channel.id, `%${reqName}%`);
        if (!recent) {
          const fields = [];
          if (req.name || req.firstName) fields.push(`**Name:** ${req.name || req.firstName} ${req.lastName || ''}`);
          if (req.email) fields.push(`**E-Mail:** ${req.email}`);
          if (req.phone) fields.push(`**Telefon:** ${req.phone}`);
          if (req.projectType || req.project_type) fields.push(`**Projektart:** ${req.projectType || req.project_type}`);
          if (req.budget) fields.push(`**Budget:** ${req.budget}`);
          if (req.message || req.description) fields.push(`**Nachricht:** ${(req.message || req.description).substring(0, 200)}`);

          await sendWebhook(channel, {
            event: 'new_portfolio_request',
            title: '📩 Neue Projektanfrage',
            message: fields.length > 0 ? fields.join('\n') : `Neue Anfrage von ${reqName}`,
            color: 0x6366f1,
          });
        }
      }
    }

    // New portfolio customer
    if (events.includes('new_portfolio_customer') && data.portfolioCustomers?.length > 0) {
      for (const cust of data.portfolioCustomers) {
        const custName = cust.name || cust.company || 'Unbekannt';
        const recent = db.prepare(
          "SELECT id FROM alert_history WHERE channel_id = ? AND event_type = 'new_portfolio_customer' AND message LIKE ? AND sent_at > datetime('now', '-10 minutes')"
        ).get(channel.id, `%${custName}%`);
        if (!recent) {
          const fields = [];
          if (cust.name) fields.push(`**Name:** ${cust.name}`);
          if (cust.company) fields.push(`**Firma:** ${cust.company}`);
          if (cust.email) fields.push(`**E-Mail:** ${cust.email}`);
          if (cust.phone) fields.push(`**Telefon:** ${cust.phone}`);

          await sendWebhook(channel, {
            event: 'new_portfolio_customer',
            title: '👤 Neuer Kunde',
            message: fields.length > 0 ? fields.join('\n') : `Neuer Kunde: ${custName}`,
            color: 0x10b981,
          });
        }
      }
    }
  }
}
