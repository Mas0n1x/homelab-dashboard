/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';

const router = Router();
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';

// Nur eigene Domains (Peters Domains bewusst ausgeschlossen)
const DOMAINS = ['mas0n1x.online', 'lawnet.sale', 'corleone-lspd.de'];

let zoneCache = null;
let zoneCacheAt = 0;

async function cf(path, opts = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    signal: AbortSignal.timeout(15000),
  });
  return res.json();
}

async function getZoneIds() {
  if (zoneCache && Date.now() - zoneCacheAt < 3600_000) return zoneCache;
  const map = {};
  for (const name of DOMAINS) {
    try {
      const r = await cf(`/zones?name=${encodeURIComponent(name)}`);
      if (r.success && r.result?.[0]) map[name] = r.result[0].id;
    } catch { /* ignore */ }
  }
  zoneCache = map; zoneCacheAt = Date.now();
  return map;
}

async function graphql(query) {
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(15000),
  });
  return res.json();
}

const pad = (n) => String(n).padStart(2, '0');
const dateStr = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

function summarize(name, groups) {
  const sum = (f) => groups.reduce((s, g) => s + (g.sum?.[f] || 0), 0);
  const uniques = groups.reduce((s, g) => s + (g.uniq?.uniques || 0), 0);
  const requests = sum('requests');
  const cachedRequests = sum('cachedRequests');
  const series = groups.map(g => ({
    t: g.dimensions?.datetime || g.dimensions?.date,
    requests: g.sum?.requests || 0,
    bytes: g.sum?.bytes || 0,
  }));
  return {
    name, requests, bytes: sum('bytes'), cachedRequests, threats: sum('threats'),
    pageViews: sum('pageViews'), uniques,
    cacheRate: requests ? Math.round((cachedRequests / requests) * 100) : 0,
    series,
  };
}

router.get('/', async (req, res) => {
  if (!CF_TOKEN) return res.status(503).json({ error: 'Cloudflare-Token nicht konfiguriert' });
  const range = ['24h', '7d', '30d'].includes(req.query.range) ? req.query.range : '7d';
  try {
    const zones = await getZoneIds();
    if (!Object.keys(zones).length) return res.status(502).json({ error: 'Zonen nicht abrufbar (Token/Zonen-Recht?)' });
    const now = new Date();
    const domains = [];
    let permissionError = false;

    for (const [name, id] of Object.entries(zones)) {
      let q;
      if (range === '24h') {
        const since = new Date(now.getTime() - 24 * 3600_000).toISOString();
        q = `query{viewer{zones(filter:{zoneTag:"${id}"}){httpRequests1hGroups(limit:24,filter:{datetime_geq:"${since}"},orderBy:[datetime_ASC]){dimensions{datetime}sum{requests bytes cachedRequests threats pageViews}uniq{uniques}}}}}`;
      } else {
        const days = range === '30d' ? 30 : 7;
        const since = dateStr(new Date(now.getTime() - days * 24 * 3600_000));
        q = `query{viewer{zones(filter:{zoneTag:"${id}"}){httpRequests1dGroups(limit:${days + 1},filter:{date_geq:"${since}"},orderBy:[date_ASC]){dimensions{date}sum{requests bytes cachedRequests threats pageViews}uniq{uniques}}}}}`;
      }
      const r = await graphql(q);
      if (r.errors) {
        if (JSON.stringify(r.errors).includes('analytics.read')) permissionError = true;
        continue;
      }
      const z = r.data?.viewer?.zones?.[0];
      const groups = z?.httpRequests1hGroups || z?.httpRequests1dGroups || [];
      domains.push(summarize(name, groups));
    }

    if (!domains.length && permissionError) {
      return res.status(403).json({ error: 'ANALYTICS_PERMISSION', message: 'Der Cloudflare-Token hat keine Analytics-Leseberechtigung (Zone Analytics:Read fehlt).' });
    }
    res.json({ range, domains });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
