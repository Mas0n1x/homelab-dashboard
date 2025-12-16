import { Router } from 'express';
import * as dockerService from '../services/docker.js';

const router = Router();

// Get Docker info
router.get('/info', async (req, res) => {
  try {
    const info = await dockerService.getDockerInfo();
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Docker info', message: error.message });
  }
});

// Get all containers
router.get('/containers', async (req, res) => {
  try {
    const containers = await dockerService.getContainers();
    res.json(containers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch containers', message: error.message });
  }
});

// Get container stats
router.get('/containers/:id/stats', async (req, res) => {
  try {
    const stats = await dockerService.getContainerStats(req.params.id);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch container stats', message: error.message });
  }
});

// Get container logs
router.get('/containers/:id/logs', async (req, res) => {
  try {
    const tail = parseInt(req.query.tail) || 100;
    const logs = await dockerService.getContainerLogs(req.params.id, tail);
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch container logs', message: error.message });
  }
});

// Start container
router.post('/containers/:id/start', async (req, res) => {
  try {
    const result = await dockerService.startContainer(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to start container', message: error.message });
  }
});

// Stop container
router.post('/containers/:id/stop', async (req, res) => {
  try {
    const result = await dockerService.stopContainer(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to stop container', message: error.message });
  }
});

// Restart container
router.post('/containers/:id/restart', async (req, res) => {
  try {
    const result = await dockerService.restartContainer(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to restart container', message: error.message });
  }
});

export default router;
