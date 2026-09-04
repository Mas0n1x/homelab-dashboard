/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { getDb } from './database.js';

// ── Discord-Embed-Branding ───────────────────────────────────────
// Zentrale Optik für alle Alerts: einheitlicher Absender, verfeinerte
// Discord-native Farbpalette, Severity-Author-Zeile und Kategorie-Label.
const BRAND = {
  name: process.env.HOMELAB_WEBHOOK_NAME || 'Homelab Monitor',
  avatar: process.env.HOMELAB_WEBHOOK_AVATAR || null, // optional: URL zu einem Avatar-Bild
};

// Severity-Definitionen (Discord-native Töne wirken edler als grelle Vollfarben).
const SEVERITY = {
  critical: { color: 0xed4245, icon: '🔴', label: 'Kritisch' },
  warning:  { color: 0xf0a020, icon: '🟠', label: 'Warnung' },
  success:  { color: 0x57f287, icon: '🟢', label: 'Entwarnung' },
  info:     { color: 0x5865f2, icon: '🔵', label: 'Info' },
};

// Alte Roh-Farben der Aufrufer auf ein Severity-Level abbilden.
function severityFromColor(color) {
  switch (color) {
    case 0x00ff88:
    case 0x10b981: return 'success';
    case 0xff8800: return 'warning';
    case 0x00d4ff:
    case 0x6366f1: return 'info';
    case 0xff4444: return 'critical';
    default:       return 'info';
  }
}

// Lesbares Kategorie-Label aus dem Event-Typ (Suffixe wie ::ok / ::/mnt weg).
const EVENT_CATEGORY = {
  cpu_high: 'System · CPU',
  ram_high: 'System · Arbeitsspeicher',
  disk_high: 'System · Speicherplatz',
  temp_high: 'System · Temperatur',
  reboot: 'System · Neustart',
  container_crash: 'Docker · Container',
  container_restart: 'Docker · Container',
  service_offline: 'Dienste',
  status_report: 'Statusbericht',
  new_portfolio_request: 'Portfolio · Anfrage',
  new_portfolio_customer: 'Portfolio · Kunde',
  backup_completed: 'Backup · Erfolg',
  backup_failed: 'Backup · Fehler',
  test: 'Verbindungstest',
};
function categoryFromEvent(event) {
  const base = String(event || '').split('::')[0];
  return EVENT_CATEGORY[base] || 'Homelab';
}

