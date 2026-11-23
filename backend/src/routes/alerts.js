/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';
import * as alerting from '../services/alerting.js';
import { getDb } from '../services/database.js';
import { logAudit } from '../services/audit.js';

const router = Router();

// Alert-Schwellen (konfigurierbar) lesen/setzen
router.get('/thresholds', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'alert_thresholds'").get();
    const cfg = row?.value ? JSON.parse(row.value) : {};
    res.json({ cpu: cfg.cpu ?? 90, ram: cfg.ram ?? 90, disk: cfg.disk ?? 90, temp: cfg.temp ?? 75 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/thresholds', (req, res) => {
  try {
    const num = (v, d) => (typeof v === 'number' && v > 0 && v <= 200 ? v : d);
    const cfg = {
      cpu: num(req.body.cpu, 90),
      ram: num(req.body.ram, 90),
      disk: num(req.body.disk, 90),
      temp: num(req.body.temp, 75),
    };
    const db = getDb();
    db.prepare("INSERT INTO settings (key, value) VALUES ('alert_thresholds', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(cfg));
    res.json(cfg);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all alert channels
router.get('/channels', (req, res) => {
  try {
    res.json(alerting.getChannels());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add alert channel
router.post('/channels', (req, res) => {
  try {
    const result = alerting.addChannel(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update alert channel
router.put('/channels/:id', (req, res) => {
  try {
    alerting.updateChannel(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete alert channel
router.delete('/channels/:id', (req, res) => {
  try {
    alerting.deleteChannel(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test webhook
router.post('/channels/:id/test', async (req, res) => {
  try {
    // Rohzeile: bei Push-Kanälen liegt die Anmeldung in webhook_url, die getChannels() ausblendet.
    const channel = alerting.getChannelRaw(req.params.id);
    if (!channel) return res.status(404).json({ error: 'Channel not found' });
    const success = await alerting.testWebhook(channel);
    res.json({ success });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get alert history
router.get('/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    res.json(alerting.getAlertHistory(limit));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Live-Übersicht je Server: aktive Alarme (mit Hysterese), wirksame Schwellen, Wartungsfenster.
router.get('/active', (req, res) => {
  try {
    res.json({ servers: alerting.getAlertOverview(), maintenance: alerting.getMaintenance() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Schwellen-Overrides pro Server ({"truenas": {"cpu": null, "ram": 95}})
router.get('/overrides', (req, res) => {
  try {
    res.json(alerting.getAllOverrides());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/overrides', (req, res) => {
  try {
    const sauber = alerting.setAllOverrides(req.body);
    logAudit('alerts.overrides', `${Object.keys(sauber).length} Server`, null, req.user?.id);
    res.json(sauber);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Wartungsfenster: keine Benachrichtigungen für einen Server (oder alle) bis zum Ablauf
router.get('/maintenance', (req, res) => {
  try {
    res.json(alerting.getMaintenance());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/maintenance', (req, res) => {
  try {
    const fenster = alerting.addMaintenance(req.body || {});
    logAudit('alerts.maintenance', `${fenster.serverId} bis ${fenster.until}`, null, req.user?.id);
    res.json(fenster);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/maintenance/:id', (req, res) => {
  try {
    alerting.removeMaintenance(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Web-Push: öffentlicher VAPID-Schlüssel + Geräteanmeldung
router.get('/vapid-key', (req, res) => {
  try {
    res.json({ publicKey: alerting.getVapidPublicKey() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/push/subscribe', (req, res) => {
  try {
    const result = alerting.subscribePush(req.body || {});
    logAudit('alerts.push', result.updated ? 'Gerät erneuert' : 'Gerät angemeldet', null, req.user?.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
