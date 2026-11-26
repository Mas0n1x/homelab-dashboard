/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Protokolliert jede verändernde Anfrage an den Betriebs-Bereichen, auch wenn
// die Route selbst nichts schreibt. So fällt eine neue Route nicht durchs Raster.
import { anfrageKontext, logAudit } from '../services/audit.js';

const BEREICHE = new Set(['docker', 'servers', 'services', 'maintenance', 'templates', 'gameservers', 'minecraft',
  'pelican', 'proxmox', 'files', 'shares', 'backup', 'tunnels', 'bots', 'alerts']);

const NAMEN = [
  ['POST', /^docker\/(images|volumes|system)\/prune$/, (m) => `docker.prune.${m[1]}`],
  ['DELETE', /^docker\/volumes\//, () => 'volume.delete'],
  ['DELETE', /^docker\/images\//, () => 'image.delete'],
  ['POST', /^docker\/updates\/pull\//, () => 'image.pull'],
  ['POST', /^docker\/compose\/[^/]+\/(\w+)$/, (m) => `compose.${m[1]}`],
  ['POST', /^servers$/, () => 'server.add'],
  ['PUT', /^servers\//, () => 'server.update'],
  ['DELETE', /^servers\//, () => 'server.delete'],
];

export function protokolliereAenderungen(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const pfad = req.path.replace(/^\/+|\/+$/g, '');
  const bereich = pfad.split('/')[0];
  if (!BEREICHE.has(bereich)) return next();

  const kontext = { protokolliert: false };
  res.on('finish', () => {
    if (kontext.protokolliert || res.statusCode >= 400) return;
    const treffer = NAMEN.find(([m, re]) => m === req.method && re.test(pfad));
    const aktion = treffer ? treffer[2](pfad.match(treffer[1])) : `api.${req.method.toLowerCase()}`;
    // Nur Pfad und Server-ID — Rümpfe enthalten Zugangsdaten und Dateiinhalte.
    const serverId = req.query?.serverId || req.body?.serverId;
    try { logAudit(aktion, pfad, serverId ? { serverId } : null, req.user?.id); } catch (e) { console.error('Audit:', e.message); }
  });
  anfrageKontext.run(kontext, next);
}
