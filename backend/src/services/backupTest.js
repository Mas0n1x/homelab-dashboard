/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Restore-Test: das Backup so auspacken wie bei einer Wiederherstellung und
// jede Datenbank darin öffnen und prüfen. Die Sicherung selbst bleibt unberührt.
import { execFile } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { Worker } from 'node:worker_threads';
import { getDb } from './database.js';
import { begleiter } from './backupDateien.js';

const execFileAsync = promisify(execFile);
let kette = Promise.resolve(); // immer nur ein Test gleichzeitig

function imWorker(dateien) {
  return new Promise((resolve_, reject) => {
    const worker = new Worker(new URL('./pruefWorker.js', import.meta.url), { workerData: { dateien } });
    worker.once('message', resolve_);
    worker.once('error', reject);
    worker.once('exit', (code) => { if (code !== 0) reject(new Error(`Prüfprozess beendet (${code})`)); });
  });
}

async function teste(backup) {
  if (!backup.path || !existsSync(backup.path)) return { ok: false, detail: 'Backup-Datei fehlt' };
  const ablage = mkdtempSync(join(tmpdir(), 'restoretest-'));
  try {
    const dbName = basename(resolve(process.env.DB_PATH || '/app/data/dashboard.db'));
    const haupt = join(ablage, dbName);
    if (backup.type === 'database') copyFileSync(backup.path, haupt);
    else await execFileAsync('tar', ['-xzf', backup.path, '-C', ablage], { timeout: 300000 });
    if (!existsSync(haupt)) return { ok: false, detail: 'Backup enthält keine Datenbank' };

    const dateien = [{ pfad: haupt, name: 'Dashboard', pflicht: ['users', 'servers'] }];
    for (const pfad of begleiter(backup.path)) {
      const kopie = join(ablage, `pruef-${basename(pfad)}`);
      copyFileSync(pfad, kopie);
      dateien.push({ pfad: kopie, name: `Bot ${/\.bot-([a-z]+)\.db$/.exec(pfad)[1]}` });
    }
    return await imWorker(dateien);
  } catch (error) {
    return { ok: false, detail: error.message };
  } finally {
    rmSync(ablage, { recursive: true, force: true });
  }
}

export function testeBackup(id) {
  const lauf = kette.then(async () => {
    const db = getDb();
    const backup = db.prepare('SELECT * FROM backups WHERE id = ?').get(id);
    if (!backup) throw new Error('Backup nicht gefunden');
    if (backup.status !== 'completed') throw new Error('Backup ist nicht abgeschlossen');
    const ergebnis = await teste(backup);
    db.prepare("UPDATE backups SET tested_at = datetime('now'), test_ok = ?, test_detail = ? WHERE id = ?")
      .run(ergebnis.ok ? 1 : 0, ergebnis.detail, id);
    return ergebnis;
  });
  kette = lauf.catch(() => {});
  return lauf;
}
