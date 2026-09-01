#!/usr/bin/env node
/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */

// Server in der Dashboard-Datenbank anlegen oder aktualisieren.
//
// Warum als Skript und nicht über die Oberfläche: Die Einstellungen-Seite kann
// Server anlegen, aber die Betriebs-Metadaten (Anbieter, Standort, Kosten,
// Tunnel-Name) und der Glances-Zugang mit Passwort in der URL sind nichts, was
// man beim Aufsetzen eines Servers per Hand abtippen will — und ein Tippfehler
// im Glances-Zugang zeigt sich erst als „Server offline".
//
// Läuft IM Backend-Container, weil better-sqlite3 dort liegt (nativ gebaut
// für den Pi, nicht auf dem Windows-Rechner installiert):
//
//   docker cp scripts/register-server.mjs homelab-backend:/app/register-server.mjs
//   docker exec -w /app homelab-backend node register-server.mjs \
//     --id amo-vps --name "AMO-VPS (Hast-IT)" --host 85.93.20.8 \
//     --glances-url 'https://dashboard:GEHEIM@mon-amo.mas0n1x.online' \
//     --ssh-host 85.93.20.8 --ssh-user root --ssh-key /app/ssh/id_ed25519 \
//     --provider Hast-IT --location "Nürnberg" --monthly-cost 1 \
//     --tunnel-name amo-vps --apply
//
// Ohne --apply ist es ein Dry-Run und zeigt nur, was sich ändern würde.
//
// ⚠️ Nach dem Schreiben das Backend neu starten (`docker restart
//    homelab-backend`). Der ServerManager baut seine Verbindungen beim Start
//    auf; ein neuer Server in der Datenbank allein bleibt sonst „disconnected".

import Database from 'better-sqlite3';

const DB_PATH = process.env.DB_PATH || '/app/data/dashboard.db';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');

function arg(name) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

const id = arg('id');
if (!id) {
  console.error('Pflicht: --id <server-id>. Weitere: --name --host --glances-url');
  console.error('  --ssh-host --ssh-port --ssh-user --ssh-key --docker-socket --docker-host');
  console.error('  --provider --location --monthly-cost --currency --expires-at --tunnel-name --notes');
  process.exit(1);
}

// Nur übergebene Felder werden angefasst. So kann man denselben Aufruf später
// mit einem einzigen geänderten Wert wiederholen, ohne den Rest zu verlieren.
const FELDER = {
  name: ['name', (v) => v],
  host: ['host', (v) => v],
  'glances-url': ['glances_url', (v) => v],
  'docker-socket': ['docker_socket', (v) => v],
  'docker-host': ['docker_host', (v) => v],
  'ssh-host': ['ssh_host', (v) => v],
  'ssh-port': ['ssh_port', (v) => Number(v)],
  'ssh-user': ['ssh_user', (v) => v],
  'ssh-key': ['ssh_key_path', (v) => v],
  provider: ['provider', (v) => v],
  location: ['location', (v) => v],
  'monthly-cost': ['monthly_cost', (v) => Number(v)],
  currency: ['currency', (v) => v],
  'expires-at': ['expires_at', (v) => v],
  'tunnel-name': ['tunnel_name', (v) => v],
  notes: ['notes', (v) => v],
};

const werte = {};
for (const [flag, [spalte, wandeln]] of Object.entries(FELDER)) {
  const roh = arg(flag);
  if (roh !== undefined) werte[spalte] = wandeln(roh);
}

const db = new Database(DB_PATH);
const vorhanden = db.prepare('SELECT * FROM servers WHERE id = ?').get(id);

// Passwörter stehen im Glances-Zugang mit in der URL. Sie gehören nicht in ein
// Terminal-Protokoll, das später in einem Chat landet.
const zeigen = (spalte, wert) =>
  spalte === 'glances_url' && typeof wert === 'string'
    ? wert.replace(/\/\/([^:]+):[^@]+@/, '//$1:***@')
    : wert;

if (vorhanden) {
  const geaendert = Object.entries(werte).filter(([s, w]) => vorhanden[s] !== w);
  if (!geaendert.length) {
    console.log(`Server "${id}" ist schon genau so eingetragen – nichts zu tun.`);
    process.exit(0);
  }
  console.log(`Server "${id}" aktualisieren:`);
  for (const [s, w] of geaendert) {
    console.log(`  ${s.padEnd(14)} ${zeigen(s, vorhanden[s])} → ${zeigen(s, w)}`);
  }
  if (!APPLY) {
    console.log('\nDRY-RUN – nichts geschrieben. Mit --apply ausführen.');
    process.exit(0);
  }
  const setzen = geaendert.map(([s]) => `${s} = ?`).join(', ');
  db.prepare(`UPDATE servers SET ${setzen}, updated_at = datetime('now') WHERE id = ?`)
    .run(...geaendert.map(([, w]) => w), id);
  console.log('\nAktualisiert.');
} else {
  if (!werte.name || !werte.host) {
    console.error('Neuer Server braucht mindestens --name und --host.');
    process.exit(1);
  }
  console.log(`Server "${id}" neu anlegen:`);
  for (const [s, w] of Object.entries(werte)) console.log(`  ${s.padEnd(14)} ${zeigen(s, w)}`);
  if (!APPLY) {
    console.log('\nDRY-RUN – nichts geschrieben. Mit --apply ausführen.');
    process.exit(0);
  }
  const spalten = ['id', 'is_local', ...Object.keys(werte)];
  const platzhalter = spalten.map(() => '?').join(', ');
  db.prepare(`INSERT INTO servers (${spalten.join(', ')}) VALUES (${platzhalter})`)
    .run(id, 0, ...Object.values(werte));
  console.log('\nAngelegt.');
}

console.log('Jetzt noch: docker restart homelab-backend');
