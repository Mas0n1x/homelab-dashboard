/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Prüfung durch eine echte SSH-Verbindung gegen einen lokalen SSH-Server.
import './umgebung.mjs';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import http from 'node:http';
import ssh2 from 'ssh2';

const { pruefeDienst } = await import('../src/services/dienstPruefung.js');
const { createSshDockerAgent } = await import('../src/services/sshDockerAgent.js');

const lausche = (server) => new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port)));
const offen = [];
const starte = async (server) => { offen.push(server); return lausche(server); };

const webOk = await starte(http.createServer((q, a) => a.end('ok')));
const webKaputt = await starte(http.createServer((q, a) => { a.statusCode = 503; a.end(); }));
const sockets = new Set();
const roh = (fn) => net.createServer((s) => { sockets.add(s); s.on('error', () => {}); fn(s); });
const banner = await starte(roh((s) => s.end('220 mail.example ESMTP ready\r\n')));
const stumm = await starte(roh(() => {}));
const zu = await (async () => { const s = net.createServer(); const p = await lausche(s); s.close(); return p; })();

// SSH-Server, der nur TCP-Weiterleitungen kann
const sshServer = new ssh2.Server({ hostKeys: [ssh2.utils.generateKeyPairSync('ed25519').private] }, (client) => {
  client.on('error', () => {});
  client.on('authentication', (a) => a.accept());
  client.on('tcpip', (accept, reject, info) => {
    const ziel = net.connect(info.destPort, info.destIP);
    ziel.once('connect', () => { const k = accept(); k.pipe(ziel).pipe(k); k.on('error', () => {}); });
    ziel.once('error', () => reject(2));
  });
});
const sshPort = await lausche(sshServer);
const agent = createSshDockerAgent({ host: '127.0.0.1', port: sshPort, username: 'x', password: 'x' }, 'test');

// Ohne 'tcpip'-Handler lehnt der Server wie „AllowTcpForwarding no“ ab.
const sshOhne = new ssh2.Server({ hostKeys: [ssh2.utils.generateKeyPairSync('ed25519').private] }, (client) => {
  client.on('error', () => {});
  client.on('authentication', (a) => a.accept());
});
const agentOhne = createSshDockerAgent({ host: '127.0.0.1', port: await lausche(sshOhne), username: 'x', password: 'x' }, 'ohne');

after(() => {
  agent.close();
  agentOhne.close();
  sshServer.close();
  sshOhne.close();
  sockets.forEach((s) => s.destroy());
  offen.forEach((s) => { s.closeAllConnections?.(); s.close(); });
});

const umfeld = { serverId: 's', server: { host: '203.0.113.5', ssh_host: '203.0.113.5' }, weiterleiten: agent.weiterleiten };
const pruefe = (port, extra = {}) => pruefeDienst(`http://203.0.113.5:${port}`, { ...umfeld, ...extra });

test('eigener Server: Antwort zählt, nicht der Container', async () => {
  assert.equal((await pruefe(webOk)).zustand, 'online');
  const kaputt = await pruefe(webKaputt, { container: { state: 'running' } });
  assert.deepEqual([kaputt.zustand, kaputt.statusCode], ['offline', 503]);
});

test('geschlossener Port ist offline, auch wenn der Container läuft', async () => {
  // Zweitziel 203.0.113.5 ist eine Testadresse ohne Gegenstelle; der SSH-Server lehnt ab.
  const r = await pruefeDienst(`http://127.0.0.1:${zu}`, { ...umfeld, container: { state: 'running' } });
  assert.equal(r.zustand, 'offline');
});

test('anderes Protokoll gilt als online, ein verstummter Webdienst nicht', async () => {
  assert.equal((await pruefeDienst(`http://127.0.0.1:${banner}`, umfeld)).zustand, 'online');
  assert.equal((await pruefeDienst(`http://127.0.0.1:${stumm}`, umfeld)).zustand, 'online');
  assert.equal((await pruefeDienst(`http://127.0.0.1:${stumm}`, { ...umfeld, sprachHttp: true })).zustand, 'offline');
});

test('verbotene Weiterleitung ergibt unbekannt', async () => {
  const r = await pruefeDienst(`http://127.0.0.1:${webOk}`, { ...umfeld, weiterleiten: agentOhne.weiterleiten });
  assert.equal(r.zustand, 'unbekannt');
});

test('gestoppter Container ist offline ohne Netzzugriff', async () => {
  assert.equal((await pruefe(webOk, { container: { state: 'exited' } })).zustand, 'offline');
});
