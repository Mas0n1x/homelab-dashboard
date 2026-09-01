#!/usr/bin/env node
/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */

// Gespeicherte Mail-Zugangsdaten auf den aktuellen MAIL_CRYPT_KEY umschlüsseln.
//
// Warum es das gibt: Der Schlüssel für die Mail-Zugangsdaten wurde früher aus
// dem JWT_SECRET abgeleitet. Am 01.09.2026 wurde das JWT_SECRET rotiert (es war
// der öffentlich bekannte Default) — und damit waren alle gespeicherten Zugänge
// unlesbar, ohne dass es irgendwo aufgefallen wäre. Seitdem gibt es einen
// eigenen MAIL_CRYPT_KEY und dieses Skript für jede weitere Rotation.
//
// Ablauf einer Rotation:
//   1. Alten Schlüssel in MAIL_CRYPT_KEY_LEGACY sichern (komma-getrennt möglich)
//   2. Neuen Wert in MAIL_CRYPT_KEY setzen  (openssl rand -hex 32)
//   3. Backend neu starten, damit beide Werte im Container stehen
//   4. Dieses Skript mit --apply laufen lassen
//   5. MAIL_CRYPT_KEY_LEGACY wieder entfernen und Backend neu starten
//
// Läuft IM Backend-Container, weil better-sqlite3 dort nativ gebaut liegt:
//
//   docker cp scripts/mail-crypt-rotate.mjs homelab-backend:/app/mail-crypt-rotate.mjs
//   docker exec -w /app homelab-backend node mail-crypt-rotate.mjs --apply
//
// Ohne --apply ist es ein Dry-Run: es sagt nur, was entschlüsselbar ist und mit
// welchem Schlüssel — und gibt **kein** Passwort aus.

import Database from 'better-sqlite3';
import crypto from 'crypto';

const DB_PATH = process.env.DB_PATH || '/app/data/dashboard.db';
const APPLY = process.argv.includes('--apply');
const ALGO = 'aes-256-gcm';

// Dieselbe Reihenfolge wie in backend/src/services/mail.js.
const primaer = process.env.MAIL_CRYPT_KEY || process.env.JWT_SECRET;
if (!primaer) {
  console.error('Weder MAIL_CRYPT_KEY noch JWT_SECRET gesetzt — Abbruch.');
  process.exit(1);
}
const legacy = (process.env.MAIL_CRYPT_KEY_LEGACY || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const kandidaten = [primaer, ...legacy].filter((v, i, a) => a.indexOf(v) === i);

const kuerzel = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 8);
const abgeleitet = (s) => crypto.createHash('sha256').update(s).digest();

console.log(`Schlüssel in dieser Reihenfolge: ${kandidaten.map((k, i) => `${i === 0 ? 'aktuell' : 'legacy'}:${kuerzel(k)}`).join(', ')}`);

function entschluesseln(wert) {
  const [ivHex, tagHex, data] = String(wert).split(':');
  if (!ivHex || !tagHex || !data) return { fehler: 'Format passt nicht (erwartet iv:tag:daten)' };
  for (const k of kandidaten) {
    try {
      const d = crypto.createDecipheriv(ALGO, abgeleitet(k), Buffer.from(ivHex, 'hex'));
      d.setAuthTag(Buffer.from(tagHex, 'hex'));
      let klar = d.update(data, 'hex', 'utf8');
      klar += d.final('utf8');
      return { klar, schluessel: k };
    } catch { /* naechster Kandidat */ }
  }
  return { fehler: 'mit keinem der Schlüssel entschlüsselbar' };
}

function verschluesseln(klar) {
  const iv = crypto.randomBytes(16);
  const c = crypto.createCipheriv(ALGO, abgeleitet(primaer), iv);
  let enc = c.update(klar, 'utf8', 'hex');
  enc += c.final('hex');
  return `${iv.toString('hex')}:${c.getAuthTag().toString('hex')}:${enc}`;
}

const db = new Database(DB_PATH);
const tabellen = [
  { name: 'mail_accounts', id: 'id' },
  { name: 'mail_credentials', id: 'user_id' },
];

let gesamt = 0;
let schonAktuell = 0;
let umgeschluesselt = 0;
let gescheitert = 0;

for (const t of tabellen) {
  const da = db.prepare('SELECT name FROM sqlite_master WHERE type = ? AND name = ?').get('table', t.name);
  if (!da) { console.log(`\n${t.name}: Tabelle existiert nicht — übersprungen.`); continue; }

  const zeilen = db.prepare(`SELECT ${t.id} AS kennung, email, password_encrypted FROM ${t.name}`).all();
  console.log(`\n${t.name}: ${zeilen.length} Zeile(n)`);

  for (const z of zeilen) {
    gesamt++;
    if (!z.password_encrypted) { console.log(`  ${z.email}: kein Passwort gespeichert`); continue; }
    const e = entschluesseln(z.password_encrypted);
    if (e.fehler) {
      gescheitert++;
      console.log(`  ${z.email}: NICHT LESBAR — ${e.fehler}`);
      continue;
    }
    if (e.schluessel === primaer) {
      schonAktuell++;
      console.log(`  ${z.email}: schon mit dem aktuellen Schlüssel — nichts zu tun`);
      continue;
    }
    console.log(`  ${z.email}: lesbar mit legacy:${kuerzel(e.schluessel)} → wird auf aktuell:${kuerzel(primaer)} umgeschlüsselt`);
    if (APPLY) {
      db.prepare(`UPDATE ${t.name} SET password_encrypted = ? WHERE ${t.id} = ?`).run(verschluesseln(e.klar), z.kennung);
      umgeschluesselt++;
    }
  }
}

console.log(`\n${gesamt} Datensatz/Datensätze geprüft: ${schonAktuell} schon aktuell, ${APPLY ? umgeschluesselt : 0} umgeschlüsselt, ${gescheitert} nicht lesbar.`);
if (!APPLY) console.log('DRY-RUN — nichts geschrieben. Mit --apply ausführen.');
else if (umgeschluesselt > 0) console.log('Danach MAIL_CRYPT_KEY_LEGACY aus der .env entfernen und das Backend neu starten.');
