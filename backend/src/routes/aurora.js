/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';

const router = Router();

const AURORA_URL = process.env.AURORA_METRICS_URL || 'http://aurora:8080';
const TOKEN = process.env.AURORA_METRICS_TOKEN || '';

// Zugang für die Durchreiche-Anmeldung. Aurora bleibt dabei unverändert — das
// Dashboard meldet sich in deinem Namen an und reicht nur das Sitzungs-Cookie
// weiter. Same-Origin (beides läuft hinter demselben nginx), deshalb greift das
// Cookie im eingebetteten Fenster.
const SSO_EMAIL = process.env.AURORA_SSO_EMAIL || '';
const SSO_PASSWORD = process.env.AURORA_SSO_PASSWORD || '';

const AURORA_COOKIE = 'aurora_session';
// Der nginx-Mountpunkt. Das Cookie MUSS auf diesen Pfad zeigen, sonst schickt es
// der Browser nicht an das eingebettete Aurora mit.
const AURORA_PREFIX = '/aurora-app';

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

/**
 * Anmelde-Status im eingebetteten Aurora prüfen.
 *
 * Das Cookie ist HttpOnly, das Frontend kann es also nicht selbst lesen — der
 * Browser schickt es aber an diesen Endpunkt mit, und der fragt Aurora.
 */
router.get('/session', async (req, res) => {
  const token = req.cookies?.[AURORA_COOKIE] || parseCookie(req.headers.cookie)[AURORA_COOKIE];
  if (!token) {
    return res.json({ authenticated: false, ssoConfigured: !!(SSO_EMAIL && SSO_PASSWORD) });
  }
  try {
    const r = await fetch(`${AURORA_URL}/api/auth/me`, {
      headers: { Cookie: `${AURORA_COOKIE}=${token}` },
      signal: AbortSignal.timeout(5000),
    });
    res.json({
      authenticated: r.ok,
      ssoConfigured: !!(SSO_EMAIL && SSO_PASSWORD),
      user: r.ok ? await r.json() : null,
    });
  } catch {
    res.json({ authenticated: false, ssoConfigured: !!(SSO_EMAIL && SSO_PASSWORD) });
  }
});

/**
 * Durchreiche-Anmeldung: meldet sich mit den hinterlegten Zugangsdaten bei
 * Aurora an und setzt dessen Sitzungs-Cookie im Browser — auf den Pfad des
 * eingebetteten Fensters. Damit entfällt die zweite Anmeldung im Dashboard.
 *
 * Nur erreichbar für angemeldete Dashboard-Nutzer (die Route hängt hinter der
 * globalen Auth-Middleware), es entsteht also kein neuer Weg an der Anmeldung
 * vorbei.
 */
router.post('/sso', async (req, res) => {
  if (!SSO_EMAIL || !SSO_PASSWORD) {
    return res.status(503).json({
      error: 'Aurora-Anmeldung nicht hinterlegt',
      hint: 'AURORA_SSO_EMAIL und AURORA_SSO_PASSWORD in der .env setzen.',
    });
  }

  try {
    const r = await fetch(`${AURORA_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: SSO_EMAIL, password: SSO_PASSWORD }),
      signal: AbortSignal.timeout(8000),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      return res.status(502).json({ error: `Aurora lehnte die Anmeldung ab (${r.status})`, detail: text.slice(0, 200) });
    }

    // Aurora setzt das Cookie auf Pfad "/". Für das eingebettete Fenster muss es
    // auf /aurora-app zeigen, sonst wird es dorthin nie mitgeschickt.
    const setCookie = r.headers.getSetCookie?.() || [r.headers.get('set-cookie')].filter(Boolean);
    const token = extractCookieValue(setCookie, AURORA_COOKIE);
    if (!token) {
      return res.status(502).json({ error: 'Aurora lieferte kein Sitzungs-Cookie' });
    }

    const secure = (req.headers['x-forwarded-proto'] || '').includes('https');
    res.setHeader('Set-Cookie', [
      `${AURORA_COOKIE}=${token}`,
      `Path=${AURORA_PREFIX}`,
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${30 * 24 * 60 * 60}`,
      ...(secure ? ['Secure'] : []),
    ].join('; '));

    res.json({ ok: true, user: await r.json().catch(() => null) });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

// ─── Cookie-Hilfen (das Backend nutzt keinen Cookie-Parser) ───

function parseCookie(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function extractCookieValue(setCookieHeaders, name) {
  for (const raw of setCookieHeaders || []) {
    if (!raw) continue;
    const first = String(raw).split(';')[0];
    const idx = first.indexOf('=');
    if (idx < 0) continue;
    if (first.slice(0, idx).trim() === name) return first.slice(idx + 1).trim();
  }
  return null;
}

export default router;
