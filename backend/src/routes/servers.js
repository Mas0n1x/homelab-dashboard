/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';
import serverManager from '../services/serverManager.js';
import { statusUebersicht } from '../services/statusSummary.js';
import { listeHostSchluessel, nimmHostSchluesselAn } from '../services/sshHostKeys.js';

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

// Kompakte Live-Übersicht aller Server (siehe services/statusSummary.js)
router.get('/status-summary', async (req, res) => {
  try {
    res.json(await statusUebersicht());
  } catch (error) {
    res.status(500).json({ error: 'Failed to build status summary', message: error.message });
  }
});

// Gemerkte SSH-Hostschlüssel
router.get('/hostkeys', (req, res) => {
  try {
    res.json(listeHostSchluessel());
  } catch (error) {
    res.status(500).json({ error: 'SSH-Schlüssel konnten nicht geladen werden', message: error.message });
  }
});

// Geänderten Schlüssel annehmen — nur genau den, der angezeigt wurde
router.post('/hostkeys/accept', (req, res) => {
  try {
    const { host, port, fingerprint } = req.body;
    if (!host || !port || !fingerprint) return res.status(400).json({ error: 'host, port und fingerprint erforderlich' });
    if (!nimmHostSchluesselAn(host, Number(port), fingerprint, req.user.id)) {
      return res.status(409).json({ error: 'Der wartende Schlüssel hat sich inzwischen geändert' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Schlüssel konnte nicht angenommen werden', message: error.message });
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
