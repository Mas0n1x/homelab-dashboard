/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Client } from 'ssh2';
import { readFileSync, existsSync } from 'fs';

// Eine Verbindung je Ziel wird wiederverwendet: der Handshake kostete sonst bei
// jedem Klick im Datei-Explorer erneut Zeit. Nach einer Minute Ruhe wird getrennt.
const RUHE_MS = 60 * 1000;
const pool = new Map(); // Schlüssel -> { bereit: Promise, nutzer, timer, conn }

// Baut eine SSH-Verbindung anhand einer Server-Config (ssh_host/ssh_user/…) auf.
// Nutzt denselben Key wie der Docker-SSH-Transport (ssh_key_path bzw. SSH_KEY_PATH).
function verbinde(sshConfig, eintrag, weg) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    eintrag.conn = conn;
    const keyPath = sshConfig.ssh_key_path || process.env.SSH_KEY_PATH;
    const options = {
      host: sshConfig.ssh_host,
      port: sshConfig.ssh_port || 22,
      username: sshConfig.ssh_user || 'root',
      readyTimeout: 12000,
      keepaliveInterval: 15000,
      keepaliveCountMax: 2,
    };
    if (keyPath && existsSync(keyPath)) {
      options.privateKey = readFileSync(keyPath);
    }
    const scheitern = (err) => {
      weg();
      reject(new Error(`SSH-Verbindung fehlgeschlagen (${sshConfig.ssh_host}): ${err.message}`));
    };
    conn.on('ready', () => conn.sftp((err, sftp) => {
      if (err) { conn.end(); return scheitern(err); }
      sftp.on('close', () => { weg(); conn.end(); });
      resolve(sftp);
    }));
    conn.on('error', scheitern);
    conn.on('close', () => { weg(); reject(new Error(`SSH-Verbindung geschlossen (${sshConfig.ssh_host})`)); });
    conn.connect(options);
  });
}

// Führt `fn(sftp)` auf der gemeinsamen Verbindung aus.
async function mitSftp(sshConfig, fn) {
  const schluessel = [sshConfig.ssh_user || 'root', sshConfig.ssh_host, sshConfig.ssh_port || 22, sshConfig.ssh_key_path || ''].join('|');
  let eintrag = pool.get(schluessel);
  if (!eintrag) {
    eintrag = { nutzer: 0 };
    pool.set(schluessel, eintrag);
    const dieser = eintrag;
    eintrag.bereit = verbinde(sshConfig, dieser, () => { if (pool.get(schluessel) === dieser) pool.delete(schluessel); });
  }
  clearTimeout(eintrag.timer);
  eintrag.nutzer++;
  try {
    return await fn(await eintrag.bereit);
  } finally {
    if (--eintrag.nutzer === 0) {
      eintrag.timer = setTimeout(() => {
        if (pool.get(schluessel) === eintrag) pool.delete(schluessel);
        eintrag.conn?.end();
      }, RUHE_MS);
      eintrag.timer.unref?.();
    }
  }
}

// Liest eine Datei auf dem Remote-Host über SFTP als Buffer (binärsicher).
export async function readRemoteFileBuffer(sshConfig, remotePath) {
  return mitSftp(sshConfig, async (sftp) => {
    return await new Promise((resolve, reject) => {
      sftp.readFile(remotePath, (err, data) => {
        if (err) reject(new Error(`Datei nicht lesbar (${remotePath}): ${err.message}`));
        else resolve(data);
      });
    });
  });
}

// Liest eine Datei auf dem Remote-Host über SFTP als UTF-8-Text.
export async function readRemoteFile(sshConfig, remotePath) {
  const buf = await readRemoteFileBuffer(sshConfig, remotePath);
  return buf.toString('utf8');
}

// Schreibt eine Datei (Buffer, binärsicher) auf dem Remote-Host über SFTP.
// Legt zuvor (best effort) eine ".bak"-Sicherung der bestehenden Datei an.
export async function writeRemoteFileBuffer(sshConfig, remotePath, buffer) {
  return mitSftp(sshConfig, async (sftp) => {
    const existing = await new Promise((resolve) => {
      sftp.readFile(remotePath, (err, data) => resolve(err ? null : data));
    });
    if (existing) {
      await new Promise((resolve) => {
        sftp.writeFile(`${remotePath}.bak`, existing, () => resolve());
      });
    }

    await new Promise((resolve, reject) => {
      sftp.writeFile(remotePath, buffer, (err) => {
        if (err) reject(new Error(`Datei nicht schreibbar (${remotePath}): ${err.message}`));
        else resolve();
      });
    });
    return true;
  });
}

// Schreibt eine Textdatei auf dem Remote-Host über SFTP.
export async function writeRemoteFile(sshConfig, remotePath, content) {
  return writeRemoteFileBuffer(sshConfig, remotePath, Buffer.from(content, 'utf8'));
}

// Listet ein Verzeichnis auf dem Remote-Host über SFTP.
export async function listRemoteDir(sshConfig, remotePath) {
  return mitSftp(sshConfig, async (sftp) => {
    const list = await new Promise((resolve, reject) => {
      sftp.readdir(remotePath, (err, entries) => {
        if (err) reject(new Error(`Verzeichnis nicht lesbar (${remotePath}): ${err.message}`));
        else resolve(entries);
      });
    });
    return list
      .map((e) => ({
        name: e.filename,
        type: e.longname?.startsWith('d') ? 'dir' : (e.longname?.startsWith('l') ? 'link' : 'file'),
        size: e.attrs?.size ?? 0,
        mtime: e.attrs?.mtime ? e.attrs.mtime * 1000 : null,
      }))
      .filter((e) => e.name !== '.' && e.name !== '..')
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1));
  });
}

// Legt ein Verzeichnis auf dem Remote-Host über SFTP an.
export async function mkdirRemote(sshConfig, remotePath) {
  return mitSftp(sshConfig, async (sftp) => {
    await new Promise((resolve, reject) => {
      sftp.mkdir(remotePath, (err) => {
        if (err) reject(new Error(`Verzeichnis nicht anlegbar (${remotePath}): ${err.message}`));
        else resolve();
      });
    });
    return true;
  });
}

// Löscht eine Datei oder ein (leeres) Verzeichnis auf dem Remote-Host über SFTP.
export async function removeRemote(sshConfig, remotePath, isDir) {
  return mitSftp(sshConfig, async (sftp) => {
    await new Promise((resolve, reject) => {
      const done = (err) => {
        if (err) reject(new Error(`Löschen fehlgeschlagen (${remotePath}): ${err.message}`));
        else resolve();
      };
      if (isDir) sftp.rmdir(remotePath, done);
      else sftp.unlink(remotePath, done);
    });
    return true;
  });
}
