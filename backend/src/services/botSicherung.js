/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Die Bot-Datenbanken liegen in einem eigenen Volume. Die Runtime liefert auf
// Anfrage einen in sich stimmigen Stand, der neben dem Dashboard-Backup landet.
import { createWriteStream, rmSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { stamm } from './backupDateien.js';

const NAMEN = ['bots', 'salenet'];

/** @returns {Promise<string|null>} Hinweistext, falls etwas fehlt */
export async function sichereBotDatenbanken(hauptPfad) {
  const url = (process.env.BOT_RUNTIME_URL || '').replace(/\/+$/, '');
  const token = process.env.BOT_RUNTIME_TOKEN || '';
  if (!url || !token) return null; // keine Bot-Runtime eingerichtet

  const fehlt = [];
  for (const name of NAMEN) {
    const ziel = `${stamm(hauptPfad)}.bot-${name}.db`;
    try {
      const res = await fetch(`${url}/sicherung/${name}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(120000),
      });
      if (res.status === 404 && (await res.text()).includes('keine-datenbank')) continue;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await pipeline(Readable.fromWeb(res.body), createWriteStream(ziel));
    } catch (error) {
      rmSync(ziel, { force: true });
      fehlt.push(`${name} (${error.message})`);
    }
  }
  return fehlt.length ? `Bot-Datenbanken nicht gesichert: ${fehlt.join(', ')}` : null;
}
