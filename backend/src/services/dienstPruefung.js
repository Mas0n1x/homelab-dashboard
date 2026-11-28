/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Erreichbarkeit eines Dienstes. Adressen auf dem eigenen Server werden durch die ohnehin
// offene SSH-Verbindung geprüft (kein zusätzlicher Login, keine offene Firewall nötig),
// alles andere direkt. Lässt sich ein Dienst gar nicht prüfen, heißt das Ergebnis
// „unbekannt“ — früher galt er dann als online, solange der Container lief.
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';

const ZEITLIMIT_MS = 8000;
const TUNNEL_ZEITLIMIT_MS = 6000;
// Gleichzeitige Weiterleitungen je Server — die Verbindung trägt auch die Docker-Abfragen.
const MAX_JE_SERVER = 6;

const istPrivat = (h) => h === 'localhost' || /^127\./.test(h) || /^192\.168\./.test(h) || /^10\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h);
const istSchleife = (h) => h === 'localhost' || h === '0.0.0.0' || /^127\./.test(h);
// IP-Adresse oder Name ohne Punkt: liegt im LAN oder Docker-Netz der Zielmaschine.
export const nurLokalErreichbar = (h) => net.isIP(h) !== 0 || !h.includes('.');

const portVon = (u) => (u.port ? parseInt(u.port, 10) : (u.protocol === 'https:' ? 443 : 80));

// rejectUnauthorized:false — interne Dienste haben selbst signierte Zertifikate.
function httpProbe(ziel) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(ziel); } catch { return resolve({ status: 0, grund: 'ungültig' }); }
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(ziel, {
      method: 'GET', timeout: ZEITLIMIT_MS, rejectUnauthorized: false,
      headers: { 'User-Agent': 'HomelabDashboard-Uptime/1.0', Range: 'bytes=0-0' },
    }, (res) => {
      res.destroy(); // Es zählt nur, dass geantwortet wurde
      resolve({ status: res.statusCode || 0 });
    });
    req.on('error', () => resolve({ status: 0, grund: 'fehler' }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, grund: 'stumm' }); });
    req.end();
  });
}

// Für Dienste, die kein HTTP sprechen (Mail-, Sync-, Spiel-Ports).
function tcpProbe(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const fertig = (v) => { socket.destroy(); resolve(v); };
    socket.setTimeout(ZEITLIMIT_MS);
    socket.once('connect', () => fertig(true));
    socket.once('timeout', () => fertig(false));
    socket.once('error', () => fertig(false));
    socket.connect(port, host);
  });
}

// HTTP über einen schon geöffneten Kanal. Bewusst von Hand: ssh2-Kanäle kennen weder
// setTimeout noch die übrigen Socket-Methoden, die das http-Modul voraussetzt.
function httpUeberKanal(u, kanal) {
  return new Promise((resolve) => {
    let strom = kanal;
    let erledigt = false;
    let puffer = '';
    const fertig = (v) => {
      if (erledigt) return;
      erledigt = true;
      clearTimeout(frist);
      try { strom.destroy(); } catch { /* schon zu */ }
      try { kanal.destroy(); } catch { /* schon zu */ }
      resolve(v);
    };
    const frist = setTimeout(() => fertig({ status: 0, grund: 'stumm' }), TUNNEL_ZEITLIMIT_MS);
    try {
      if (u.protocol === 'https:') {
        strom = tls.connect({ socket: kanal, rejectUnauthorized: false, ...(net.isIP(u.hostname) ? {} : { servername: u.hostname }) });
      }
      strom.on('data', (d) => {
        puffer += d.toString('latin1');
        if (puffer.length < 12) return;
        const treffer = /^HTTP\/\d(?:\.\d)? (\d{3})/.exec(puffer);
        fertig(treffer ? { status: Number(treffer[1]) } : { status: 0, grund: 'anderes-protokoll' });
      });
      strom.on('error', () => fertig({ status: 0, grund: 'fehler' }));
      strom.on('close', () => fertig({ status: 0, grund: 'geschlossen' }));
      strom.write(`GET ${u.pathname}${u.search} HTTP/1.1\r\nHost: ${u.host}\r\nUser-Agent: HomelabDashboard-Uptime/1.0\r\nRange: bytes=0-0\r\nConnection: close\r\n\r\n`);
    } catch {
      fertig({ status: 0, grund: 'fehler' });
    }
  });
}

