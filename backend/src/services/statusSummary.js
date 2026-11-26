/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
// Kompakte Live-Übersicht aller Server (Specs + Auslastung + Online-Status),
// genutzt von der Oberfläche und vom Portfolio-Discord-Bot.
import serverManager from './serverManager.js';

export async function statusUebersicht() {
  const servers = serverManager.getAllServers();
  const summaries = await Promise.all(servers.map(async (server) => {
    const connection = serverManager.getConnection(server.id);
    const glances = connection?.glances || null;

    let systemStats = null;
    let cores = null;
    if (glances) {
      systemStats = await glances.getSystemStats().catch(() => null);
      if (systemStats && typeof glances.getCore === 'function') {
        const core = await glances.getCore().catch(() => null);
        cores = core?.log ?? core?.phys ?? null;
      }
    }

    const online = !!systemStats;
    const disks = systemStats?.disk || [];
    // Gesamtspeicher aller Platten (bei Cerberus: Root + VM-Pool), sonst zeigte die
    // Karte nur die 69-GB-Root-Partition der 240-GB-SSD. Bei einer einzelnen
    // Platte (alle anderen Server) ist das dasselbe wie vorher.
    const rootDisk = disks.length ? {
      total: disks.reduce((s, d) => s + (d.total || 0), 0),
      used: disks.reduce((s, d) => s + (d.used || 0), 0),
      percent: 0,
    } : null;
    if (rootDisk) rootDisk.percent = rootDisk.total ? (rootDisk.used / rootDisk.total) * 100 : 0;
    const temps = systemStats?.temperature || [];

    return {
      id: server.id,
      name: server.name || server.id,
      host: server.host || null,
      status: server.status,                 // connected | monitoring | disconnected
      online,
      cores,
      cpuPercent: online ? Math.round(systemStats.cpu?.total || 0) : null,
      memPercent: online ? Math.round(systemStats.memory?.percent || 0) : null,
      memTotal: online ? (systemStats.memory?.total || 0) : null,
      memUsed: online ? (systemStats.memory?.used || 0) : null,
      diskTotal: rootDisk ? rootDisk.total : null,
      diskUsed: rootDisk ? rootDisk.used : null,
      diskPercent: rootDisk ? Math.round(rootDisk.percent || 0) : null,
      maxTemp: temps.length ? Math.max(...temps.map(t => Number(t.value) || 0)) : null,
      uptime: systemStats?.uptime || null,
      lastSeen: connection?.lastSeen || null,
      // Diagnose: Zustand der SSH-Docker-Verbindung (verbunden, offene/wartende Kanäle, letzter Abbruch)
      ssh: connection?.sshAgent?.zustand?.() || null,
    };
  }));

  return { servers: summaries, timestamp: new Date().toISOString() };
}
