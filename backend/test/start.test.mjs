/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Startet das echte Backend und ruft die Schnittstellen auf.
import { ordner } from './umgebung.mjs';
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const PORT = 39000 + (process.pid % 1000);
const B = `http://127.0.0.1:${PORT}/api`;
let prozess;
let ausgabe = '';

before(async () => {
  const { initDatabase } = await import('../src/services/database.js');
  const { hashPassword } = await import('../src/services/auth.js');
  const db = initDatabase();
  db.prepare("INSERT INTO users (username, password_hash) VALUES ('admin', ?)").run(await hashPassword('test-passwort-123'));
  db.close();
  prozess = spawn(process.execPath, [fileURLToPath(new URL('../src/index.js', import.meta.url))], {
    env: { ...process.env, PORT: String(PORT), DB_PATH: join(ordner, 'dashboard.db') },
  });
  prozess.stdout.on('data', (d) => { ausgabe += d; });
  prozess.stderr.on('data', (d) => { ausgabe += d; });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${B}/health`)).ok) return; } catch { /* startet noch */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Backend startet nicht:\n${ausgabe}`);
});
after(() => prozess?.kill('SIGKILL'));

test('Anmeldung, Geräteliste und neue Einstellungen', async () => {
  const kopf = { 'Content-Type': 'application/json', 'X-HD-Auth': '1' };
  const login = await fetch(`${B}/auth/login`, { method: 'POST', headers: kopf, body: JSON.stringify({ username: 'admin', password: 'test-passwort-123' }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const { accessToken, refreshToken } = await login.json();
  assert.equal(refreshToken, undefined);
  const auth = { ...kopf, Authorization: `Bearer ${accessToken}` };
  const hole = async (pfad, init) => {
    const r = await fetch(`${B}${pfad}`, { headers: auth, ...init });
    assert.equal(r.status, 200, `${pfad}: ${r.status}`);
    return r.json();
  };

  const sitzungen = await hole('/auth/sessions');
  assert.equal(sitzungen.filter((s) => s.aktuell).length, 1);
  assert.equal((await hole('/alerts/delivery')).digestAt, '08:00');
  assert.equal((await hole('/alerts/delivery', { method: 'PUT', body: JSON.stringify({ digestAt: '09:15' }) })).digestAt, '09:15');
  assert.equal((await hole('/docker/cleanup/schedule')).enabled, true);
  assert.equal((await hole('/docker/cleanup/schedule', { method: 'PUT', body: JSON.stringify({ enabled: false }) })).enabled, false);
  assert.equal((await hole('/status/board?days=90')).summary.unknown, 0);
  assert.deepEqual(await hole('/servers/hostkeys'), []);

  const abmelden = await fetch(`${B}/auth/logout`, { method: 'POST', headers: { ...kopf, Cookie: cookie }, body: '{}' });
  assert.equal(abmelden.status, 200);
  assert.equal((await fetch(`${B}/auth/sessions`, { headers: auth })).status, 401);
});
