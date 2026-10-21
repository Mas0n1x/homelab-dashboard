/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';
import * as gs from '../services/gameservers.js';

/*
 * Steuerung aller Pelican-Spielserver. Die Antwortformen für Status, Konsole, Dateien,
 * Backups, Spieler und Leistung entsprechen bewusst denen des mc-agent — so kann die
 * Minecraft-Seite einen Pelican-Server ohne eigenen Code genauso bedienen wie Survival.
 */

const router = Router();

// Fehler in JSON-Antworten übersetzen, damit das Frontend eine lesbare Meldung zeigt.
const h = (fn) => async (req, res) => {
  try {
    const server = await gs.getServer(req.params.id);
    const out = await fn(req, res, server);
    if (out !== undefined && !res.headersSent) res.json(out);
  } catch (e) {
    if (!res.headersSent) res.status(e.status || 502).json({ error: e.message });
  }
};

router.get('/', async (req, res) => {
  if (!gs.konfiguriert()) return res.json({ configured: false, servers: [] });
  try {
    res.json({ configured: true, servers: await gs.listWithState() });
  } catch (e) {
    res.status(e.status || 502).json({ configured: true, servers: [], error: e.message });
  }
});

router.get('/:id/status', h(async (req, res, s) => {
  const state = await gs.getState(s);
  return { ...state, id: s.id, name: s.name, game: s.game, gameLabel: s.gameLabel, host: s.host };
}));

router.post('/:id/power', h(async (req, res, s) => {
  await gs.power(s, req.body?.action);
  return { ok: true };
}));

router.post('/:id/command', h(async (req, res, s) => {
  const command = String(req.body?.command || '').trim();
  if (!command) return { error: 'Leerer Befehl' };
  await gs.befehl(s, command);
  // Die Ausgabe erscheint in der Konsole; eine Antwort gibt es bei Pelican nicht.
  return { ok: true };
}));

router.get('/:id/logs', h(async (req, res, s) => {
  const tail = Math.min(Math.max(parseInt(req.query.tail, 10) || 250, 1), 1000);
  return { logs: await gs.logs(s, tail) };
}));

// Live-Werte samt Verlauf (Kurven in der Leistungsansicht).
router.get('/:id/stats', h(async (req, res, s) => {
  const state = await gs.getState(s);
  const live = gs.verlauf(s);
  return { state, stats: live.stats, history: live.history, limits: s.limits };
}));

// Form wie beim mc-agent: TPS/MSPT gibt es ohne Plugin nicht, dann bleibt die Karte leer.
router.get('/:id/performance', h(async (req, res, s) => {
  const st = await gs.getState(s);
  return { tps: null, mspt: null, memUsage: st.memory, memLimit: st.memoryLimit, cpuPercent: st.cpu };
}));

router.get('/:id/players', h(async (req, res, s) => {
  const p = await gs.minecraftPing(s);
  return p ? { online: p.online, count: p.count, max: p.max, version: p.version } : { online: [], count: 0, max: null };
}));

const spielzeit = async (s, welt, uuid) => {
  try {
    const j = JSON.parse(await gs.dateiLesen(s, `/${welt}/stats/${uuid}.json`));
    const ticks = j.stats?.['minecraft:custom']?.['minecraft:play_time'] ?? j.stats?.['minecraft:custom']?.['minecraft:play_one_minute'];
    return ticks != null ? Math.round((ticks / 20 / 3600) * 10) / 10 : null;
  } catch { return null; }
};

router.get('/:id/players/known', h(async (req, res, s) => {
  const lies = async (f) => { try { const j = JSON.parse(await gs.dateiLesen(s, f)); return Array.isArray(j) ? j : []; } catch { return []; } };
  const [cache, ops, wl, banned] = await Promise.all(['/usercache.json', '/ops.json', '/whitelist.json', '/banned-players.json'].map(lies));
  let welt = 'world';
  try { welt = /^level-name=(.+)$/m.exec(await gs.dateiLesen(s, '/server.properties'))?.[1]?.trim() || 'world'; } catch { /* Voreinstellung */ }
  const mark = (arr) => new Set(arr.map(x => x.uuid));
  const [opS, wlS, banS] = [mark(ops), mark(wl), mark(banned)];
  const alle = new Map();
  for (const p of [...cache, ...ops, ...wl, ...banned]) if (p.uuid && !alle.has(p.uuid)) alle.set(p.uuid, p.name);
  const players = await Promise.all([...alle].map(async ([uuid, name]) => ({
    uuid, name, op: opS.has(uuid), whitelisted: wlS.has(uuid), banned: banS.has(uuid), playtimeHours: await spielzeit(s, welt, uuid),
  })));
  return { players: players.sort((a, b) => (b.playtimeHours ?? -1) - (a.playtimeHours ?? -1) || a.name.localeCompare(b.name)) };
}));

// Konfigurationsdateien: nur die bekannten, die tatsächlich im Hauptordner liegen.
const CONFIGS = ['server.properties', 'whitelist.json', 'ops.json', 'banned-players.json', 'banned-ips.json', 'user_jvm_args.txt', 'eula.txt'];

router.get('/:id/configs', h(async (req, res, s) => {
  const { entries } = await gs.dateien(s, '/');
  const vorhanden = new Set(entries.filter(e => e.type === 'file').map(e => e.name));
  return { files: CONFIGS.filter(f => vorhanden.has(f)) };
}));

