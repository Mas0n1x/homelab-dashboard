/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Freigabelinks: Dateien aus dem Datei-Explorer per Link für Kunden/Freunde zum Download.
//  - sharesAdminRoutes  (/api/shares, mit Anmeldung): anlegen, auflisten, widerrufen
//  - sharePublicRoutes  (/api/share,  OHNE Anmeldung): Info, Passwortprüfung, Download
import express, { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { getDb } from '../services/database.js';
import { logAudit } from '../services/audit.js';
import { JWT_SECRET } from '../services/auth.js';
import { listRemoteDir, readRemoteFileBuffer } from '../services/sshFile.js';
import { resolveLocalPath } from '../services/localFiles.js';
import { resolveTarget } from './files.js';

const jsonBody = express.json({ limit: '4kb' });
const MAX_REMOTE_BYTES = 500 * 1024 * 1024; // Remote-Dateien werden komplett gepuffert
const TICKET_SEKUNDEN = 120;

// Versehentliche Freigabe von Zugangsdaten verhindern (Schlüssel, .env, Geheimnis-Ordner).
const SENSIBEL = /(^|\/)(\.env[^/]*|id_[a-z0-9]+(\.pub)?|[^/]*\.(pem|key|p12|pfx)|\.ssh|_secrets|authorized_keys)(\/|$)/i;

function ipVon(req) {
  return (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() || req.ip || 'unbekannt';
}

// ---------- Hilfen ----------

async function dateiInfo(serverId, pfad) {
  const { sshConfig } = resolveTarget(serverId);
  const name = pfad.split('/').pop();
  if (sshConfig) {
    const eltern = pfad.split('/').slice(0, -1).join('/') || '/';
    const eintraege = await listRemoteDir(sshConfig, eltern);
    const e = eintraege.find((x) => x.name === name);
    if (!e) return null;
    return { name, size: e.size, istDatei: e.type !== 'dir' };
  }
  const { containerPath } = resolveLocalPath(pfad);
  const st = await fs.promises.stat(containerPath).catch(() => null);
  if (!st) return null;
  return { name, size: st.size, istDatei: st.isFile() };
}

function status(row) {
  if (!row || row.revoked) return { ok: false, code: 404, grund: 'Dieser Link existiert nicht (mehr).' };
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return { ok: false, code: 410, grund: 'Der Link ist abgelaufen.' };
  if (row.max_downloads != null && row.downloads >= row.max_downloads) return { ok: false, code: 410, grund: 'Das Download-Limit dieses Links ist erreicht.' };
  return { ok: true };
}

function ticketFuer(token, ablauf) {
  return `${ablauf}.${crypto.createHmac('sha256', JWT_SECRET).update(`share|${token}|${ablauf}`).digest('base64url')}`;
}
function ticketGueltig(token, ticket) {
  const [ablauf, sig] = String(ticket || '').split('.');
  if (!ablauf || !sig || Number(ablauf) < Date.now()) return false;
  const soll = ticketFuer(token, ablauf).split('.')[1];
  const a = Buffer.from(sig);
  const b = Buffer.from(soll);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Passwort-Fehlversuche je IP+Token bremsen (5 Fehler -> 15 Minuten Sperre)
const versuche = new Map();
function gesperrt(schluessel) {
  const v = versuche.get(schluessel);
  return !!v && v.bis > Date.now();
}
function fehlversuch(schluessel) {
  const v = versuche.get(schluessel) || { n: 0, bis: 0 };
  if (v.bis && v.bis <= Date.now()) { v.n = 0; v.bis = 0; }
  v.n += 1;
  if (v.n >= 5) v.bis = Date.now() + 15 * 60 * 1000;
  versuche.set(schluessel, v);
}
setInterval(() => {
  const jetzt = Date.now();
  for (const [k, v] of versuche) if (v.bis && v.bis < jetzt) versuche.delete(k);
}, 10 * 60 * 1000).unref();

function zeile(r) {
  const s = status(r);
  return {
    id: r.id, token: r.token, serverId: r.server_id, path: r.path, name: r.name, size: r.size,
    passwort: !!r.password_hash, expiresAt: r.expires_at, maxDownloads: r.max_downloads,
    downloads: r.downloads, createdAt: r.created_at, lastDownloadAt: r.last_download_at,
    status: s.ok ? 'aktiv' : (s.code === 410 ? 'beendet' : 'widerrufen'),
  };
}

// ---------- Verwaltung (angemeldet) ----------

export const sharesAdminRoutes = Router();

sharesAdminRoutes.post('/', async (req, res) => {
  try {
    const { serverId, path: pfad, expiresInHours, password, maxDownloads } = req.body || {};
    if (!pfad || typeof pfad !== 'string') return res.status(400).json({ error: 'path ist erforderlich' });
    if (SENSIBEL.test(pfad)) return res.status(400).json({ error: 'Diese Datei enthält Zugangsdaten und lässt sich nicht freigeben.' });

    const info = await dateiInfo(serverId, pfad);
    if (!info) return res.status(404).json({ error: 'Datei nicht gefunden' });
    if (!info.istDatei) return res.status(400).json({ error: 'Nur Dateien lassen sich freigeben, keine Ordner' });
    const { sshConfig } = resolveTarget(serverId);
    if (sshConfig && info.size > MAX_REMOTE_BYTES) {
      return res.status(400).json({ error: 'Dateien auf Fernservern sind für Freigaben auf 500 MB begrenzt' });
    }

    const stunden = expiresInHours == null || expiresInHours === '' ? null : Number(expiresInHours);
    if (stunden != null && (!Number.isFinite(stunden) || stunden <= 0 || stunden > 24 * 365)) {
      return res.status(400).json({ error: 'Ungültige Gültigkeitsdauer' });
    }
    const limit = maxDownloads == null || maxDownloads === '' ? null : Math.floor(Number(maxDownloads));
    if (limit != null && (!Number.isFinite(limit) || limit < 1 || limit > 100000)) {
      return res.status(400).json({ error: 'Ungültiges Download-Limit' });
    }
    if (password != null && password !== '' && String(password).length < 4) {
      return res.status(400).json({ error: 'Das Passwort braucht mindestens 4 Zeichen' });
    }

    const token = crypto.randomBytes(24).toString('base64url');
    const ablauf = stunden == null ? null : new Date(Date.now() + stunden * 3600 * 1000).toISOString();
    const hash = password ? await bcrypt.hash(String(password), 10) : null;
    const db = getDb();
    const r = db.prepare(
      'INSERT INTO shares (token, server_id, path, name, size, password_hash, expires_at, max_downloads, created_by) VALUES (?,?,?,?,?,?,?,?,?)'
    ).run(token, serverId || 'local', pfad, info.name, info.size, hash, ablauf, limit, req.user?.id ?? null);

    logAudit('share.create', pfad, { serverId: serverId || 'local', ablauf, limit, passwort: !!hash }, req.user?.id);
    res.json(zeile(db.prepare('SELECT * FROM shares WHERE id = ?').get(r.lastInsertRowid)));
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: 'Freigabe konnte nicht angelegt werden', message: error.message });
  }
});

sharesAdminRoutes.get('/', (req, res) => {
  const rows = getDb().prepare('SELECT * FROM shares WHERE revoked = 0 ORDER BY id DESC LIMIT 200').all();
  res.json(rows.map(zeile));
});

sharesAdminRoutes.delete('/:id', (req, res) => {
  const r = getDb().prepare('UPDATE shares SET revoked = 1 WHERE id = ?').run(Number(req.params.id));
  if (!r.changes) return res.status(404).json({ error: 'Freigabe nicht gefunden' });
  logAudit('share.revoke', String(req.params.id), null, req.user?.id);
  res.json({ ok: true });
});

// ---------- Öffentlich (ohne Anmeldung) ----------

export const sharePublicRoutes = Router();

function holen(token) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  return getDb().prepare('SELECT * FROM shares WHERE token = ?').get(token);
}

