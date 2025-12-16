import { Router } from 'express';
import * as glances from '../services/glances.js';

const router = Router();

// Get all system stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await glances.getSystemStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch system stats', message: error.message });
  }
});

// Get CPU stats
router.get('/cpu', async (req, res) => {
  try {
    const cpu = await glances.getCpu();
    res.json(cpu);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch CPU stats', message: error.message });
  }
});

// Get memory stats
router.get('/memory', async (req, res) => {
  try {
    const memory = await glances.getMemory();
    res.json(memory);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch memory stats', message: error.message });
  }
});

// Get disk stats
router.get('/disk', async (req, res) => {
  try {
    const disk = await glances.getDisk();
    res.json(disk);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch disk stats', message: error.message });
  }
});

// Get network stats
router.get('/network', async (req, res) => {
  try {
    const network = await glances.getNetwork();
    res.json(network);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch network stats', message: error.message });
  }
});

// Get sensor stats (temperature)
router.get('/sensors', async (req, res) => {
  try {
    const sensors = await glances.getSensors();
    res.json(sensors);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sensor stats', message: error.message });
  }
});

export default router;
