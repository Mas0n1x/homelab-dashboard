/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import './umgebung.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import ssh2 from 'ssh2';

const { initDatabase } = await import('../src/services/database.js');
const keys = await import('../src/services/sshHostKeys.js');
initDatabase();
const schluessel = () => ssh2.utils.parseKey(ssh2.utils.generateKeyPairSync('ed25519').private).getPublicSSH();

test('erster Schlüssel wird gemerkt, ein anderer gesperrt bis zur Annahme', () => {
  const a = schluessel(), b = schluessel();
  assert.equal(keys.pruefeHostSchluessel('h', 22, a), true);
  assert.equal(keys.pruefeHostSchluessel('h', 22, a), true);
  assert.equal(keys.pruefeHostSchluessel('h', 22, b), false);
  const { pending } = keys.listeHostSchluessel()[0];
  assert.equal(keys.nimmHostSchluesselAn('h', 22, 'SHA256:falsch'), false);
  assert.equal(keys.nimmHostSchluesselAn('h', 22, pending.fingerprint), true);
  assert.equal(keys.pruefeHostSchluessel('h', 22, b), true);
});
