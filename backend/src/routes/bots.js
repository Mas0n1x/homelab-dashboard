/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 *
 * Steuerzentrale für die Discord-Bots. Das Dashboard hält selbst keine
 * Bot-Runtime, sondern proxyt zur separaten Bot-Runtime (Portfolio, SaleNet)
 * sowie zu PersoNets externer Bot-API. Vorbild: minecraft.js -> mc-control-agent.
 */
import { Router } from 'express';

const RUNTIME_URL = (process.env.BOT_RUNTIME_URL || 'http://bot-runtime:3200').replace(/\/+$/, '');
const RUNTIME_TOKEN = process.env.BOT_RUNTIME_TOKEN || '';

// PersoNet-Anbindung (externe, API-Key-gesicherte Bot-API — siehe Phase 3)
const PERSONET_URL = (process.env.PERSONET_BOT_URL || '').replace(/\/+$/, '');
const PERSONET_KEY = process.env.PERSONET_BOT_API_KEY || '';

const router = Router();

// ── Helfer: Aufruf an die Bot-Runtime ──────────────────────────────────
async function runtimeFetch(path, opts = {}) {
  if (!RUNTIME_TOKEN) {
    return { status: 503, data: { error: 'Bot-Runtime nicht konfiguriert (BOT_RUNTIME_TOKEN fehlt)' } };
  }
  try {
    const res = await fetch(`${RUNTIME_URL}${path}`, {
      ...opts,
      headers: {
        Authorization: `Bearer ${RUNTIME_TOKEN}`,
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch (e) {
    return { status: 502, data: { error: 'Bot-Runtime nicht erreichbar: ' + e.message } };
  }
}

// ── Helfer: Aufruf an PersoNets externe Bot-API ─────────────────────────
async function personetFetch(path, opts = {}) {
  if (!PERSONET_URL || !PERSONET_KEY) {
    return { status: 503, data: { error: 'PersoNet-Bot-API nicht konfiguriert' } };
  }
  try {
    const res = await fetch(`${PERSONET_URL}${path}`, {
      ...opts,
      headers: {
        'x-api-key': PERSONET_KEY,
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch (e) {
    return { status: 502, data: { error: 'PersoNet nicht erreichbar: ' + e.message } };
  }
}

// ── Übersicht aller Bots ────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const runtime = await runtimeFetch('/bots');
  const bots = Array.isArray(runtime.data?.bots) ? [...runtime.data.bots] : [];

  // PersoNet als eigenständigen (extern gehosteten) Bot ergänzen
  if (PERSONET_URL && PERSONET_KEY) {
    const p = await personetFetch('/status');
    bots.push({
      id: 'personet',
      name: 'PersoNet-Bot',
      description: 'LSPD-Personalsystem — Rollen-/Nick-Sync, Ankündigungen. Läuft in PersoNet, wird hier nur gesteuert.',
      external: true,
      status: p.status === 200 ? p.data : { connected: false, error: p.data?.error },
    });
  }

  res.json({ bots });
});

// ── PersoNet-Steuerung (read + einfache Aktionen, nichts entfernt drüben) ──
router.get('/personet/status', async (req, res) => {
  const r = await personetFetch('/status');
  res.status(r.status).json(r.data);
});
router.get('/personet/guild', async (req, res) => {
  const r = await personetFetch('/guild');
  res.status(r.status).json(r.data);
});
router.post('/personet/sync-members', async (req, res) => {
  const r = await personetFetch('/sync-members', { method: 'POST' });
  res.status(r.status).json(r.data);
});
router.post('/personet/sync-roles', async (req, res) => {
  const r = await personetFetch('/sync-roles', { method: 'POST' });
  res.status(r.status).json(r.data);
});

// ── Generischer Proxy zur Bot-Runtime für Portfolio (und später SaleNet) ──
// Alles unter /api/bots/portfolio/* und /api/bots/salenet/* wird 1:1 durchgereicht.
// Ausnahme: der öffentliche Webhook wird in index.js VOR der Auth gemountet.
router.all(/^\/(portfolio|salenet)\/.*/, async (req, res) => {
  const subPath = req.originalUrl.replace(/^\/api\/bots/, '').split('?')[0];
  const qs = req.originalUrl.includes('?') ? '?' + req.originalUrl.split('?')[1] : '';
  const method = req.method.toUpperCase();
  const opts = { method };
  if (!['GET', 'HEAD'].includes(method)) opts.body = JSON.stringify(req.body || {});
  const r = await runtimeFetch(subPath + qs, opts);
  res.status(r.status).json(r.data);
});

export default router;

// Öffentlicher, token-gesicherter Events-Eingang (kein JWT): Portfolio & SaleNet
// melden hierüber Business-Events (neue Bestellung/Anfrage/Incident …). Auth über
// das geteilte BOT_RUNTIME_TOKEN als Bearer — der Bot postet die Events nach Discord.
export function createBotEventsIngest() {
  return async (req, res) => {
    if (!RUNTIME_TOKEN) return res.status(503).json({ error: 'Bot-Runtime nicht konfiguriert' });
    const auth = req.headers.authorization || '';
    const provided = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!provided || provided !== RUNTIME_TOKEN) return res.status(401).json({ error: 'Nicht autorisiert' });

    const bot = req.params.bot;
    if (!['portfolio', 'salenet'].includes(bot)) return res.status(404).json({ error: 'Unbekannter Bot' });

    const r = await runtimeFetch(`/${bot}/events`, { method: 'POST', body: JSON.stringify(req.body || {}) });
    res.status(r.status).json(r.data);
  };
}

// Öffentlicher Webhook-Passthrough (kein JWT): leitet den rohen Body an die
// Bot-Runtime weiter, damit die HMAC-Signatur dort geprüft werden kann.
export function createBotWebhookPassthrough() {
  return async (req, res) => {
    if (!RUNTIME_TOKEN) return res.status(503).json({ error: 'Bot-Runtime nicht konfiguriert' });
    // Ziel-Bot aus dem Pfad ableiten (/api/bots/:bot/webhook/github)
    const subPath = req.originalUrl.replace(/^\/api\/bots/, '').split('?')[0];
    try {
      const upstream = await fetch(`${RUNTIME_URL}${subPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': req.headers['content-type'] || 'application/json',
          'x-github-event': req.headers['x-github-event'] || '',
          'x-hub-signature-256': req.headers['x-hub-signature-256'] || '',
          // Kein Bearer: der Webhook-Endpunkt der Runtime ist bewusst öffentlich (HMAC).
        },
        body: req.rawBody || JSON.stringify(req.body || {}),
        signal: AbortSignal.timeout(20000),
      });
      const data = await upstream.json().catch(() => ({}));
      res.status(upstream.status).json(data);
    } catch (e) {
      res.status(502).json({ error: 'Bot-Runtime nicht erreichbar: ' + e.message });
    }
  };
}
