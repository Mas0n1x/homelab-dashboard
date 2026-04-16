import { Router } from 'express';
import {
  getProcessList,
  getNetworkConfig,
  getDiskHealth,
  getSystemdServices,
  getUpdateStatus,
} from '../services/maintenance.js';

const router = Router();

// GET /api/maintenance/:serverId/processes
router.get('/:serverId/processes', async (req, res) => {
  try {
    const processes = await getProcessList(req.params.serverId);
    res.json(processes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/maintenance/:serverId/network
router.get('/:serverId/network', async (req, res) => {
  try {
    const config = await getNetworkConfig(req.params.serverId);
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/maintenance/:serverId/disk-health
router.get('/:serverId/disk-health', async (req, res) => {
  try {
    const health = await getDiskHealth(req.params.serverId);
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/maintenance/:serverId/systemd
router.get('/:serverId/systemd', async (req, res) => {
  try {
    const services = await getSystemdServices(req.params.serverId);
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/maintenance/:serverId/updates
router.get('/:serverId/updates', async (req, res) => {
  try {
    const status = await getUpdateStatus(req.params.serverId);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
