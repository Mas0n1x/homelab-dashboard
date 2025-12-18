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

// Get container details (inspect)
router.get('/containers/:id/details', async (req, res) => {
  try {
    const details = await dockerService.getContainerDetails(req.params.id);
    res.json(details);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch container details', message: error.message });
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

// ==================== IMAGES ====================

// Get all images
router.get('/images', async (req, res) => {
  try {
    const images = await dockerService.getImages();
    res.json(images);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch images', message: error.message });
  }
});

// Delete image
router.delete('/images/:id', async (req, res) => {
  try {
    const force = req.query.force === 'true';
    const result = await dockerService.deleteImage(req.params.id, force);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete image', message: error.message });
  }
});

// Prune unused images
router.post('/images/prune', async (req, res) => {
  try {
    const result = await dockerService.pruneImages();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to prune images', message: error.message });
  }
});

// ==================== VOLUMES ====================

// Get all volumes
router.get('/volumes', async (req, res) => {
  try {
    const volumes = await dockerService.getVolumes();
    res.json(volumes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch volumes', message: error.message });
  }
});

// Delete volume
router.delete('/volumes/:name', async (req, res) => {
  try {
    const force = req.query.force === 'true';
    const result = await dockerService.deleteVolume(req.params.name, force);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete volume', message: error.message });
  }
});

// Prune unused volumes
router.post('/volumes/prune', async (req, res) => {
  try {
    const result = await dockerService.pruneVolumes();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to prune volumes', message: error.message });
  }
});

// ==================== NETWORKS ====================

// Get all networks
router.get('/networks', async (req, res) => {
  try {
    const networks = await dockerService.getNetworks();
    res.json(networks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch networks', message: error.message });
  }
});

// ==================== PORTS ====================

// Get ports overview
router.get('/ports', async (req, res) => {
  try {
    const ports = await dockerService.getPortsOverview();
    res.json(ports);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch ports overview', message: error.message });
  }
});

// ==================== SYSTEM ====================

// System prune
router.post('/system/prune', async (req, res) => {
  try {
    const options = req.body || {};
    const result = await dockerService.systemPrune(options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to prune system', message: error.message });
  }
});

export default router;
