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

export default router;
