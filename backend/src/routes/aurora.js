/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';

const router = Router();

const AURORA_URL = process.env.AURORA_METRICS_URL || 'http://aurora:8080';
const TOKEN = process.env.AURORA_METRICS_TOKEN || '';

// Proxy auf Auroras read-only Metrics-Endpoint (Token bleibt server-seitig).
router.get('/metrics', async (req, res) => {
  if (!TOKEN) {
    return res.status(503).json({ error: 'Aurora-Metrics nicht konfiguriert' });
  }
  try {
    const r = await fetch(`${AURORA_URL}/api/metrics?token=${encodeURIComponent(TOKEN)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return res.status(502).json({ error: `Aurora antwortete mit ${r.status}` });
    res.json(await r.json());
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

export default router;
