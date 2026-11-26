/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Läuft als Worker: integrity_check über hunderte MB würde sonst den ganzen
// Server anhalten.
import { parentPort, workerData } from 'node:worker_threads';
import Database from 'better-sqlite3';

try {
  const berichte = workerData.dateien.map(({ pfad, name, pflicht }) => {
    const db = new Database(pfad);
    try {
      const pruefung = db.pragma('integrity_check', { simple: true });
      if (pruefung !== 'ok') throw new Error(`${name}: beschädigt (${pruefung})`);
      const tabellen = db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type = 'table'").get().n;
      if (!tabellen) throw new Error(`${name}: enthält keine Tabellen`);
      // Eine leere, aber gültige Datei darf nicht als brauchbare Sicherung gelten.
      for (const tabelle of pflicht || []) {
        const n = db.prepare(`SELECT COUNT(*) n FROM ${tabelle}`).get().n;
        if (!n) throw new Error(`${name}: Tabelle ${tabelle} ist leer`);
      }
      return `${name}: ${tabellen} Tabellen`;
    } finally {
      db.close();
    }
  });
  parentPort.postMessage({ ok: true, detail: berichte.join(' · ') });
} catch (error) {
  parentPort.postMessage({ ok: false, detail: error.message });
}