const belegt = new Map(); // serverId -> { n, wartend }
async function mitPlatz(serverId, fn) {
  const s = belegt.get(serverId) || { n: 0, wartend: [] };
  belegt.set(serverId, s);
  if (s.n >= MAX_JE_SERVER) await new Promise((r) => s.wartend.push(r));
  else s.n++;
  try { return await fn(); }
  finally {
    const naechster = s.wartend.shift();
    if (naechster) naechster(); else s.n--;
  }
}

// Wer früher per HTTP geantwortet hat und jetzt schweigt, hängt. Bei allen anderen
// Ports (andere Protokolle) reicht eine angenommene Verbindung.
function bewerte(antwort, sprachHttp) {
  if (antwort.status > 0) return { zustand: antwort.status < 500 ? 'online' : 'offline', statusCode: antwort.status };
  if (antwort.grund === 'stumm' && sprachHttp) return { zustand: 'offline', statusCode: 0 };
  return { zustand: 'online', statusCode: 0 };
}

async function durchTunnel(u, serverId, weiterleiten, sprachHttp) {
  const ziele = ['127.0.0.1', ...(istSchleife(u.hostname) ? [] : [u.hostname])];
  for (const host of ziele) {
    let kanal;
    try {
      kanal = await weiterleiten(host, portVon(u), TUNNEL_ZEITLIMIT_MS);
    } catch (error) {
      // 2 = der Server konnte die Verbindung nicht aufbauen (Port zu)
      if (error.reason === 2) continue;
      return { zustand: 'unbekannt', statusCode: 0, grund: 'SSH-Weiterleitung nicht möglich' };
    }
    return bewerte(await httpUeberKanal(u, kanal), sprachHttp);
  }
  return { zustand: 'offline', statusCode: 0 };
}

/**
 * @param {string} url
 * @param {{ serverId: string, server?: object, weiterleiten?: Function, container?: object|null, sprachHttp?: boolean }} umfeld
 * @returns {Promise<{ zustand: 'online'|'offline'|'unbekannt', statusCode: number, grund?: string }>}
 */
export async function pruefeDienst(url, { serverId, server = {}, weiterleiten, container = null, sprachHttp = false }) {
  if (container?.state && container.state !== 'running') return { zustand: 'offline', statusCode: 0 };

  let u;
  try { u = new URL(url); } catch { return { zustand: 'offline', statusCode: 0 }; }

  const eigen = istSchleife(u.hostname) || u.hostname === server.host || u.hostname === server.ssh_host;
  if (eigen && weiterleiten) return mitPlatz(serverId, () => durchTunnel(u, serverId, weiterleiten, sprachHttp));

  // Läuft das Dashboard auf demselben Rechner (kein SSH), sind private Adressen nur
  // über das Host-Gateway erreichbar.
  if (serverId === 'local' && !server.ssh_host && istPrivat(u.hostname)) u.hostname = 'host.docker.internal';

  const antwort = await httpProbe(u.toString());
  if (antwort.status > 0) return bewerte(antwort, sprachHttp);
  if (await tcpProbe(u.hostname, portVon(u))) return bewerte(antwort, sprachHttp);
  if (nurLokalErreichbar(u.hostname)) return { zustand: 'unbekannt', statusCode: 0, grund: 'Adresse vom Dashboard aus nicht erreichbar' };
  return { zustand: 'offline', statusCode: 0 };
}
