/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';
import { getServer, publicServers, accessHeaders } from '../services/mcServers.js';
import * as gameservers from '../services/gameservers.js';
import gameserverRoutes from './gameservers.js';

const router = Router();

async function agentFetch(server, path, opts = {}) {
  if (!server || !server.url || !server.token) {
    return { status: 503, data: { error: 'MC-Agent nicht konfiguriert' } };
  }
  try {
    const res = await fetch(`${server.url}${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${server.token}`,
        'Content-Type': 'application/json',
        // Liegt der Agent hinter Cloudflare Access, kommt sonst Access' Login-Seite
        // statt der Agent-Antwort zurück.
        ...accessHeaders(server),
        ...(opts.headers || {}),
      },
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch (e) {
    return { status: 502, data: { error: 'Agent nicht erreichbar: ' + e.message } };
  }
}

// Server, den die aktuelle Anfrage meint (?server=<id>, Default: erster Server).
function reqServer(req) {
  return getServer(req.query.server);
}

// Liste aller Minecraft-Server (ohne Token) für den Switcher im Frontend: die per
// mc-agent angebundenen plus jeder Minecraft-Server, der in Pelican angelegt wird.
router.get('/servers', async (req, res) => {
  const servers = publicServers();
  if (gameservers.konfiguriert()) {
    try {
      const pelican = (await gameservers.listServers()).filter(s => s.game === 'minecraft');
      const versionen = await Promise.all(pelican.map(s => gameservers.minecraftPing(s).then(p => p?.version || '').catch(() => '')));
      pelican.forEach((s, i) => servers.push({
        id: `pelican:${s.id}`, name: s.name, host: s.host, version: versionen[i], map: '', provider: 'pelican',
      }));
    } catch { /* Pelican kurz weg: die Agent-Server bleiben bedienbar */ }
  }
  res.json({ servers });
});

// Pelican-Server sprechen dieselbe Sprache wie der Agent — die Anfrage geht an die
// Spielserver-Routen weiter, nur Plugins/Welt/Automatik gibt es dort nicht.
router.use((req, res, next) => {
  const sid = String(req.query.server || '');
  if (!sid.startsWith('pelican:')) return next();
  req.url = `/${encodeURIComponent(sid.slice(8))}${req.url}`;
  gameserverRoutes(req, res, next);
});

router.get('/status', async (req, res) => {
  const r = await agentFetch(reqServer(req), '/status');
  res.status(r.status).json(r.data);
});

router.post('/power', async (req, res) => {
  const r = await agentFetch(reqServer(req), '/power', { method: 'POST', body: JSON.stringify(req.body) });
  res.status(r.status).json(r.data);
});

router.post('/command', async (req, res) => {
  const r = await agentFetch(reqServer(req), '/command', { method: 'POST', body: JSON.stringify(req.body) });
  res.status(r.status).json(r.data);
});

router.get('/logs', async (req, res) => {
  const r = await agentFetch(reqServer(req), `/logs?tail=${encodeURIComponent(req.query.tail || '250')}`);
  res.status(r.status).json(r.data);
});

router.get('/configs', async (req, res) => {
  const r = await agentFetch(reqServer(req), '/configs');
  res.status(r.status).json(r.data);
});

router.get('/config/:file', async (req, res) => {
  const r = await agentFetch(reqServer(req), `/config/${encodeURIComponent(req.params.file)}`);
  res.status(r.status).json(r.data);
});

router.put('/config/:file', async (req, res) => {
  const r = await agentFetch(reqServer(req), `/config/${encodeURIComponent(req.params.file)}`, {
    method: 'PUT',
    body: JSON.stringify(req.body),
  });
  res.status(r.status).json(r.data);
});

// Backups
router.get('/backups', async (req, res) => {
  const r = await agentFetch(reqServer(req), '/backups');
  res.status(r.status).json(r.data);
});
router.post('/backups', async (req, res) => {
  const r = await agentFetch(reqServer(req), '/backups', { method: 'POST' });
  res.status(r.status).json(r.data);
});
router.post('/backups/:name/restore', async (req, res) => {
  const r = await agentFetch(reqServer(req), `/backups/${encodeURIComponent(req.params.name)}/restore`, { method: 'POST' });
  res.status(r.status).json(r.data);
});
router.delete('/backups/:name', async (req, res) => {
  const r = await agentFetch(reqServer(req), `/backups/${encodeURIComponent(req.params.name)}`, { method: 'DELETE' });
  res.status(r.status).json(r.data);
});

// Plugins
router.get('/plugins', async (req, res) => {
  const r = await agentFetch(reqServer(req), '/plugins');
  res.status(r.status).json(r.data);
});
router.post('/plugins/toggle', async (req, res) => {
  const r = await agentFetch(reqServer(req), '/plugins/toggle', { method: 'POST', body: JSON.stringify(req.body) });
  res.status(r.status).json(r.data);
});
router.post('/plugins/install', async (req, res) => {
  const r = await agentFetch(reqServer(req), '/plugins/install', { method: 'POST', body: JSON.stringify(req.body) });
  res.status(r.status).json(r.data);
});
router.get('/plugins/browse', async (req, res) => {
  const r = await agentFetch(reqServer(req), `/plugins/browse?q=${encodeURIComponent(req.query.q || '')}&offset=${encodeURIComponent(req.query.offset || '0')}`);
  res.status(r.status).json(r.data);
});
router.get('/plugins/updates', async (req, res) => {
  const r = await agentFetch(reqServer(req), '/plugins/updates');
  res.status(r.status).json(r.data);
});
router.delete('/plugins/:name', async (req, res) => {
  const r = await agentFetch(reqServer(req), `/plugins/${encodeURIComponent(req.params.name)}`, { method: 'DELETE' });
  res.status(r.status).json(r.data);
});

// Datei-Manager
router.get('/files', async (req, res) => {
  const r = await agentFetch(reqServer(req), `/files?path=${encodeURIComponent(req.query.path || '')}`);
  res.status(r.status).json(r.data);
});
router.get('/file', async (req, res) => {
  const r = await agentFetch(reqServer(req), `/file?path=${encodeURIComponent(req.query.path || '')}`);
  res.status(r.status).json(r.data);
});
router.put('/file', async (req, res) => {
  const r = await agentFetch(reqServer(req), `/file?path=${encodeURIComponent(req.query.path || '')}`, { method: 'PUT', body: JSON.stringify(req.body) });
  res.status(r.status).json(r.data);
});
router.post('/upload', async (req, res) => {
  const r = await agentFetch(reqServer(req), '/upload', { method: 'POST', body: JSON.stringify(req.body) });
  res.status(r.status).json(r.data);
});

// Spieler & Gamerules
router.get('/players', async (req, res) => {
  const r = await agentFetch(reqServer(req), '/players');
  res.status(r.status).json(r.data);
});
router.get('/players/known', async (req, res) => {
  const r = await agentFetch(reqServer(req), '/players/known');
  res.status(r.status).json(r.data);
});
router.get('/performance', async (req, res) => {
  const r = await agentFetch(reqServer(req), '/performance');
  res.status(r.status).json(r.data);
});
router.get('/gamerules', async (req, res) => {
  const r = await agentFetch(reqServer(req), '/gamerules');
  res.status(r.status).json(r.data);
});

// World
router.get('/world', async (req, res) => {
  const r = await agentFetch(reqServer(req), '/world');
  res.status(r.status).json(r.data);
});
router.post('/world/reset', async (req, res) => {
  const r = await agentFetch(reqServer(req), '/world/reset', { method: 'POST' });
  res.status(r.status).json(r.data);
});

// Automatisierung (Auto-Backups + geplante Befehle)
router.get('/automation', async (req, res) => {
  const r = await agentFetch(reqServer(req), '/automation');
  res.status(r.status).json(r.data);
});
router.put('/automation/backup', async (req, res) => {
  const r = await agentFetch(reqServer(req), '/automation/backup', { method: 'PUT', body: JSON.stringify(req.body) });
  res.status(r.status).json(r.data);
});
router.post('/automation/commands', async (req, res) => {
  const r = await agentFetch(reqServer(req), '/automation/commands', { method: 'POST', body: JSON.stringify(req.body) });
  res.status(r.status).json(r.data);
});
router.put('/automation/commands/:id', async (req, res) => {
  const r = await agentFetch(reqServer(req), `/automation/commands/${encodeURIComponent(req.params.id)}`, { method: 'PUT', body: JSON.stringify(req.body) });
  res.status(r.status).json(r.data);
});
router.delete('/automation/commands/:id', async (req, res) => {
  const r = await agentFetch(reqServer(req), `/automation/commands/${encodeURIComponent(req.params.id)}`, { method: 'DELETE' });
  res.status(r.status).json(r.data);
});

export default router;
