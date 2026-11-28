/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import './umgebung.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';

const { initDatabase } = await import('../src/services/database.js');
const auth = await import('../src/services/auth.js');
const { verifyToken } = await import('../src/middleware/auth.js');
const db = initDatabase();
db.prepare("INSERT INTO users (id, username, password_hash) VALUES (1, 'admin', 'x')").run();
const user = { id: 1, username: 'admin' };
const setzeAblauf = (token, iso) => db.prepare('UPDATE refresh_tokens SET expires_at = ? WHERE sitzung = ?').run(iso, token);

test('ein vor einer Stunde abgelaufenes Token ist ungültig', () => {
  const token = auth.generateRefreshToken();
  const sid = auth.storeRefreshToken(1, token);
  assert.ok(auth.validateRefreshToken(token));
  setzeAblauf(sid, new Date(Date.now() - 3600_000).toISOString());
  assert.equal(auth.validateRefreshToken(token), null);
  auth.cleanupExpiredTokens();
  assert.equal(db.prepare('SELECT COUNT(*) n FROM refresh_tokens WHERE sitzung = ?').get(sid).n, 0);
});

test('Erneuern behält die Sitzung, abmelden macht auch das Zugriffs-Token ungültig', () => {
  const alt = auth.generateRefreshToken();
  const sid = auth.storeRefreshToken(1, alt, { geraet: 'Testbrowser' });
  auth.retireRefreshToken(alt);
  const neu = auth.generateRefreshToken();
  auth.storeRefreshToken(1, neu, { sitzung: sid });
  assert.equal(auth.listeSitzungen(1).filter(s => s.id === sid).length, 1);

  const zugriff = auth.generateAccessToken(user, sid);
  assert.equal(verifyToken(zugriff).sid, sid);
  assert.equal(auth.revokeRefreshToken(neu), sid);
  assert.equal(auth.validateRefreshToken(alt), null);
  assert.throws(() => verifyToken(zugriff), /Sitzung/);
});

test('alle anderen abmelden lässt nur das eigene Gerät', () => {
  const sids = [1, 2, 3].map(() => auth.storeRefreshToken(1, auth.generateRefreshToken()));
  const beendet = auth.beendeAndereSitzungen(1, sids[0]);
  assert.ok(beendet.includes(sids[1]) && beendet.includes(sids[2]));
  assert.deepEqual(auth.listeSitzungen(1).map(s => s.id), [sids[0]]);
});
