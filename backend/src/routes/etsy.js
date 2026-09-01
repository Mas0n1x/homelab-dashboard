/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';
import * as etsy from '../services/etsy.js';
import { logAudit } from '../services/audit.js';

const router = Router();

router.get('/status', (req, res) => {
  try {
    res.json(etsy.holeStatus());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Liefert die Adresse, die im Browser geöffnet werden muss.
router.post('/connect', (req, res) => {
  try {
    res.json(etsy.starteAnmeldung());
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/disconnect', (req, res) => {
  try {
    etsy.trennen();
    logAudit('etsy.disconnect', 'PrintOasis3D', null, req.user?.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/orders', async (req, res) => {
  try {
    res.json(await etsy.holeBestellungen({ force: req.query.refresh === '1' }));
  } catch (error) {
    // Die Kachel soll bei einem Etsy-Ausfall nicht rot werden, sondern sagen,
    // was los ist.
    res.json({ connected: true, error: error.message, orders: [], openCount: 0 });
  }
});

export default router;

/**
 * Öffentlicher Rückruf-Endpunkt für Etsy.
 *
 * Muss VOR der Anmelde-Middleware hängen: Etsy schickt den Browser hierher, und
 * dieser Aufruf trägt kein Bearer-Token. Abgesichert ist er über den
 * Zustandswert, den wir selbst erzeugt und serverseitig hinterlegt haben — ein
 * fremder Aufruf ohne den passenden Wert wird verworfen.
 */
export function createEtsyCallback() {
  return async (req, res) => {
    const { code, state, error: fehler } = req.query;

    if (fehler) {
      return res.redirect(`/settings?etsy=abgelehnt&grund=${encodeURIComponent(String(fehler))}`);
    }
    if (!code || !state) {
      return res.redirect('/settings?etsy=fehler&grund=Unvollst%C3%A4ndige%20Antwort');
    }

    try {
      const ergebnis = await etsy.schliesseAnmeldungAb(String(code), String(state));
      logAudit('etsy.connect', ergebnis.shopName || String(ergebnis.shopId), null, null);
      res.redirect(`/settings?etsy=ok&shop=${encodeURIComponent(ergebnis.shopName || '')}`);
    } catch (e) {
      res.redirect(`/settings?etsy=fehler&grund=${encodeURIComponent(e.message)}`);
    }
  };
}
