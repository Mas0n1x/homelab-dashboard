/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';
import serverManager from '../services/serverManager.js';

const router = Router();

// Get all servers
router.get('/', (req, res) => {
  try {
    const servers = serverManager.getAllServers();
    res.json(servers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch servers', message: error.message });
  }
});

// Kompakte Live-Übersicht aller Server (Specs + Auslastung + Online-Status)
// für externe Anzeigen wie den Portfolio-Discord-Bot.
router.get('/status-summary', async (req, res) => {
  try {
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
      const rootDisk = disks.find(d => d.mountPoint === '/') || disks[0] || null;
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
      };
    }));

    res.json({ servers: summaries, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to build status summary', message: error.message });
  }
});

// Add a server
router.post('/', (req, res) => {
  try {
    const { name, host, glancesUrl, dockerSocket, dockerHost, sshHost, sshPort, sshUser, sshKeyPath } = req.body;
    if (!name || !host) {
      return res.status(400).json({ error: 'Name and host are required' });
    }
    const server = serverManager.addServer({ name, host, glancesUrl, dockerSocket, dockerHost, sshHost, sshPort, sshUser, sshKeyPath });
    res.status(201).json(server);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add server', message: error.message });
  }
});

// Update a server
router.put('/:id', (req, res) => {
  try {
    const server = serverManager.updateServer(req.params.id, req.body);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }
    res.json(server);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update server', message: error.message });
  }
});

// Delete a server
router.delete('/:id', (req, res) => {
  try {
    serverManager.removeServer(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete server', message: error.message });
  }
});

export default router;
