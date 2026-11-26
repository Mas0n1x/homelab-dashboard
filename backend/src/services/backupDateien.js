/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Dateinamen der Sicherungen: Hauptdatei plus Begleiter für die Bot-Datenbanken.
//   dashboard-<Zeit>.db        dashboard-<Zeit>.bot-bots.db
//   full-backup-<Zeit>.tar.gz  full-backup-<Zeit>.bot-salenet.db
import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

export const stamm = (pfad) => pfad.replace(/(\.tar\.gz|\.db)$/, '');

export function begleiter(pfad) {
  const ordner = dirname(pfad);
  const anfang = `${basename(stamm(pfad))}.bot-`;
  if (!existsSync(ordner)) return [];
  return readdirSync(ordner).filter((n) => n.startsWith(anfang) && n.endsWith('.db')).map((n) => join(ordner, n));
}

export function loescheSicherung(pfad) {
  if (!pfad) return;
  for (const datei of [pfad, `${pfad}-wal`, `${pfad}-shm`, ...begleiter(pfad)]) {
    try { unlinkSync(datei); } catch { /* gibt es nicht */ }
  }
}

const MUSTER = /^(dashboard|full-backup)-(\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d-\d{3}Z)(\.bot-[a-z]+)?\.(db|tar\.gz)$/;

/**
 * Welche Dateien am Off-Site-Ziel sind abgelaufen? Entschieden wird allein nach
 * Namen und Alter am Ziel — nicht danach, was die lokale Datenbank noch kennt.
 * Sonst räumte eine frisch aufgesetzte Datenbank das ganze Ziel leer.
 * Fremde Dateien werden nie angefasst, die jüngste Sicherung je Art bleibt.
 */
export function veralteteDateien(namen, { retentionDays = 0, max = 10, jetzt = Date.now() } = {}) {
  const arten = new Map(); // Art -> Zeitstempel -> Dateien
  for (const name of namen) {
    const m = MUSTER.exec(name);
    if (!m) continue;
    const [, art, zeit] = m;
    if (!arten.has(art)) arten.set(art, new Map());
    const laeufe = arten.get(art);
    if (!laeufe.has(zeit)) laeufe.set(zeit, []);
    laeufe.get(zeit).push(name);
  }
  const weg = [];
  for (const laeufe of arten.values()) {
    [...laeufe.keys()].sort().reverse().forEach((zeit, i) => {
      if (i === 0) return;
      const ts = Date.parse(zeit.replace(/T(\d\d)-(\d\d)-(\d\d)-(\d{3})Z/, 'T$1:$2:$3.$4Z'));
      if (i >= max || (retentionDays > 0 && jetzt - ts > retentionDays * 86400000)) weg.push(...laeufe.get(zeit));
    });
  }
  return weg;
}
