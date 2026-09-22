/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';
import serverManager from '../services/serverManager.js';
import { logAudit } from '../services/audit.js';
import {
  listRemoteDir, readRemoteFileBuffer, writeRemoteFileBuffer, mkdirRemote, removeRemote,
} from '../services/sshFile.js';
import {
  listLocalDir, readLocalFileBuffer, writeLocalFileBuffer, mkdirLocal, removeLocal,
} from '../services/localFiles.js';

const router = Router();

// Default-Einstieg: lokal in /srv (einziger gemounteter Host-Pfad), remote im Home
// des SSH-Users (praktisch immer root -> /root).
const DEFAULT_LOCAL_PATH = '/srv';
const DEFAULT_REMOTE_PATH = '/root';

// Löst serverId auf eine SSH-Config auf (oder null für den lokalen Host-Mount).
// Wirft, wenn der Server nicht existiert oder (noch) keinen SSH-Zugang hat.
function resolveTarget(serverId) {
  if (!serverId || serverId === 'local') return { sshConfig: null };
  const conn = serverManager.getConnection(serverId);
  if (!conn) {
    const err = new Error(`Server "${serverId}" nicht gefunden`);
    err.statusCode = 404;
    throw err;
  }
  if (!conn.config?.ssh_host) {
    const err = new Error(`Server "${serverId}" hat keinen SSH-Zugang konfiguriert`);
    err.statusCode = 409;
    throw err;
  }
  return { sshConfig: conn.config, name: conn.config.name };
}

function fail(res, error, fallbackMessage) {
  res.status(error.statusCode || 500).json({ error: fallbackMessage, message: error.message });
}

function defaultPath(sshConfig) {
  return sshConfig ? DEFAULT_REMOTE_PATH : DEFAULT_LOCAL_PATH;
}

// ==================== VERZEICHNIS-LISTING ====================

router.get('/list', async (req, res) => {
  try {
    const { sshConfig } = resolveTarget(req.query.serverId);
    const targetPath = req.query.path || defaultPath(sshConfig);
    const entries = sshConfig
      ? await listRemoteDir(sshConfig, targetPath)
      : await listLocalDir(targetPath);
    res.json({ path: targetPath, entries });
  } catch (error) {
    fail(res, error, 'Verzeichnis konnte nicht gelesen werden');
  }
});

// ==================== DATEI LESEN / BEARBEITEN ====================

// Grobe Text-/Binär-Erkennung: Nullbyte in den ersten 8 KB gilt als Binärdatei.
function isProbablyBinary(buffer) {
  const sample = buffer.subarray(0, 8192);
  return sample.includes(0);
}

router.get('/read', async (req, res) => {
  try {
    const { sshConfig } = resolveTarget(req.query.serverId);
    const targetPath = req.query.path;
    if (!targetPath) return res.status(400).json({ error: 'path ist erforderlich' });

    const buffer = sshConfig
      ? await readRemoteFileBuffer(sshConfig, targetPath)
      : await readLocalFileBuffer(targetPath);

    if (isProbablyBinary(buffer)) {
      return res.json({ path: targetPath, binary: true, size: buffer.length });
    }
    res.json({ path: targetPath, binary: false, content: buffer.toString('utf8'), size: buffer.length });
  } catch (error) {
    fail(res, error, 'Datei konnte nicht gelesen werden');
  }
});

router.put('/write', async (req, res) => {
  try {
    const { serverId, path: targetPath, content } = req.body || {};
    if (!targetPath) return res.status(400).json({ error: 'path ist erforderlich' });
    if (typeof content !== 'string') return res.status(400).json({ error: 'content ist erforderlich' });

    const { sshConfig } = resolveTarget(serverId);
    const buffer = Buffer.from(content, 'utf8');
    if (sshConfig) await writeRemoteFileBuffer(sshConfig, targetPath, buffer);
    else await writeLocalFileBuffer(targetPath, buffer);

    logAudit('files.write', targetPath, serverId || 'local', req.user?.id);
    res.json({ ok: true, path: targetPath });
  } catch (error) {
    fail(res, error, 'Datei konnte nicht gespeichert werden');
  }
});

// ==================== DOWNLOAD / UPLOAD ====================

router.get('/download', async (req, res) => {
  try {
    const { sshConfig } = resolveTarget(req.query.serverId);
    const targetPath = req.query.path;
    if (!targetPath) return res.status(400).json({ error: 'path ist erforderlich' });

    const buffer = sshConfig
      ? await readRemoteFileBuffer(sshConfig, targetPath)
      : await readLocalFileBuffer(targetPath);

    const name = targetPath.split('/').pop() || 'download';
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(name)}"`);
    res.send(buffer);
  } catch (error) {
    fail(res, error, 'Datei konnte nicht heruntergeladen werden');
  }
});

// Upload liest den rohen Request-Body (kein multipart) — Zielverzeichnis via
// ?path=, Dateiname via Header X-File-Name. Gleiches Muster wie /api/mail/upload.
router.post('/upload', async (req, res) => {
  try {
    const dir = req.query.path;
    const fileName = req.headers['x-file-name'] ? decodeURIComponent(req.headers['x-file-name']) : null;
    if (!dir) return res.status(400).json({ error: 'path (Zielverzeichnis) ist erforderlich' });
    if (!fileName || fileName.includes('/') || fileName.includes('\\')) {
      return res.status(400).json({ error: 'Gültiger Dateiname (Header X-File-Name) ist erforderlich' });
    }

    const { sshConfig } = resolveTarget(req.query.serverId);

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const targetPath = `${dir.replace(/\/$/, '')}/${fileName}`;
    if (sshConfig) await writeRemoteFileBuffer(sshConfig, targetPath, buffer);
    else await writeLocalFileBuffer(targetPath, buffer);

    logAudit('files.upload', targetPath, req.query.serverId || 'local', req.user?.id);
    res.json({ ok: true, path: targetPath, size: buffer.length });
  } catch (error) {
    fail(res, error, 'Upload fehlgeschlagen');
  }
});

// ==================== ORDNER / LÖSCHEN ====================

router.post('/mkdir', async (req, res) => {
  try {
    const { serverId, path: dir, name } = req.body || {};
    if (!dir || !name || name.includes('/') || name.includes('\\')) {
      return res.status(400).json({ error: 'path und ein gültiger name sind erforderlich' });
    }
    const { sshConfig } = resolveTarget(serverId);
    const targetPath = `${dir.replace(/\/$/, '')}/${name}`;
    if (sshConfig) await mkdirRemote(sshConfig, targetPath);
    else await mkdirLocal(targetPath);

    logAudit('files.mkdir', targetPath, serverId || 'local', req.user?.id);
    res.json({ ok: true, path: targetPath });
  } catch (error) {
    fail(res, error, 'Ordner konnte nicht angelegt werden');
  }
});

router.delete('/delete', async (req, res) => {
  try {
    const { serverId, path: targetPath, isDir } = req.query;
    if (!targetPath) return res.status(400).json({ error: 'path ist erforderlich' });

    const { sshConfig } = resolveTarget(serverId);
    const dirFlag = isDir === 'true' || isDir === '1';
    if (sshConfig) await removeRemote(sshConfig, targetPath, dirFlag);
    else await removeLocal(targetPath, dirFlag);

    logAudit('files.delete', targetPath, serverId || 'local', req.user?.id);
    res.json({ ok: true, path: targetPath });
  } catch (error) {
    fail(res, error, 'Löschen fehlgeschlagen');
  }
});

export default router;
