import { Router } from 'express';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

const router = Router();
const CONFIG_PATH = process.env.CONFIG_PATH || '/app/data/config.json';

async function loadConfig() {
  try {
    if (existsSync(CONFIG_PATH)) {
      const data = await readFile(CONFIG_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading config:', error.message);
  }
  return { services: [] };
}

async function saveConfig(config) {
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

// Get all services
router.get('/', async (req, res) => {
  try {
    const config = await loadConfig();
    res.json(config.services || []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load services', message: error.message });
  }
});

// Add a new service
router.post('/', async (req, res) => {
  try {
    const { name, url, icon, description } = req.body;

    if (!name || !url) {
      return res.status(400).json({ error: 'Name and URL are required' });
    }

    const config = await loadConfig();
    const newService = {
      id: Date.now().toString(),
      name,
      url,
      icon: icon || 'link',
      description: description || ''
    };

    config.services = config.services || [];
    config.services.push(newService);
    await saveConfig(config);

    res.status(201).json(newService);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add service', message: error.message });
  }
});

// Update a service
router.put('/:id', async (req, res) => {
  try {
    const { name, url, icon, description } = req.body;
    const config = await loadConfig();

    const index = config.services.findIndex(s => s.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Service not found' });
    }

    config.services[index] = {
      ...config.services[index],
      name: name || config.services[index].name,
      url: url || config.services[index].url,
      icon: icon || config.services[index].icon,
      description: description !== undefined ? description : config.services[index].description
    };

    await saveConfig(config);
    res.json(config.services[index]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update service', message: error.message });
  }
});

// Delete a service
router.delete('/:id', async (req, res) => {
  try {
    const config = await loadConfig();
    const index = config.services.findIndex(s => s.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'Service not found' });
    }

    config.services.splice(index, 1);
    await saveConfig(config);

    res.json({ success: true, message: 'Service deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete service', message: error.message });
  }
});

// Check service status
router.get('/:id/status', async (req, res) => {
  try {
    const config = await loadConfig();
    const service = config.services.find(s => s.id === req.params.id);

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(service.url, {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeout);
      res.json({ online: response.ok, status: response.status });
    } catch {
      res.json({ online: false, status: 0 });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to check service status', message: error.message });
  }
});

export default router;
