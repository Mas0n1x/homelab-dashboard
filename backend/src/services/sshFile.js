/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Client } from 'ssh2';
import { readFileSync, existsSync } from 'fs';

// Baut eine SSH-Verbindung anhand einer Server-Config (ssh_host/ssh_user/…) auf.
// Nutzt denselben Key wie der Docker-SSH-Transport (ssh_key_path bzw. SSH_KEY_PATH).
function connect(sshConfig) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    const keyPath = sshConfig.ssh_key_path || process.env.SSH_KEY_PATH;
    const options = {
      host: sshConfig.ssh_host,
      port: sshConfig.ssh_port || 22,
      username: sshConfig.ssh_user || 'root',
      readyTimeout: 12000,
    };
    if (keyPath && existsSync(keyPath)) {
      options.privateKey = readFileSync(keyPath);
    }
    conn.on('ready', () => resolve(conn));
    conn.on('error', (err) => reject(new Error(`SSH-Verbindung fehlgeschlagen (${sshConfig.ssh_host}): ${err.message}`)));
    conn.connect(options);
  });
}

function getSftp(conn) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => (err ? reject(err) : resolve(sftp)));
  });
}

// Liest eine Datei auf dem Remote-Host über SFTP als Buffer (binärsicher).
export async function readRemoteFileBuffer(sshConfig, remotePath) {
  const conn = await connect(sshConfig);
  try {
    const sftp = await getSftp(conn);
    return await new Promise((resolve, reject) => {
      sftp.readFile(remotePath, (err, data) => {
        if (err) reject(new Error(`Datei nicht lesbar (${remotePath}): ${err.message}`));
        else resolve(data);
      });
    });
  } finally {
    conn.end();
  }
}

// Liest eine Datei auf dem Remote-Host über SFTP als UTF-8-Text.
export async function readRemoteFile(sshConfig, remotePath) {
  const buf = await readRemoteFileBuffer(sshConfig, remotePath);
  return buf.toString('utf8');
}

// Schreibt eine Datei (Buffer, binärsicher) auf dem Remote-Host über SFTP.
// Legt zuvor (best effort) eine ".bak"-Sicherung der bestehenden Datei an.
export async function writeRemoteFileBuffer(sshConfig, remotePath, buffer) {
  const conn = await connect(sshConfig);
  try {
    const sftp = await getSftp(conn);

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
  } finally {
    conn.end();
  }
}

// Schreibt eine Textdatei auf dem Remote-Host über SFTP.
export async function writeRemoteFile(sshConfig, remotePath, content) {
  return writeRemoteFileBuffer(sshConfig, remotePath, Buffer.from(content, 'utf8'));
}

// Listet ein Verzeichnis auf dem Remote-Host über SFTP.
export async function listRemoteDir(sshConfig, remotePath) {
  const conn = await connect(sshConfig);
  try {
    const sftp = await getSftp(conn);
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
  } finally {
    conn.end();
  }
}

// Legt ein Verzeichnis auf dem Remote-Host über SFTP an.
export async function mkdirRemote(sshConfig, remotePath) {
  const conn = await connect(sshConfig);
  try {
    const sftp = await getSftp(conn);
    await new Promise((resolve, reject) => {
      sftp.mkdir(remotePath, (err) => {
        if (err) reject(new Error(`Verzeichnis nicht anlegbar (${remotePath}): ${err.message}`));
        else resolve();
      });
    });
    return true;
  } finally {
    conn.end();
  }
}

// Löscht eine Datei oder ein (leeres) Verzeichnis auf dem Remote-Host über SFTP.
export async function removeRemote(sshConfig, remotePath, isDir) {
  const conn = await connect(sshConfig);
  try {
    const sftp = await getSftp(conn);
    await new Promise((resolve, reject) => {
      const done = (err) => {
        if (err) reject(new Error(`Löschen fehlgeschlagen (${remotePath}): ${err.message}`));
        else resolve();
      };
      if (isDir) sftp.rmdir(remotePath, done);
      else sftp.unlink(remotePath, done);
    });
    return true;
  } finally {
    conn.end();
  }
}
