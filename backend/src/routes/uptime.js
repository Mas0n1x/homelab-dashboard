import { Router } from 'express';
import { getUptimePercent, getUptimeHistory, getUptimeSummary } from '../services/uptime.js';

const router = Router();

// Get uptime summary for all services on a server
router.get('/summary', (req, res) => {
  try {
    const serverId = req.query.serverId || 'local';
    const summary = getUptimeSummary(serverId);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch uptime summary', message: error.message });
  }
});

// Get uptime for a specific service
router.get('/:serviceId', (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const percent = getUptimePercent(req.params.serviceId, hours);
    const history = getUptimeHistory(req.params.serviceId, hours);
    res.json({ serviceId: req.params.serviceId, percent, history, hours });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch uptime', message: error.message });
  }
});

export default router;
