/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import https from 'node:https';

// Proxmox-API von Cerberus. Erreichbar ueber den Reverse-SSH-Tunnel auf der
// Docker-Bridge (Standard https://172.20.0.1:18006), Zugang per API-Token des
// Proxmox-Benutzers dashboard@pve. Proxmox bringt ein selbst signiertes
// Zertifikat mit -> rejectUnauthorized:false, wie bei den anderen internen
// Pruefpfaden. Das Token verlaesst das Backend nie.
const BASIS = process.env.PROXMOX_URL || '';
const TOKEN_ID = process.env.PROXMOX_TOKEN_ID || '';
const TOKEN_SECRET = process.env.PROXMOX_TOKEN_SECRET || '';
const ZEITLIMIT_MS = 15000;

const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true, maxSockets: 6 });

export function istKonfiguriert() {
  return Boolean(BASIS && TOKEN_ID && TOKEN_SECRET);
}

export class ProxmoxFehler extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

/**
 * Ruft die Proxmox-API auf und gibt das `data`-Feld der Antwort zurueck.
 * `https.request` statt `fetch`, weil fetch das selbst signierte Zertifikat
 * ablehnt (siehe uptime.js).
 */
export function pve(methode, pfad, body) {
  if (!istKonfiguriert()) {
    return Promise.reject(new ProxmoxFehler('Proxmox nicht konfiguriert', 503));
  }
  const url = new URL(`/api2/json${pfad}`, BASIS);
  const nutzlast = body ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: methode,
      agent,
      headers: {
        Authorization: `PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}`,
        Accept: 'application/json',
        ...(nutzlast ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(nutzlast) } : {}),
      },
    }, (res) => {
      const teile = [];
      res.on('data', (t) => teile.push(t));
      res.on('end', () => {
        const text = Buffer.concat(teile).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch { /* kein JSON, z. B. Proxy-Fehlerseite */ }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          return resolve(json?.data ?? null);
        }
        const grund = json?.errors ? Object.values(json.errors).join(', ') : (res.statusMessage || 'Fehler');
        reject(new ProxmoxFehler(`Proxmox ${res.statusCode}: ${grund}`, res.statusCode === 401 || res.statusCode === 403 ? 502 : (res.statusCode >= 500 ? 502 : res.statusCode)));
      });
    });
    req.setTimeout(ZEITLIMIT_MS, () => req.destroy(new ProxmoxFehler('Proxmox antwortet nicht (Zeitlimit)', 504)));
    req.on('error', (e) => reject(e instanceof ProxmoxFehler ? e : new ProxmoxFehler(`Proxmox nicht erreichbar: ${e.message}`, 502)));
    if (nutzlast) req.write(nutzlast);
    req.end();
  });
}

// Speicher, den Glances nicht sieht: LVM-Thin-Pools und ZFS-Pools sind keine
// eingehaengten Dateisysteme (Cerberus: `local-lvm` mit ~144 GB fuer VM-Platten).
// Ohne diese Eintraege zeigt die Fleet-Karte nur die Root-Partition (~69 GB)
// statt der ~240 GB der SSD. Kurz gepuffert, weil der Alerting-Job alle 30 s
// und die Fleet-Seite jede Anfrage abfragen.
let speicherCache = { zeit: 0, werte: [] };
export async function blockSpeicher() {
  if (Date.now() - speicherCache.zeit < 20000) return speicherCache.werte;
  const ressourcen = await pve('GET', '/cluster/resources?type=storage');
  const werte = ressourcen
    .filter((s) => ['lvmthin', 'lvm', 'zfspool'].includes(s.plugintype) && s.maxdisk > 0)
    .map((s) => ({
      mountPoint: s.storage, device: `pve:${s.storage}`,
      total: s.maxdisk, used: s.disk || 0, free: s.maxdisk - (s.disk || 0),
      percent: ((s.disk || 0) / s.maxdisk) * 100,
    }));
  speicherCache = { zeit: Date.now(), werte };
  return werte;
}
