/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Messwerte für eine Proxmox-VM, in der kein Glances läuft (TrueNas). Liefert dieselbe Form wie
// der Glances-Client, damit Fleet-Karte, Alarme und Verlauf nichts Besonderes kennen müssen.
//
// Quellen:
//  - Proxmox-API (status/current): CPU, Laufzeit, Netzwerk-Zähler
//  - QEMU-Gast-Agent (agent/exec, ein Aufruf): /proc/meminfo, ZFS-ARC und `zpool list`
//
// RAM: TrueNas füllt den Arbeitsspeicher absichtlich mit dem ZFS-Lesecache (ARC). Proxmox und
// /proc/meminfo zählen den als „belegt" — die Karte stünde dauerhaft bei 100 %. Als genutzt gilt
// deshalb: gesamt − verfügbar − freigebbarer ARC (Größe − Minimum).
//
// TrueNAS-REST statt Gast-Agent: TrueNAS bringt den QEMU-Gast-Agent nicht mit. Sind TRUENAS_URL und
// TRUENAS_API_KEY gesetzt (und ist es die VM TRUENAS_VMID, Standard 102), kommen RAM, Pools und
// Laufzeit von dort (`/system/info`, `/pool`, `/boot/get_state`, `reporting/netdata_get_data`).
//
// Eingetragen wird ein solcher Server mit glances_url = "proxmox://<vmid>".
import https from 'node:https';
import { pve, istKonfiguriert } from './proxmox.js';

const CACHE_MS = 5000;
const AGENT_WARTEN_MS = 6000;

const SKRIPT = [
  'export PATH=/usr/sbin:/usr/bin:/sbin:/bin',
  'cat /proc/meminfo',
  'echo "@@ARC"',
  "grep -E '^(size|c_min) ' /proc/spl/kstat/zfs/arcstats",
  'echo "@@POOL"',
  'zpool list -Hp -o name,size,allocated,free 2>/dev/null',
].join('; ');

function kib(text, name) {
  const m = new RegExp(`^${name}:\\s+(\\d+) kB`, 'm').exec(text);
  return m ? Number(m[1]) * 1024 : 0;
}

function laufzeit(sekunden) {
  const s = Math.max(0, Math.floor(sekunden));
  const t = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return t > 0 ? `${t} day${t === 1 ? '' : 's'}, ${rest}` : rest;
}

