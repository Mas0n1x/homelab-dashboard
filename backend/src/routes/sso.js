/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';
import crypto from 'crypto';
import { logAudit } from '../services/audit.js';

/**
 * Ein-Klick-Admin-Zugänge. Das Dashboard stellt ein kurzlebiges, signiertes
 * Einmal-Ticket aus; die Ziel-App prüft es unter /api/sso und setzt dort die
 * Admin-Session. Pro Ziel ein eigenes Geheimnis — ein geleaktes Portfolio-
 * Geheimnis öffnet also nicht SaleNet.
 *
 * Ticket = base64url(JSON {aud, exp, jti}) + "." + base64url(HMAC-SHA256).
 */
const TICKET_TTL_SEKUNDEN = 60;

const ZIELE = {
  portfolio: {
    name: 'Portfolio',
    beschreibung: 'Admin-Bereich von mas0n1x.online',
    url: process.env.PORTFOLIO_SSO_URL || 'https://mas0n1x.online',
    secret: process.env.PORTFOLIO_SSO_SECRET || '',
  },
  salenet: {
    name: 'SaleNet',
    beschreibung: 'Shop-Verwaltung von lawnet.sale',
    url: process.env.SALENET_SSO_URL || 'https://lawnet.sale',
    secret: process.env.SALENET_SSO_SECRET || '',
  },
};

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function ticketErstellen(id, secret) {
  const payload = b64url(JSON.stringify({
    aud: id,
    exp: Math.floor(Date.now() / 1000) + TICKET_TTL_SEKUNDEN,
    jti: crypto.randomBytes(16).toString('hex'),
  }));
  const sig = b64url(crypto.createHmac('sha256', secret).update(payload).digest());
  return `${payload}.${sig}`;
}

const router = Router();

router.get('/targets', (req, res) => {
  res.json(Object.entries(ZIELE).map(([id, z]) => ({
    id,
    name: z.name,
    beschreibung: z.beschreibung,
    url: z.url,
    konfiguriert: z.secret.length >= 32,
  })));
});

router.post('/:target', (req, res) => {
  const ziel = ZIELE[req.params.target];
  if (!ziel) return res.status(404).json({ error: 'Unbekanntes Ziel' });
  if (ziel.secret.length < 32) {
    return res.status(503).json({ error: `${ziel.name}: SSO-Geheimnis fehlt in der .env` });
  }
  const ticket = ticketErstellen(req.params.target, ziel.secret);
  logAudit('sso.login', req.params.target, null, req.user?.id ?? null);
  res.json({ url: `${ziel.url}/api/sso?t=${encodeURIComponent(ticket)}` });
});

export default router;
