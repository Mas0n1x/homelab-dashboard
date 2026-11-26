/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Alarmkanäle und Verlauf verwalten
import { getDb } from '../database.js';
import { sendWebhook } from './senden.js';

// Get all channels
export function getChannels() {
  const db = getDb();
  return db.prepare('SELECT * FROM alert_channels ORDER BY created_at DESC').all().map(c => {
    const basis = { ...c, events: JSON.parse(c.events || '[]'), enabled: !!c.enabled };
    if (c.type !== 'webpush') return basis;
    // Schlüssel der Push-Anmeldung bleiben im Backend; die Oberfläche braucht nur den Endpunkt,
    // um „dieses Gerät" wiederzuerkennen.
    let endpoint = null;
    try { endpoint = JSON.parse(c.webhook_url).endpoint; } catch { /* kaputte Anmeldung */ }
    return { ...basis, webhook_url: '', endpoint };
  });
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

export function getChannelRaw(id) {
  return getDb().prepare('SELECT * FROM alert_channels WHERE id = ?').get(id);
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
