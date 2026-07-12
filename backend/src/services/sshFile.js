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

// Liest eine Datei auf dem Remote-Host über SFTP als UTF-8-Text.
export async function readRemoteFile(sshConfig, remotePath) {
  const conn = await connect(sshConfig);
  try {
    const sftp = await getSftp(conn);
    return await new Promise((resolve, reject) => {
      sftp.readFile(remotePath, (err, data) => {
        if (err) reject(new Error(`Datei nicht lesbar (${remotePath}): ${err.message}`));
        else resolve(data.toString('utf8'));
      });
    });
  } finally {
    conn.end();
  }
}

// Schreibt eine Datei auf dem Remote-Host über SFTP. Legt zuvor (best effort)
// eine ".bak"-Sicherung der bestehenden Datei an — analog zum lokalen Editor.
export async function writeRemoteFile(sshConfig, remotePath, content) {
  const conn = await connect(sshConfig);
  try {
    const sftp = await getSftp(conn);

    // Bestehende Datei sichern (falls vorhanden) — schlägt das fehl, ist es kein Abbruchgrund.
    const existing = await new Promise((resolve) => {
      sftp.readFile(remotePath, (err, data) => resolve(err ? null : data));
    });
    if (existing) {
      await new Promise((resolve) => {
        sftp.writeFile(`${remotePath}.bak`, existing, () => resolve());
      });
    }

    await new Promise((resolve, reject) => {
      sftp.writeFile(remotePath, content, { encoding: 'utf8' }, (err) => {
        if (err) reject(new Error(`Datei nicht schreibbar (${remotePath}): ${err.message}`));
        else resolve();
      });
    });
    return true;
  } finally {
    conn.end();
  }
}
