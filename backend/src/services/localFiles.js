/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { promises as fs, existsSync, copyFileSync } from 'fs';
import path from 'path';

// Host-Dateisystem ist nur unterhalb von /srv gemountet (docker-compose.yml:
// "/srv:/host/srv:rw") — alles außerhalb ist im Container gar nicht vorhanden.
const HOST_MOUNT_ROOT = '/host';
const ALLOWED_PREFIX = '/srv';

// Bildet einen vom Frontend kommenden Host-Pfad (z. B. "/srv/homelab-dashboard")
// sicher auf den gemounteten Container-Pfad ab. Wirft bei Verlassen von /srv
// (auch über "..") oder bei relativen Pfaden.
export function resolveLocalPath(hostPath) {
  const normalized = path.posix.normalize(`/${hostPath || '/'}`);
  if (normalized !== ALLOWED_PREFIX && !normalized.startsWith(`${ALLOWED_PREFIX}/`)) {
    const err = new Error(`Pfad außerhalb des freigegebenen Bereichs (${ALLOWED_PREFIX}): ${normalized}`);
    err.statusCode = 400;
    throw err;
  }
  return { hostPath: normalized, containerPath: path.posix.join(HOST_MOUNT_ROOT, normalized) };
}

export async function listLocalDir(hostPath) {
  const { containerPath } = resolveLocalPath(hostPath);
  const entries = await fs.readdir(containerPath, { withFileTypes: true });
  const result = await Promise.all(entries.map(async (e) => {
    let size = 0, mtime = null;
    try {
      const st = await fs.stat(path.posix.join(containerPath, e.name));
      size = st.size;
      mtime = st.mtimeMs;
    } catch { /* kaputte Symlinks o. ä. — ignorieren, Eintrag bleibt sichtbar */ }
    return {
      name: e.name,
      type: e.isDirectory() ? 'dir' : (e.isSymbolicLink() ? 'link' : 'file'),
      size,
      mtime,
    };
  }));
  return result.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
}

export async function readLocalFileBuffer(hostPath) {
  const { containerPath } = resolveLocalPath(hostPath);
  return fs.readFile(containerPath);
}

export async function writeLocalFileBuffer(hostPath, buffer) {
  const { containerPath } = resolveLocalPath(hostPath);
  if (existsSync(containerPath)) {
    copyFileSync(containerPath, `${containerPath}.bak`);
  }
  await fs.mkdir(path.posix.dirname(containerPath), { recursive: true });
  await fs.writeFile(containerPath, buffer);
  return true;
}

export async function mkdirLocal(hostPath) {
  const { containerPath } = resolveLocalPath(hostPath);
  await fs.mkdir(containerPath, { recursive: false });
  return true;
}

export async function removeLocal(hostPath, isDir) {
  const { containerPath } = resolveLocalPath(hostPath);
  if (isDir) await fs.rmdir(containerPath);
  else await fs.unlink(containerPath);
  return true;
}
