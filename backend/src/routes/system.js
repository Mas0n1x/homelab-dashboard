/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';
import serverManager from '../services/serverManager.js';

const router = Router();

// Der Glances-Client des gewählten Servers (Standard: lokal). Der frühere Direktzugriff auf
// GLANCES_URL ohne Zugangsdaten lief seit dem Passwortschutz von Glances auf 401.
function glancesFuer(req) {
  const g = serverManager.getConnection(req.query.serverId || 'local')?.glances;
  if (!g) { const e = new Error('Für diesen Server ist kein Glances konfiguriert'); throw e; }
  return g;
}

// Get all system stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await glancesFuer(req).getSystemStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch system stats', message: error.message });
  }
});

// Get CPU stats
router.get('/cpu', async (req, res) => {
  try {
    const cpu = await glancesFuer(req).getCpu();
    res.json(cpu);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch CPU stats', message: error.message });
  }
});

// Get memory stats
router.get('/memory', async (req, res) => {
  try {
    const memory = await glancesFuer(req).getMemory();
    res.json(memory);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch memory stats', message: error.message });
  }
});

// Get disk stats
router.get('/disk', async (req, res) => {
  try {
    const disk = await glancesFuer(req).getDisk();
    res.json(disk);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch disk stats', message: error.message });
  }
});

// Get network stats
router.get('/network', async (req, res) => {
  try {
    const network = await glancesFuer(req).getNetwork();
    res.json(network);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch network stats', message: error.message });
  }
});

// Get sensor stats (temperature)
router.get('/sensors', async (req, res) => {
  try {
    const sensors = await glancesFuer(req).getSensors();
    res.json(sensors);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sensor stats', message: error.message });
  }
});

export default router;
