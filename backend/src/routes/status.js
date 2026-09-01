/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';
import { buildStatusBoard } from '../services/statusBoard.js';

const router = Router();

// Kurzer Cache: mehrere Geräte (Handy + Rechner) fragen dieselbe Sekunde ab,
// und das Board wird ohnehin nur alle 60 s durch neue Messwerte bewegt.
let cache = { key: null, data: null, at: 0 };
const CACHE_MS = 10000;

// GET /api/status/board?days=30 — komplettes Status-Board, ein Aufruf.
router.get('/board', (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 30));
    const key = `d${days}`;

    if (cache.key === key && Date.now() - cache.at < CACHE_MS) {
      return res.json(cache.data);
    }

    const data = buildStatusBoard(days);
    cache = { key, data, at: Date.now() };
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Status-Board konnte nicht geladen werden', message: error.message });
  }
});

/**
 * GET /api/status/changes — was hat sich auf der Flotte zuletzt verändert?
 *
 * Speist das „Änderungen"-Feld auf der Startseite: neu aufgetauchte Dienste und
 * solche, die nicht mehr gefunden werden. Eine unbeabsichtigt abgeräumte
 * Anwendung fällt damit beim Öffnen des Dashboards auf, statt erst durch einen
 * Anruf.
 */
router.get('/changes', (req, res) => {
  try {
    const days = Math.min(30, Math.max(1, parseInt(req.query.days, 10) || 7));
    const db = getDb();
    const seit = new Date(Date.now() - days * 86400000).toISOString();
    // Alles, was länger als 10 Minuten nicht gesehen wurde, gilt als weg —
    // der Discovery-Lauf kommt alle 30 Sekunden vorbei.
    const wegAb = new Date(Date.now() - 10 * 60000).toISOString();

    const servers = new Map(
      db.prepare('SELECT id, name FROM servers').all().map(s => [s.id, s.name]),
    );

    const neu = db.prepare(`
      SELECT service_id, server_id, name, first_seen FROM service_registry
      WHERE first_seen > ? AND last_seen > ?
      ORDER BY first_seen DESC LIMIT 20
    `).all(seit, wegAb).map(r => ({
      type: 'neu',
      id: r.service_id,
      name: r.name || r.service_id,
      server: servers.get(r.server_id) || r.server_id,
      at: r.first_seen,
    }));

    const weg = db.prepare(`
      SELECT service_id, server_id, name, last_seen FROM service_registry
      WHERE last_seen <= ?
      ORDER BY last_seen DESC LIMIT 20
    `).all(wegAb).map(r => ({
      type: 'entfernt',
      id: r.service_id,
      name: r.name || r.service_id,
      server: servers.get(r.server_id) || r.server_id,
      at: r.last_seen,
    }));

    const changes = [...neu, ...weg]
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, 15);

    res.json({ changes, days });
  } catch (error) {
    res.status(500).json({ error: 'Änderungen konnten nicht geladen werden', message: error.message });
  }
});

export default router;