// Send webhook notification.
// payload: { event, title, message, color, fields?: [{name,value,inline}], footer?, record? (default true) }
async function sendWebhook(channel, payload) {
  try {
    let body;
    if (channel.type === 'discord') {
      const sev = SEVERITY[severityFromColor(payload.color)] || SEVERITY.info;
      const category = categoryFromEvent(payload.event);

      const embed = {
        author: { name: `${sev.icon}  ${category}` },
        title: payload.title,
        description: payload.message,
        color: sev.color,
        timestamp: new Date().toISOString(),
      };
      if (Array.isArray(payload.fields) && payload.fields.length) {
        embed.fields = payload.fields.slice(0, 25).map(f => ({
          name: String(f.name).substring(0, 256),
          value: String(f.value).substring(0, 1024) || '—',
          inline: !!f.inline,
        }));
      }
      embed.footer = { text: payload.footer || `${BRAND.name} · ${sev.label}` };
      body = {
        username: BRAND.name,
        ...(BRAND.avatar ? { avatar_url: BRAND.avatar } : {}),
        embeds: [embed],
      };
    } else {
      // Telegram (Markdown)
      const extra = Array.isArray(payload.fields)
        ? '\n' + payload.fields.map(f => `*${f.name}:* ${f.value}`).join('\n')
        : '';
      body = { text: `*${payload.title}*\n${payload.message}${extra}`, parse_mode: 'Markdown' };
    }

    await fetch(channel.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (payload.record !== false) {
      const db = getDb();
      db.prepare('INSERT INTO alert_history (channel_id, event_type, message) VALUES (?, ?, ?)')
        .run(channel.id, payload.event, payload.message);
    }

    return true;
  } catch (error) {
    console.error(`Alert send failed (${channel.name}):`, error.message);
    return false;
  }
}

// Edge-getriggerte Schwellwert-Alerts mit Recovery (Hysterese).
// Sendet EINMAL beim Überschreiten und EINMAL bei Normalisierung – kein Spam.
// Der Zustand wird über event_type in der alert_history gehalten
// (z. B. "cpu_high::pi-5" bzw. "disk_high::pi-5::/mnt" + "…::ok").
// WICHTIG: Der Zustand muss pro Server (scope) getrennt sein, sonst
// „entwarnt" ein ruhiger Server den Alarm eines anderen (Server-Verwechslung).
//
// Streak-Gate: der Alerting-Zyklus läuft alle 30s und liest jeweils eine
// einzelne Momentaufnahme (glances). Kurze Bursts (SSH-Discovery, Docker-
// Stats-Sammlung, … überlappen gelegentlich im selben Zyklus) reißen die
// CPU/RAM kurz über die Schwelle, ohne dass der Server wirklich unter Last
// steht — das erzeugte Alarm+Entwarnung im Minutentakt. Erst ein Ausschlag
// über mehrere aufeinanderfolgende Zyklen hinweg gilt als echt.
const REQUIRED_HIGH_STREAK = 3; // ~90s anhaltend über der Schwelle
const REQUIRED_OK_STREAK = 2;   // ~60s anhaltend wieder normal
const streaks = new Map(); // key: `${channel.id}:${stateEvent}` -> { high, ok }

async function handleThreshold(db, channel, opts) {
  const { event, scope = '', subject = '', isHigh, alert, recovery } = opts;
  const stateEvent = [event, scope, subject].filter(Boolean).join('::');
  const okEvent = `${stateEvent}::ok`;

  const streakKey = `${channel.id}:${stateEvent}`;
  const streak = streaks.get(streakKey) || { high: 0, ok: 0 };
  if (isHigh) { streak.high += 1; streak.ok = 0; }
  else { streak.ok += 1; streak.high = 0; }
  streaks.set(streakKey, streak);

  const lastAlert = db.prepare(
    "SELECT sent_at FROM alert_history WHERE channel_id = ? AND event_type = ? AND sent_at > datetime('now','-1 day') ORDER BY sent_at DESC LIMIT 1"
  ).get(channel.id, stateEvent);
  const lastOk = db.prepare(
    "SELECT sent_at FROM alert_history WHERE channel_id = ? AND event_type = ? AND sent_at > datetime('now','-1 day') ORDER BY sent_at DESC LIMIT 1"
  ).get(channel.id, okEvent);

  const alerting = !!lastAlert && (!lastOk || lastAlert.sent_at > lastOk.sent_at);

  if (isHigh && !alerting && streak.high >= REQUIRED_HIGH_STREAK) {
    await sendWebhook(channel, { event: stateEvent, ...alert(subject) });
  } else if (!isHigh && alerting && recovery && streak.ok >= REQUIRED_OK_STREAK) {
    await sendWebhook(channel, { event: okEvent, ...recovery(subject) });
  }
}

// ── Formatierungs-Helfer ─────────────────────────────────────────
function fmtPct(n) { return `${Number(n || 0).toFixed(1)}%`; }
function fmtBytes(b) {
  if (!b || b <= 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = b, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${u[i]}`;
}
function progressBar(pct) {
  const p = Math.max(0, Math.min(100, Number(pct || 0)));
  const filled = Math.round(p / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}
// Rohe Image-Referenzen lesbar machen (nackte sha256-Hashes kürzen).
function fmtImage(img) {
  const s = String(img || '').trim();
  const m = s.match(/^sha256:([0-9a-f]{12})/i);
  if (m) return `\`${m[1]}\``;
  return s.length > 48 ? `\`${s.substring(0, 45)}…\`` : `\`${s}\``;
}
// Container-Status mit Punkt-Indikator lesbar darstellen.
function fmtContainerState(state) {
  const s = String(state || 'unbekannt').toLowerCase();
  const map = { running: '🟢 läuft', exited: '⚪ beendet', dead: '🔴 tot', created: '🔵 erstellt', paused: '🟠 pausiert', restarting: '🟠 startet neu' };
  return map[s] || `⚪ ${s}`;
}

// Gemeinsame Kontext-Felder für System-Alerts.
function contextFields(data) {
  const f = [];
  if (data.serverName) f.push({ name: '🖥️ Server', value: data.serverName, inline: true });
  if (data.systemStats?.uptime && data.systemStats.uptime !== 'N/A') {
    f.push({ name: '⏱️ Uptime', value: String(data.systemStats.uptime), inline: true });
  }
  return f;
}

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

// Check and fire alerts
export async function checkAlerts(data) {
  const db = getDb();
  const TH = getThresholds();
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

    // CPU
    if (events.includes('cpu_high')) {
      const v = data.cpuPercent || 0;
      await handleThreshold(db, channel, {
        event: 'cpu_high',
        scope,
        isHigh: v > TH.cpu.high,
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
    if (events.includes('ram_high')) {
      const v = data.memPercent || 0;
      const memInfo = stats?.memory ? `${fmtBytes(stats.memory.used)} / ${fmtBytes(stats.memory.total)}` : null;
      await handleThreshold(db, channel, {
        event: 'ram_high',
        scope,
        isHigh: v > TH.ram.high,
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
    if (events.includes('disk_high')) {
      for (const d of disks) {
        const v = Number(d.percent) || 0;
        await handleThreshold(db, channel, {
          event: 'disk_high',
          scope,
          subject: d.mountPoint || d.device || 'disk',
          isHigh: v > TH.disk.high,
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
    if (events.includes('temp_high') && maxTemp !== null) {
      await handleThreshold(db, channel, {
        event: 'temp_high',
        scope,
        isHigh: maxTemp > TH.temp.high,
        alert: () => ({
          title: '🌡️ CPU-Temperatur hoch',
          message: `Die höchste gemessene Temperatur liegt bei **${maxTemp.toFixed(1)} °C**.`,
          color: 0xff4444,
          fields: [
            ...temps.slice(0, 6).map(t => ({ name: t.label || 'Sensor', value: `${Number(t.value).toFixed(1)} °C`, inline: true })),
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

    // Service offline
    if (events.includes('service_offline') && data.offlineServices?.length > 0) {
      for (const s of data.offlineServices) {
        const recent = db.prepare(
          "SELECT id FROM alert_history WHERE channel_id = ? AND event_type = 'service_offline' AND message LIKE ? AND sent_at > datetime('now', '-10 minutes')"
        ).get(channel.id, `%${s.name}%`);
        if (!recent) {
          await sendWebhook(channel, {
            event: 'service_offline',
            title: '🔴 Service offline',
            message: `Service **${s.name}** ist nicht erreichbar`,
            color: 0xff4444,
          });
        }
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

// Get all channels
export function getChannels() {
  const db = getDb();
  return db.prepare('SELECT * FROM alert_channels ORDER BY created_at DESC').all().map(c => ({
    ...c,
    events: JSON.parse(c.events || '[]'),
    enabled: !!c.enabled,
  }));
}

// Add channel
export function addChannel(data) {
  const db = getDb();
  const id = `alert-${Date.now()}`;
  db.prepare(
    'INSERT INTO alert_channels (id, type, name, webhook_url, events) VALUES (?, ?, ?, ?, ?)'
  ).run(id, data.type, data.name, data.webhookUrl, JSON.stringify(data.events || []));
  return { id };
}

// Update channel
export function updateChannel(id, data) {
  const db = getDb();
  const sets = [];
  const vals = [];
  if (data.name !== undefined) { sets.push('name = ?'); vals.push(data.name); }
  if (data.webhookUrl !== undefined) { sets.push('webhook_url = ?'); vals.push(data.webhookUrl); }
  if (data.enabled !== undefined) { sets.push('enabled = ?'); vals.push(data.enabled ? 1 : 0); }
  if (data.events !== undefined) { sets.push('events = ?'); vals.push(JSON.stringify(data.events)); }
  if (sets.length === 0) return;
  vals.push(id);
  db.prepare(`UPDATE alert_channels SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

// Delete channel
export function deleteChannel(id) {
  const db = getDb();
  db.prepare('DELETE FROM alert_channels WHERE id = ?').run(id);
  db.prepare('DELETE FROM alert_history WHERE channel_id = ?').run(id);
}

// Get alert history
export function getAlertHistory(limit = 50) {
  const db = getDb();
  return db.prepare(
    'SELECT h.*, c.name as channel_name, c.type as channel_type FROM alert_history h LEFT JOIN alert_channels c ON h.channel_id = c.id ORDER BY h.sent_at DESC LIMIT ?'
  ).all(limit);
}

// Test webhook
export async function testWebhook(channel) {
  return sendWebhook(channel, {
    event: 'test',
    title: '✅ Test-Benachrichtigung',
    message: 'Webhook funktioniert! Verbindung zum Homelab Dashboard hergestellt.',
    color: 0x00ff88,
  });
}
