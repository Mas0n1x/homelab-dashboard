import { Router } from 'express';
import * as alerting from '../services/alerting.js';

const router = Router();

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
