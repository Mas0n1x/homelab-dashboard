/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// SSH-Hostschlüssel der Server prüfen. Beim ersten Kontakt wird der Schlüssel gemerkt,
// danach muss er gleich bleiben. Ändert er sich, wird die Verbindung abgelehnt, bis er
// in den Einstellungen ausdrücklich angenommen wird — sonst könnte sich jemand
// zwischen Dashboard und Server setzen und die Root-Sitzung abgreifen.
import crypto from 'crypto';
import { getDb } from './database.js';
import { logAudit } from './audit.js';

const fingerabdruck = (key) => `SHA256:${crypto.createHash('sha256').update(key).digest('base64').replace(/=+$/, '')}`;

// Der Schlüssel beginnt mit seiner Typ-Bezeichnung als längenpräfixierter Zeichenkette.
const schluesselTyp = (key) => {
  const laenge = key.length >= 4 ? key.readUInt32BE(0) : 0;
  return laenge > 0 && laenge <= 64 ? key.subarray(4, 4 + laenge).toString('ascii') : 'unbekannt';
};

function melde(host, port, bekannt, neu) {
  logAudit('ssh.hostkey_mismatch', `${host}:${port}`, { bekannt, neu }, null);
  console.error(`[ssh] Hostschlüssel von ${host}:${port} hat sich geändert (bekannt ${bekannt}, jetzt ${neu}) — Verbindung abgelehnt.`);
  // Erst hier laden: alerting hängt am serverManager, der wiederum diese Datei nutzt.
  import('./alerting.js').then(({ notify }) => notify('server_offline', {
    title: '🔐 SSH-Schlüssel geändert',
    message: `${host}:${port} meldet sich mit einem anderen Schlüssel. Die Verbindung ist gesperrt, bis du ihn unter Einstellungen → Fleet prüfst.`,
    color: 0xff4444,
    fields: [
      { name: 'Bekannt', value: bekannt, inline: false },
      { name: 'Jetzt', value: neu, inline: false },
    ],
  })).catch(e => console.error('[ssh] Meldung fehlgeschlagen:', e.message));
}

export function pruefeHostSchluessel(host, port, key) {
  const db = getDb();
  const fp = fingerabdruck(key);
  const jetzt = new Date().toISOString();
  const bekannt = db.prepare('SELECT * FROM ssh_host_keys WHERE host = ? AND port = ?').get(host, port);

  if (!bekannt) {
    db.prepare('INSERT INTO ssh_host_keys (host, port, key_type, fingerprint, first_seen) VALUES (?, ?, ?, ?, ?)')
      .run(host, port, schluesselTyp(key), fp, jetzt);
    logAudit('ssh.hostkey_pinned', `${host}:${port}`, { fingerprint: fp }, null);
    return true;
  }
  if (bekannt.fingerprint === fp) {
    if (bekannt.pending_fingerprint) {
      db.prepare('UPDATE ssh_host_keys SET pending_fingerprint = NULL, pending_type = NULL, pending_since = NULL WHERE host = ? AND port = ?').run(host, port);
    }
    return true;
  }
  // Nur beim ersten Auftreten melden — die Jobs versuchen es alle paar Sekunden erneut.
  if (bekannt.pending_fingerprint !== fp) {
    db.prepare('UPDATE ssh_host_keys SET pending_fingerprint = ?, pending_type = ?, pending_since = ? WHERE host = ? AND port = ?')
      .run(fp, schluesselTyp(key), jetzt, host, port);
    melde(host, port, bekannt.fingerprint, fp);
  }
  return false;
}

/** Option für `ssh2.Client#connect`: `{ ...hostPruefung(host, port) }`. */
export const hostPruefung = (host, port = 22) => ({
  hostVerifier: (key) => {
    try {
      return pruefeHostSchluessel(host, Number(port) || 22, key);
    } catch (error) {
      console.error('[ssh] Hostschlüssel-Prüfung fehlgeschlagen:', error.message);
      return false;
    }
  },
});

export function listeHostSchluessel() {
  const db = getDb();
  const server = db.prepare('SELECT id, name, ssh_host, ssh_port, is_local FROM servers').all();
  const lokal = process.env.LOCAL_SSH_HOST || 'host.docker.internal';
  return db.prepare('SELECT * FROM ssh_host_keys ORDER BY host, port').all().map(k => ({
    host: k.host,
    port: k.port,
    servers: server
      .filter(s => (s.ssh_host || (s.is_local ? lokal : null)) === k.host && (s.ssh_port || 22) === k.port)
      .map(s => s.name),
    keyType: k.key_type,
    fingerprint: k.fingerprint,
    firstSeen: k.first_seen,
    pending: k.pending_fingerprint
      ? { fingerprint: k.pending_fingerprint, keyType: k.pending_type, since: k.pending_since }
      : null,
  }));
}

/** Übernimmt genau den Schlüssel, den der Nutzer gesehen hat. */
export function nimmHostSchluesselAn(host, port, fingerprint, userId = null) {
  const geaendert = getDb().prepare(`
    UPDATE ssh_host_keys
    SET fingerprint = pending_fingerprint, key_type = pending_type, first_seen = ?,
        pending_fingerprint = NULL, pending_type = NULL, pending_since = NULL
    WHERE host = ? AND port = ? AND pending_fingerprint = ?
  `).run(new Date().toISOString(), host, port, fingerprint).changes;
  if (geaendert) logAudit('ssh.hostkey_accepted', `${host}:${port}`, { fingerprint }, userId);
  return geaendert > 0;
}
