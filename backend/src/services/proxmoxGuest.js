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
// Eingetragen wird ein solcher Server mit glances_url = "proxmox://<vmid>".
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
    const [status, agentText] = await Promise.all([
      pve('GET', `/nodes/${node}/qemu/${vmid}/status/current`),
      agentAusgabe(node, vmid).catch(() => null), // Agent kurz weg: nur CPU/Netz/Laufzeit
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
    if (agentText) {
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
      uptime: laufzeit(status.uptime || 0),
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