// Eigene Zertifikate (TrueNAS-Web-UI) sind selbstsigniert; fetch kann das nicht abschalten.
function truenasAnfrage(basis, key, pfad, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(`/api/v2.0${pfad}`, basis);
    const daten = body ? JSON.stringify(body) : null;
    const req = https.request(url, {
      method: body ? 'POST' : 'GET',
      rejectUnauthorized: false,
      timeout: 8000,
      headers: { Authorization: `Bearer ${key}`, ...(daten ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(daten) } : {}) },
    }, (res) => {
      let text = '';
      res.on('data', (c) => { text += c; });
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`TrueNAS ${pfad}: HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(text)); } catch { reject(new Error(`TrueNAS ${pfad}: ungültige Antwort`)); }
      });
    });
    req.on('timeout', () => req.destroy(new Error(`TrueNAS ${pfad}: Zeitlimit`)));
    req.on('error', reject);
    if (daten) req.write(daten);
    req.end();
  });
}

export async function truenasMessung(basis, key) {
  const jetzt = Math.floor(Date.now() / 1000);
  const [info, pools, boot, berichte] = await Promise.all([
    truenasAnfrage(basis, key, '/system/info'),
    truenasAnfrage(basis, key, '/pool'),
    truenasAnfrage(basis, key, '/boot/get_state'),
    truenasAnfrage(basis, key, '/reporting/netdata_get_data', {
      graphs: [{ name: 'memory' }, { name: 'arcsize' }],
      query: { start: jetzt - 180, end: jetzt, aggregate: true },
    }),
  ]);
  const mittel = (name, feld) => berichte.find((g) => g.name === name)?.aggregations?.mean?.[feld] ?? 0;
  const total = info.physmem || 0;
  const verfuegbar = mittel('memory', 'available');
  // Wie beim Agenten: der ZFS-Lesecache (ARC) gibt bei Druck nach und zählt nicht als belegt.
  const arc = mittel('arcsize', 'size');
  const used = Math.max(0, total - verfuegbar - arc);
  const disk = [];
  for (const p of pools) {
    if (!p.size) continue;
    disk.push({ mountPoint: `/mnt/${p.name}`, device: `zfs:${p.name}`, total: p.size, used: p.allocated, free: p.free, percent: (p.allocated / p.size) * 100 });
  }
  if (boot?.size) {
    disk.push({ mountPoint: '/ (boot-pool)', device: 'zfs:boot-pool', total: boot.size, used: boot.allocated, free: boot.free, percent: (boot.allocated / boot.size) * 100 });
  }
  disk.sort((a, b) => b.total - a.total);
  return {
    memory: { total, used, free: Math.max(0, total - used), percent: total ? (used / total) * 100 : 0, arc },
    disk,
    uptimeSek: info.uptime_seconds || 0,
  };
}

async function agentAusgabe(node, vmid) {
  const start = await pve('POST', `/nodes/${node}/qemu/${vmid}/agent/exec`, { command: ['sh', '-c', SKRIPT] });
  const ende = Date.now() + AGENT_WARTEN_MS;
  while (Date.now() < ende) {
    await new Promise((r) => setTimeout(r, 250));
    const st = await pve('GET', `/nodes/${node}/qemu/${vmid}/agent/exec-status?pid=${start.pid}`);
    if (st.exited) return String(st['out-data'] || '');
  }
  throw new Error('Gast-Agent antwortet nicht');
}

export function createProxmoxGuestClient(vmid) {
  let cache = { zeit: 0, versprechen: null };
  let node = null;
  let vorher = null; // { zeit, netin, netout } für die Datenraten

  async function messen() {
    if (!istKonfiguriert()) throw new Error('Proxmox nicht konfiguriert');
    if (!node) {
      const knoten = await pve('GET', '/cluster/resources?type=node');
      node = knoten[0]?.node;
      if (!node) throw new Error('Kein Proxmox-Node gefunden');
    }
    const truenas = process.env.TRUENAS_URL && process.env.TRUENAS_API_KEY
      && vmid === Number(process.env.TRUENAS_VMID || 102);
    const [status, agentText, tn] = await Promise.all([
      pve('GET', `/nodes/${node}/qemu/${vmid}/status/current`),
      truenas ? null : agentAusgabe(node, vmid).catch(() => null), // Agent kurz weg: nur CPU/Netz/Laufzeit
      truenas ? truenasMessung(process.env.TRUENAS_URL, process.env.TRUENAS_API_KEY).catch((e) => { console.warn(`[proxmoxGuest] ${e.message}`); return null; }) : null,
    ]);
    if (status.status !== 'running') throw new Error(`VM ${vmid} läuft nicht`);

    const fehlend = [];
    const jetzt = Date.now();

    // Netzwerk: Proxmox liefert Zähler, Rate = Differenz zum letzten Abruf
    let rxRate = 0, txRate = 0;
    if (vorher && jetzt > vorher.zeit && status.netin >= vorher.netin) {
      const dt = (jetzt - vorher.zeit) / 1000;
      rxRate = (status.netin - vorher.netin) / dt;
      txRate = Math.max(0, status.netout - vorher.netout) / dt;
    }
    vorher = { zeit: jetzt, netin: status.netin || 0, netout: status.netout || 0 };

    // Speicher und Pools aus dem Gast
    let memory, disk = [];
    if (tn) {
      ({ memory, disk } = tn);
    } else if (agentText) {
      const [meminfo, rest = ''] = agentText.split('@@ARC');
      const [arcText, poolText = ''] = rest.split('@@POOL');
      const total = kib(meminfo, 'MemTotal');
      const verfuegbar = kib(meminfo, 'MemAvailable');
      const arcGroesse = Number(/^size\s+\d+\s+(\d+)/m.exec(arcText)?.[1] || 0);
      const arcMin = Number(/^c_min\s+\d+\s+(\d+)/m.exec(arcText)?.[1] || 0);
      const freigebbar = Math.max(0, arcGroesse - arcMin);
      const used = Math.max(0, total - verfuegbar - freigebbar);
      memory = {
        total, used, free: Math.max(0, total - used), percent: total ? (used / total) * 100 : 0,
        arc: arcGroesse, // Zur Anzeige/Fehlersuche: so viel Lesecache hält ZFS gerade
      };
      for (const zeile of poolText.trim().split('\n')) {
        const [name, size, alloc, free] = zeile.trim().split(/\s+/);
        if (!name || !Number(size)) continue;
        disk.push({
          mountPoint: name === 'boot-pool' ? '/ (boot-pool)' : `/mnt/${name}`,
          device: `zfs:${name}`, total: Number(size), used: Number(alloc), free: Number(free),
          percent: (Number(alloc) / Number(size)) * 100,
        });
      }
      disk.sort((a, b) => b.total - a.total);
    } else {
      fehlend.push('mem', 'fs');
      memory = { total: status.maxmem || 0, used: 0, free: status.maxmem || 0, percent: 0 };
    }

    const cpu = (status.cpu || 0) * 100;
    return {
      fehlend,
      cpu: { total: cpu, user: cpu, system: 0, idle: 100 - cpu },
      memory,
      disk,
      network: [{ interface: 'virtio', rxBytes: status.netin || 0, txBytes: status.netout || 0, rxRate, txRate }],
      temperature: [],
      // Laufzeit des Gastes (TrueNAS-API) statt der QEMU-Prozess-Laufzeit, die einen Neustart im Gast nicht sieht
      uptime: laufzeit(tn?.uptimeSek ?? (status.uptime || 0)),
    };
  }

  return {
    getSystemStats() {
      const jetzt = Date.now();
      if (cache.versprechen && jetzt - cache.zeit < CACHE_MS) return cache.versprechen;
      const versprechen = messen();
      cache = { zeit: jetzt, versprechen };
      versprechen.catch(() => { if (cache.versprechen === versprechen) cache = { zeit: 0, versprechen: null }; });
      return versprechen;
    },
    // Einzelabrufe gibt es für Gäste ohne Glances nicht; die Aufrufer fangen den Fehler ab.
    getCpu: () => Promise.reject(new Error('nicht verfügbar')),
    getMemory: () => Promise.reject(new Error('nicht verfügbar')),
    getDisk: () => Promise.reject(new Error('nicht verfügbar')),
    getNetwork: () => Promise.reject(new Error('nicht verfügbar')),
    getSensors: () => Promise.resolve([]),
    getCore: () => Promise.reject(new Error('nicht verfügbar')),
    async getKvmRss() { return 0; },
  };
}
