/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';

const router = Router();
const AGENT_URL = process.env.MC_AGENT_URL || '';
const AGENT_TOKEN = process.env.MC_AGENT_TOKEN || '';

async function agentFetch(path, opts = {}) {
  if (!AGENT_URL || !AGENT_TOKEN) {
    return { status: 503, data: { error: 'MC-Agent nicht konfiguriert' } };
  }
  try {
    const res = await fetch(`${AGENT_URL}${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${AGENT_TOKEN}`,
        'Content-Type': 'application/json',
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

router.get('/status', async (req, res) => {
  const r = await agentFetch('/status');
  res.status(r.status).json(r.data);
});

router.post('/power', async (req, res) => {
  const r = await agentFetch('/power', { method: 'POST', body: JSON.stringify(req.body) });
  res.status(r.status).json(r.data);
});

router.post('/command', async (req, res) => {
  const r = await agentFetch('/command', { method: 'POST', body: JSON.stringify(req.body) });
  res.status(r.status).json(r.data);
});

router.get('/logs', async (req, res) => {
  const r = await agentFetch(`/logs?tail=${encodeURIComponent(req.query.tail || '250')}`);
  res.status(r.status).json(r.data);
});

router.get('/configs', async (req, res) => {
  const r = await agentFetch('/configs');
  res.status(r.status).json(r.data);
});

router.get('/config/:file', async (req, res) => {
  const r = await agentFetch(`/config/${encodeURIComponent(req.params.file)}`);
  res.status(r.status).json(r.data);
});

router.put('/config/:file', async (req, res) => {
  const r = await agentFetch(`/config/${encodeURIComponent(req.params.file)}`, {
    method: 'PUT',
    body: JSON.stringify(req.body),
  });
  res.status(r.status).json(r.data);
});

// Backups
router.get('/backups', async (req, res) => {
  const r = await agentFetch('/backups');
  res.status(r.status).json(r.data);
});
router.post('/backups', async (req, res) => {
  const r = await agentFetch('/backups', { method: 'POST' });
  res.status(r.status).json(r.data);
});
router.post('/backups/:name/restore', async (req, res) => {
  const r = await agentFetch(`/backups/${encodeURIComponent(req.params.name)}/restore`, { method: 'POST' });
  res.status(r.status).json(r.data);
});
router.delete('/backups/:name', async (req, res) => {
  const r = await agentFetch(`/backups/${encodeURIComponent(req.params.name)}`, { method: 'DELETE' });
  res.status(r.status).json(r.data);
});

// Plugins
router.get('/plugins', async (req, res) => {
  const r = await agentFetch('/plugins');
  res.status(r.status).json(r.data);
});
router.post('/plugins/toggle', async (req, res) => {
  const r = await agentFetch('/plugins/toggle', { method: 'POST', body: JSON.stringify(req.body) });
  res.status(r.status).json(r.data);
});
router.post('/plugins/install', async (req, res) => {
  const r = await agentFetch('/plugins/install', { method: 'POST', body: JSON.stringify(req.body) });
  res.status(r.status).json(r.data);
});
router.get('/plugins/browse', async (req, res) => {
  const r = await agentFetch(`/plugins/browse?q=${encodeURIComponent(req.query.q || '')}&offset=${encodeURIComponent(req.query.offset || '0')}`);
  res.status(r.status).json(r.data);
});
router.get('/plugins/updates', async (req, res) => {
  const r = await agentFetch('/plugins/updates');
  res.status(r.status).json(r.data);
});
router.delete('/plugins/:name', async (req, res) => {
  const r = await agentFetch(`/plugins/${encodeURIComponent(req.params.name)}`, { method: 'DELETE' });
  res.status(r.status).json(r.data);
});

// Datei-Manager
router.get('/files', async (req, res) => {
  const r = await agentFetch(`/files?path=${encodeURIComponent(req.query.path || '')}`);
  res.status(r.status).json(r.data);
});
router.get('/file', async (req, res) => {
  const r = await agentFetch(`/file?path=${encodeURIComponent(req.query.path || '')}`);
  res.status(r.status).json(r.data);
});
router.put('/file', async (req, res) => {
  const r = await agentFetch(`/file?path=${encodeURIComponent(req.query.path || '')}`, { method: 'PUT', body: JSON.stringify(req.body) });
  res.status(r.status).json(r.data);
});
router.post('/upload', async (req, res) => {
  const r = await agentFetch('/upload', { method: 'POST', body: JSON.stringify(req.body) });
  res.status(r.status).json(r.data);
});

// Spieler & Gamerules
router.get('/players', async (req, res) => {
  const r = await agentFetch('/players');
  res.status(r.status).json(r.data);
});
router.get('/players/known', async (req, res) => {
  const r = await agentFetch('/players/known');
  res.status(r.status).json(r.data);
});
router.get('/performance', async (req, res) => {
  const r = await agentFetch('/performance');
  res.status(r.status).json(r.data);
});
router.get('/gamerules', async (req, res) => {
  const r = await agentFetch('/gamerules');
  res.status(r.status).json(r.data);
});

// World
router.get('/world', async (req, res) => {
  const r = await agentFetch('/world');
  res.status(r.status).json(r.data);
});
router.post('/world/reset', async (req, res) => {
  const r = await agentFetch('/world/reset', { method: 'POST' });
  res.status(r.status).json(r.data);
});

// Automatisierung (Auto-Backups + geplante Befehle)
router.get('/automation', async (req, res) => {
  const r = await agentFetch('/automation');
  res.status(r.status).json(r.data);
});
router.put('/automation/backup', async (req, res) => {
  const r = await agentFetch('/automation/backup', { method: 'PUT', body: JSON.stringify(req.body) });
  res.status(r.status).json(r.data);
});
router.post('/automation/commands', async (req, res) => {
  const r = await agentFetch('/automation/commands', { method: 'POST', body: JSON.stringify(req.body) });
  res.status(r.status).json(r.data);
});
router.put('/automation/commands/:id', async (req, res) => {
  const r = await agentFetch(`/automation/commands/${encodeURIComponent(req.params.id)}`, { method: 'PUT', body: JSON.stringify(req.body) });
  res.status(r.status).json(r.data);
});
router.delete('/automation/commands/:id', async (req, res) => {
  const r = await agentFetch(`/automation/commands/${encodeURIComponent(req.params.id)}`, { method: 'DELETE' });
  res.status(r.status).json(r.data);
});

export default router;
