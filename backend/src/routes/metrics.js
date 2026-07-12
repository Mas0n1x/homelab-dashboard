/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';
import { getMetrics } from '../services/metrics.js';

const router = Router();

// Metrik-Verlauf eines Servers (Standard 60 Min) fuer Sparklines/Charts.
router.get('/:serverId', (req, res) => {
  try {
    const minutes = Math.min(parseInt(req.query.minutes) || 60, 2880);
    res.json(getMetrics(req.params.serverId, minutes));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch metrics', message: error.message });
  }
});

export default router;
