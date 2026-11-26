/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Zugang für die Bot-Runtime: nur lesen, nur die Serverübersicht.
import { bearerPasst } from '../services/geheim.js';
import { statusUebersicht } from '../services/statusSummary.js';

export async function botServerStatus(req, res) {
  // Der Bot spricht das Backend direkt im Compose-Netz an. Was über nginx kommt
  // (X-Real-IP gesetzt), kommt von außen und hat hier nichts zu suchen.
  if (req.headers['x-real-ip']) return res.status(404).json({ error: 'Nicht gefunden' });
  if (!bearerPasst(req, process.env.BOT_RUNTIME_TOKEN)) return res.status(401).json({ error: 'Nicht autorisiert' });
  try {
    // SSH-Diagnose gehört nicht in die öffentliche Discord-Nachricht.
    const { servers, timestamp } = await statusUebersicht();
    res.json({ servers: servers.map(({ ssh, ...rest }) => rest), timestamp });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
