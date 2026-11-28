/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../services/database.js';

const router = Router();

// Nur http(s) — sonst ließe sich ein javascript:-Link als Kachel speichern.
function pruefen({ name, url, kategorie, beschreibung, benutzer }) {
  const text = (wert, max) => String(wert ?? '').trim().slice(0, max);
  const eintrag = {
    name: text(name, 60),
    url: text(url, 500),
    kategorie: text(kategorie, 40) || 'Sonstiges',
    beschreibung: text(beschreibung, 160),
    benutzer: text(benutzer, 120),
  };
  if (!eintrag.name) return { fehler: 'Name fehlt' };
  try {
    if (!['http:', 'https:'].includes(new URL(eintrag.url).protocol)) throw new Error();
  } catch {
    return { fehler: 'Adresse muss mit http:// oder https:// beginnen' };
  }
  return { eintrag };
}

router.get('/', (req, res) => {
  res.json(getDb().prepare(
    'SELECT id, name, url, kategorie, beschreibung, benutzer FROM zugaenge ORDER BY sort_order, name COLLATE NOCASE'
  ).all());
});

router.post('/', (req, res) => {
  const { eintrag, fehler } = pruefen(req.body);
  if (fehler) return res.status(400).json({ error: fehler });
  const id = crypto.randomUUID();
  getDb().prepare(`INSERT INTO zugaenge (id, name, url, kategorie, beschreibung, benutzer)
    VALUES (@id, @name, @url, @kategorie, @beschreibung, @benutzer)`).run({ id, ...eintrag });
  res.json({ id });
});

router.put('/:id', (req, res) => {
  const { eintrag, fehler } = pruefen(req.body);
  if (fehler) return res.status(400).json({ error: fehler });
  const { changes } = getDb().prepare(`UPDATE zugaenge SET name = @name, url = @url, kategorie = @kategorie,
    beschreibung = @beschreibung, benutzer = @benutzer WHERE id = @id`).run({ id: req.params.id, ...eintrag });
  if (!changes) return res.status(404).json({ error: 'Eintrag nicht gefunden' });
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM zugaenge WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
