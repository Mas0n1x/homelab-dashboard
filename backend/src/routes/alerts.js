/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';
import * as alerting from '../services/alerting.js';
import { getDb } from '../services/database.js';

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
    const channels = alerting.getChannels();
    const channel = channels.find(c => c.id === req.params.id);
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

export default router;
