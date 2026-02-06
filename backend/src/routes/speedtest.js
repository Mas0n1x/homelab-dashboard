import { Router } from 'express';
import * as speedtest from '../services/speedtest.js';

const router = Router();

// Get latest result
router.get('/latest', (req, res) => {
  try {
    res.json(speedtest.getLatest());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get history
router.get('/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    res.json(speedtest.getHistory(limit));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Run speedtest
router.post('/run', async (req, res) => {
  try {
    if (speedtest.isTestRunning()) {
      return res.status(409).json({ error: 'Speedtest läuft bereits' });
    }
    const result = await speedtest.runSpeedtest();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get status
router.get('/status', (req, res) => {
  res.json({ running: speedtest.isTestRunning() });
});

export default router;
