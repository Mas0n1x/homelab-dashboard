/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Zustellung: Web-Push, Discord und Telegram
import * as webpush from 'web-push';
import { getDb } from '../database.js';
import { BRAND, SEVERITY, severityFromColor, categoryFromEvent } from './branding.js';
import { deleteChannel } from './kanaele.js';

// ── Web-Push (PWA) ───────────────────────────────────────────────
// Jedes Gerät, das sich anmeldet, wird als Kanal vom Typ `webpush` abgelegt
// (webhook_url = Subscription-JSON). Damit gelten Ereignis-Auswahl, Verlauf und
// Testknopf genauso wie für Discord/Telegram.
let vapidReady = null;
function vapid() {
  if (vapidReady) return vapidReady;
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = 'vapid_keys'").get();
  let keys = row?.value ? JSON.parse(row.value) : null;
  if (!keys) {
    keys = webpush.generateVAPIDKeys();
    db.prepare("INSERT INTO settings (key, value) VALUES ('vapid_keys', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(keys));
  }
  // Der Betreff geht an den Push-Dienst des Browsers (Google/Mozilla/Apple) —
  // bewusst neutral, keine eigene Adresse.
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', keys.publicKey, keys.privateKey);
  vapidReady = keys;
  return keys;
}

export function getVapidPublicKey() {
  return vapid().publicKey;
}

function klartext(s) {
  return String(s || '').replace(/\*\*/g, '').replace(/`/g, '').replace(/\n+/g, ' · ').substring(0, 240);
}

async function sendPush(channel, payload) {
  vapid();
  let sub;
  try { sub = JSON.parse(channel.webhook_url); } catch { throw new Error('Ungültige Push-Anmeldung'); }
  const sev = severityFromColor(payload.color);
  const nachricht = JSON.stringify({
    title: klartext(payload.title).substring(0, 80),
    body: klartext(payload.message),
    tag: payload.event || 'homelab',
    severity: sev,
    url: '/alerts',
  });
  try {
    await webpush.sendNotification(sub, nachricht, { TTL: 3600, urgency: sev === 'critical' ? 'high' : 'normal', timeout: SENDE_ZEITLIMIT_MS });
  } catch (error) {
    // 404/410: Gerät hat sich abgemeldet oder die Anmeldung ist abgelaufen — Kanal aufräumen.
    if (error.statusCode === 404 || error.statusCode === 410) {
      try { deleteChannel(channel.id); } catch { /* egal */ }
    }
    throw error;
  }
}

export function subscribePush({ subscription, name, events }) {
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    throw new Error('Ungültige Push-Anmeldung');
  }
  const db = getDb();
  const vorhanden = db.prepare("SELECT id, webhook_url FROM alert_channels WHERE type = 'webpush'").all()
    .find(c => { try { return JSON.parse(c.webhook_url).endpoint === subscription.endpoint; } catch { return false; } });
  const ereignisse = Array.isArray(events) && events.length ? events : PUSH_STANDARD_EVENTS;
  if (vorhanden) {
    db.prepare('UPDATE alert_channels SET webhook_url = ?, name = ?, enabled = 1 WHERE id = ?')
      .run(JSON.stringify(subscription), String(name || 'Gerät').substring(0, 60), vorhanden.id);
    return { id: vorhanden.id, updated: true };
  }
  const id = `alert-push-${Date.now()}`;
  db.prepare('INSERT INTO alert_channels (id, type, name, webhook_url, events) VALUES (?, ?, ?, ?, ?)')
    .run(id, 'webpush', String(name || 'Gerät').substring(0, 60), JSON.stringify(subscription), JSON.stringify(ereignisse));
  return { id, updated: false };
}

const SENDE_ZEITLIMIT_MS = 10000;

const PUSH_STANDARD_EVENTS = [
  'server_offline', 'cpu_high', 'ram_high', 'disk_high', 'temp_high', 'container_crash',
  'service_offline', 'backup_failed', 'disk_forecast', 'ram_trend',
];

// Send webhook notification.
// payload: { event, title, message, color, fields?: [{name,value,inline}], footer?, record? (default true) }
export async function sendWebhook(channel, payload) {
  try {
    let body;
    if (channel.type === 'webpush') {
      await sendPush(channel, payload);
    } else if (channel.type === 'discord') {
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

    if (channel.type !== 'webpush') {
      const antwort = await fetch(channel.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(SENDE_ZEITLIMIT_MS),
      });
      // Eine abgelehnte Meldung (429, 404, …) darf nicht als gesendet im Verlauf
      // landen — sonst gilt der Alarm als zugestellt und kommt nie wieder.
      if (!antwort.ok) throw new Error(`Webhook antwortet mit ${antwort.status}`);
    }

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
