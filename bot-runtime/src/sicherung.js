/*
 * Homelab Dashboard — Bot-Runtime
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Liefert dem Dashboard einen in sich stimmigen Stand der Bot-Datenbanken.
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const DATENBANKEN = {
  bots: () => process.env.BOT_DB_PATH || '/app/data/bots.db',
  salenet: () => process.env.SALENET_DB_PATH || '/app/data/salenet.db',
};

async function sicherungHandler(req, res) {
  const quelle = Object.hasOwn(DATENBANKEN, req.params.name) ? DATENBANKEN[req.params.name]() : null;
  if (!quelle || !fs.existsSync(quelle)) return res.status(404).json({ error: 'keine-datenbank' });
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'sicherung-'));
  const weg = () => fs.rmSync(ordner, { recursive: true, force: true });
  let db;
  try {
    db = new Database(quelle);
    const ziel = path.join(ordner, `${req.params.name}.db`);
    await db.backup(ziel);
    res.sendFile(ziel, weg);
  } catch (e) {
    weg();
    res.status(500).json({ error: e.message });
  } finally {
    db?.close();
  }
}

module.exports = { sicherungHandler };