// Antworten dürfen nie Pfade oder Serverdaten verraten — nur Name, Größe, Ablauf.
sharePublicRoutes.get('/:token', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const row = holen(req.params.token);
  const s = status(row);
  if (!s.ok) return res.status(s.code).json({ error: s.grund });
  res.json({
    name: row.name, size: row.size, expiresAt: row.expires_at, needsPassword: !!row.password_hash,
    restDownloads: row.max_downloads == null ? null : Math.max(0, row.max_downloads - row.downloads),
  });
});

sharePublicRoutes.post('/:token/ticket', jsonBody, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const row = holen(req.params.token);
  const s = status(row);
  if (!s.ok) return res.status(s.code).json({ error: s.grund });

  if (row.password_hash) {
    const schluessel = `${ipVon(req)}|${row.token}`;
    if (gesperrt(schluessel)) return res.status(429).json({ error: 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.' });
    const ok = await bcrypt.compare(String(req.body?.password || ''), row.password_hash);
    if (!ok) { fehlversuch(schluessel); return res.status(401).json({ error: 'Falsches Passwort' }); }
    versuche.delete(schluessel);
  }
  res.json({ ticket: ticketFuer(row.token, Date.now() + TICKET_SEKUNDEN * 1000) });
});

sharePublicRoutes.get('/:token/file', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const row = holen(req.params.token);
  const s = status(row);
  if (!s.ok) return res.status(s.code).json({ error: s.grund });
  if (row.password_hash && !ticketGueltig(row.token, req.query.t)) {
    return res.status(401).json({ error: 'Passwort erforderlich' });
  }

  try {
    const { sshConfig } = resolveTarget(row.server_id);
    let stream = null;
    let buffer = null;
    let laenge;
    if (sshConfig) {
      buffer = await readRemoteFileBuffer(sshConfig, row.path);
      laenge = buffer.length;
    } else {
      const { containerPath } = resolveLocalPath(row.path);
      const st = await fs.promises.stat(containerPath);
      if (!st.isFile()) return res.status(404).json({ error: 'Die Datei ist nicht mehr verfügbar.' });
      laenge = st.size;
      stream = fs.createReadStream(containerPath);
    }

    // Zählen und Limit atomar prüfen, erst dann ausliefern
    const z = getDb().prepare(
      "UPDATE shares SET downloads = downloads + 1, last_download_at = datetime('now') WHERE id = ? AND revoked = 0 AND (max_downloads IS NULL OR downloads < max_downloads)"
    ).run(row.id);
    if (!z.changes) {
      stream?.destroy();
      return res.status(410).json({ error: 'Das Download-Limit dieses Links ist erreicht.' });
    }
    logAudit('share.download', row.path, { id: row.id, ip: ipVon(req) }, null);

    const ascii = row.name.replace(/[^\x20-\x7e]|["\\]/g, '_');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Length', String(laenge));
    res.setHeader('Content-Disposition', `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(row.name)}`);
    if (buffer) return res.end(buffer);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  } catch {
    if (!res.headersSent) res.status(404).json({ error: 'Die Datei ist nicht mehr verfügbar.' });
  }
});
