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

// Add a server
router.post('/', (req, res) => {
  try {
    const { name, host, glancesUrl, dockerSocket, dockerHost } = req.body;
    if (!name || !host) {
      return res.status(400).json({ error: 'Name and host are required' });
    }
    const server = serverManager.addServer({ name, host, glancesUrl, dockerSocket, dockerHost });
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
