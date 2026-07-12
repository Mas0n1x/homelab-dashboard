/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';

const router = Router();
const ACCOUNT_ID = process.env.CF_ACCOUNT_ID || '2916e63238fd7f5347e2b5a250125c9b';

// 30s-Cache, damit die CF-API nicht bei jedem Request getroffen wird.
let cache = { at: 0, data: [] };

// Alle Cloudflare-Tunnel + ihr Health-Status (der Token liegt in der Backend-.env).
router.get('/', async (req, res) => {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) return res.json([]);
  try {
    if (Date.now() - cache.at < 30000 && cache.data.length) return res.json(cache.data);
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/cfd_tunnel?is_deleted=false`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const j = await r.json();
    if (!j.success) return res.status(502).json({ error: 'Cloudflare API error' });
    const data = (j.result || []).map(t => ({
      id: t.id,
      name: t.name,
      status: t.status, // healthy | degraded | down | inactive
      connections: (t.connections || []).length,
    }));
    cache = { at: Date.now(), data };
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tunnels', message: error.message });
  }
});

export default router;
