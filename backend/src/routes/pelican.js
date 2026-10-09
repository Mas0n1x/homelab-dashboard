/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';

const router = Router();

const PELICAN_URL = (process.env.PELICAN_URL || '').replace(/\/$/, '');
const PELICAN_API_KEY = process.env.PELICAN_API_KEY || '';
const CACHE_MS = 60 * 1000;

let cache = { at: 0, servers: [] };

// Pelican nennt die Docker-Container der Spielserver nur nach ihrer UUID. Dieser Endpunkt
// liefert UUID → Anzeigename (nur Lesezugriff, API-Schlüssel bleibt serverseitig).
router.get('/servers', async (req, res) => {
  if (!PELICAN_URL || !PELICAN_API_KEY) return res.json([]);
  if (Date.now() - cache.at < CACHE_MS) return res.json(cache.servers);
  try {
    const r = await fetch(`${PELICAN_URL}/api/application/servers?per_page=100`, {
      headers: { Authorization: `Bearer ${PELICAN_API_KEY}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) throw new Error(`Pelican antwortete mit ${r.status}`);
    const body = await r.json();
    const servers = (body.data || []).map(s => ({
      uuid: s.attributes.uuid,
      name: s.attributes.name,
      description: s.attributes.description || '',
    }));
    cache = { at: Date.now(), servers };
    res.json(servers);
  } catch (error) {
    // Veraltete Namen sind besser als gar keine — Pelican kurz weg soll die Docker-Ansicht nicht stören.
    if (cache.servers.length) return res.json(cache.servers);
    res.status(502).json({ error: error.message });
  }
});

export default router;
