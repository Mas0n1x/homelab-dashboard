/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Muss vor jedem Import aus src/ geladen werden: eigene, leere Datenbank je Testdatei.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const ordner = mkdtempSync(join(tmpdir(), 'homelab-test-'));
process.env.DB_PATH = join(ordner, 'dashboard.db');
process.env.BACKUP_DIR = join(ordner, 'backups');
process.env.CONFIG_PATH = join(ordner, 'keine-config.json');
process.env.JWT_SECRET = 'nur-fuer-tests';
process.on('exit', () => rmSync(ordner, { recursive: true, force: true }));
