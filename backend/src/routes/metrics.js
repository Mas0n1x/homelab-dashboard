/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';
import { getMetrics } from '../services/metrics.js';
import { getDiskForecast } from '../services/diskForecast.js';

const router = Router();

// Füllstand-Prognose je Server aus den Tageswerten.
// MUSS vor '/:serverId' stehen — sonst schluckt die Parameter-Route den Pfad
// und sucht einen Server namens „disk-forecast".
router.get('/disk-forecast', (req, res) => {
  try {
    const days = Math.min(365, Math.max(7, parseInt(req.query.days, 10) || 30));
    res.json(getDiskForecast(days));
  } catch (error) {
    res.status(500).json({ error: 'Prognose fehlgeschlagen', message: error.message });
  }
});

// Metrik-Verlauf eines Servers (Standard 60 Min) für Sparklines/Charts.
router.get('/:serverId', (req, res) => {
  try {
    const minutes = Math.min(parseInt(req.query.minutes) || 60, 2880);
    res.json(getMetrics(req.params.serverId, minutes));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch metrics', message: error.message });
  }
});

export default router;
