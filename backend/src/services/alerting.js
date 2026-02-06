import { getDb } from './database.js';

// Send webhook notification
async function sendWebhook(channel, payload) {
  try {
    const body = channel.type === 'discord'
      ? { embeds: [{ title: payload.title, description: payload.message, color: payload.color || 0xff4444, timestamp: new Date().toISOString() }] }
      : { text: `*${payload.title}*\n${payload.message}`, parse_mode: 'Markdown' };

    await fetch(channel.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const db = getDb();
    db.prepare('INSERT INTO alert_history (channel_id, event_type, message) VALUES (?, ?, ?)')
      .run(channel.id, payload.event, payload.message);

    return true;
  } catch (error) {
    console.error(`Alert send failed (${channel.name}):`, error.message);
    return false;
  }
}

// Check and fire alerts
export async function checkAlerts(data) {
  const db = getDb();
  const channels = db.prepare('SELECT * FROM alert_channels WHERE enabled = 1').all();
  if (channels.length === 0) return;

  for (const channel of channels) {
    const events = JSON.parse(channel.events || '[]');

    // CPU high alert
    if (events.includes('cpu_high') && data.cpuPercent > 90) {
      const recent = db.prepare(
        "SELECT id FROM alert_history WHERE channel_id = ? AND event_type = 'cpu_high' AND sent_at > datetime('now', '-5 minutes')"
      ).get(channel.id);
      if (!recent) {
        await sendWebhook(channel, {
          event: 'cpu_high',
          title: '🔥 CPU Auslastung hoch',
          message: `CPU bei ${data.cpuPercent.toFixed(1)}%`,
          color: 0xff8800,
        });
      }
    }

    // RAM high alert
    if (events.includes('ram_high') && data.memPercent > 90) {
      const recent = db.prepare(
        "SELECT id FROM alert_history WHERE channel_id = ? AND event_type = 'ram_high' AND sent_at > datetime('now', '-5 minutes')"
      ).get(channel.id);
      if (!recent) {
        await sendWebhook(channel, {
          event: 'ram_high',
          title: '💾 RAM Auslastung hoch',
          message: `RAM bei ${data.memPercent.toFixed(1)}%`,
          color: 0xff8800,
        });
      }
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
            message: `Container **${c.name}** ist nicht mehr aktiv (${c.state})`,
            color: 0xff4444,
          });
        }
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