router.get('/:id/config/:file', h(async (req, res, s) => {
  if (!CONFIGS.includes(req.params.file)) return res.status(400).json({ error: 'Datei nicht erlaubt' });
  return { content: await gs.dateiLesen(s, `/${req.params.file}`) };
}));

router.put('/:id/config/:file', h(async (req, res, s) => {
  if (!CONFIGS.includes(req.params.file)) return res.status(400).json({ error: 'Datei nicht erlaubt' });
  await gs.dateiSchreiben(s, `/${req.params.file}`, req.body?.content ?? '');
  return { ok: true };
}));

// Dateien
router.get('/:id/files', h((req, res, s) => gs.dateien(s, req.query.path)));

router.get('/:id/file', h(async (req, res, s) => {
  const content = await gs.dateiLesen(s, req.query.path);
  return { content: typeof content === 'string' ? content : JSON.stringify(content, null, 2) };
}));

router.put('/:id/file', h(async (req, res, s) => {
  await gs.dateiSchreiben(s, req.query.path, req.body?.content ?? '');
  return { ok: true };
}));

router.post('/:id/upload', h(async (req, res, s) => {
  const { path, name, dataBase64 } = req.body || {};
  if (!name || !dataBase64 || /[\\/]/.test(name)) return res.status(400).json({ error: 'Name oder Inhalt fehlt' });
  const buf = Buffer.from(dataBase64, 'base64');
  await gs.hochladen(s, path, name, buf);
  return { ok: true, name, size: buf.length };
}));

router.post('/:id/files/delete', h(async (req, res, s) => {
  const names = (req.body?.names || []).filter(n => typeof n === 'string' && n && !/[\\/]/.test(n));
  if (!names.length) return res.status(400).json({ error: 'Nichts ausgewählt' });
  await gs.dateiLoeschen(s, req.body?.path, names);
  return { ok: true };
}));

router.post('/:id/files/mkdir', h(async (req, res, s) => {
  const name = String(req.body?.name || '').trim();
  if (!name || /[\\/]/.test(name)) return res.status(400).json({ error: 'Ungültiger Ordnername' });
  await gs.ordnerAnlegen(s, req.body?.path, name);
  return { ok: true };
}));

router.post('/:id/files/rename', h(async (req, res, s) => {
  const { path, from, to } = req.body || {};
  if (!from || !to || /[\\/]/.test(from) || /[\\/]/.test(to)) return res.status(400).json({ error: 'Ungültiger Name' });
  await gs.umbenennen(s, path, from, to);
  return { ok: true };
}));

router.get('/:id/files/download', h(async (req, res, s) => ({ url: await gs.downloadLink(s, req.query.path) })));

// Backups (Kennung = UUID; der Anzeigename ist nicht eindeutig)
router.get('/:id/backups', h(async (req, res, s) => ({ backups: await gs.backups(s), limit: s.backupLimit })));

router.post('/:id/backups', h(async (req, res, s) => {
  const b = await gs.backupAnlegen(s, req.body?.name);
  return { ok: true, size: b.size, id: b.id, note: 'Backup gestartet — es erscheint in der Liste, sobald es fertig ist.' };
}));

router.post('/:id/backups/:uuid/restore', h(async (req, res, s) => {
  await gs.backupWiederherstellen(s, req.params.uuid);
  return { ok: true };
}));

router.delete('/:id/backups/:uuid', h(async (req, res, s) => {
  await gs.backupLoeschen(s, req.params.uuid);
  return { ok: true };
}));

router.get('/:id/backups/:uuid/download', h(async (req, res, s) => ({ url: await gs.backupLink(s, req.params.uuid) })));

// Zeitpläne
router.get('/:id/schedules', h(async (req, res, s) => ({ schedules: await gs.zeitplaene(s) })));

router.post('/:id/schedules', h(async (req, res, s) => {
  const { name, cron, task } = req.body || {};
  const felder = ['minute', 'hour', 'day_of_month', 'month', 'day_of_week'];
  if (!name || !cron || felder.some(f => !String(cron[f] ?? '').trim())) return res.status(400).json({ error: 'Name und Zeitangabe fehlen' });
  if (task && !['command', 'power', 'backup'].includes(task.action)) return res.status(400).json({ error: 'Unbekannte Aufgabe' });
  return { ok: true, id: await gs.zeitplanAnlegen(s, { name, cron, task }) };
}));

router.put('/:id/schedules/:sid', h(async (req, res, s) => {
  await gs.zeitplanSchalten(s, req.params.sid, !!req.body?.active);
  return { ok: true };
}));

router.post('/:id/schedules/:sid/run', h(async (req, res, s) => {
  await gs.zeitplanAusfuehren(s, req.params.sid);
  return { ok: true };
}));

router.delete('/:id/schedules/:sid', h(async (req, res, s) => {
  await gs.zeitplanLoeschen(s, req.params.sid);
  return { ok: true };
}));

// Start-Optionen
router.get('/:id/startup', h((req, res, s) => gs.startOptionen(s)));

router.put('/:id/startup', h(async (req, res, s) => {
  const { key, value } = req.body || {};
  if (!key) return res.status(400).json({ error: 'Schlüssel fehlt' });
  await gs.startOptionSetzen(s, key, value ?? '');
  return { ok: true };
}));

export default router;
