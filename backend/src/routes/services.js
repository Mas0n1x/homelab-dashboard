import { Router } from 'express';
import { getDb } from '../services/database.js';
import { discoverServices } from '../services/discovery.js';
import { getUptimeSummary } from '../services/uptime.js';
import { logAudit } from '../services/audit.js';

const router = Router();

// Get all services (discovered + manual, merged with overrides)
router.get('/', async (req, res) => {
  try {
    const serverId = req.query.serverId || 'local';
    const db = getDb();

    // Get auto-discovered services
    const discovered = await discoverServices(serverId);

    // Get manual services
    const manual = db.prepare(
      'SELECT * FROM manual_services WHERE server_id = ? ORDER BY sort_order ASC'
    ).all(serverId);

    // Get overrides
    const overrides = db.prepare(
      'SELECT * FROM service_overrides WHERE server_id = ?'
    ).all(serverId);

    const overrideMap = new Map(overrides.map(o => [o.service_id, o]));

    // Get uptime data
    const uptimeSummary = getUptimeSummary(serverId);

    // Apply overrides to discovered services
    const mergedDiscovered = discovered
      .map(s => {
        const override = overrideMap.get(s.id);
        if (override?.hidden) return null;
        return {
          ...s,
          name: override?.name || s.name,
          icon: override?.icon || s.icon,
          url: override?.url || s.url,
          description: override?.description || s.description,
          category: override?.category || s.category,
          order: override?.sort_order ?? s.order,
          uptime: uptimeSummary[s.id] || null
        };
      })
      .filter(Boolean);

    // Add uptime to manual services
    const mergedManual = manual.map(s => ({
      ...s,
      source: 'manual',
      serverId,
      order: s.sort_order,
      uptime: uptimeSummary[s.id] || null
    }));

    // Combine and sort
    const all = [...mergedDiscovered, ...mergedManual].sort((a, b) => (a.order || 999) - (b.order || 999));

    res.json({
      services: all,
      discovered: mergedDiscovered,
      manual: mergedManual
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load services', message: error.message });
  }
});

// Add a manual service
router.post('/', (req, res) => {
  try {
    const { name, url, icon, description, category, sortOrder } = req.body;
    const serverId = req.body.serverId || 'local';

    if (!name || !url) {
      return res.status(400).json({ error: 'Name and URL are required' });
    }

    const db = getDb();
    const id = `manual-${Date.now()}`;

    db.prepare(
      'INSERT INTO manual_services (id, server_id, name, url, icon, description, category, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, serverId, name, url, icon || 'link', description || '', category || 'Extern', sortOrder || 999);

    const service = db.prepare('SELECT * FROM manual_services WHERE id = ?').get(id);
    logAudit('service.add', name, { url }, req.user?.id);
    res.status(201).json(service);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add service', message: error.message });
  }
});

// Update a manual service
router.put('/:id', (req, res) => {
  try {
    const { name, url, icon, description, category, sortOrder } = req.body;
    const db = getDb();

    const existing = db.prepare('SELECT * FROM manual_services WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Service not found' });
    }

    db.prepare(
      'UPDATE manual_services SET name = ?, url = ?, icon = ?, description = ?, category = ?, sort_order = ? WHERE id = ?'
    ).run(
      name || existing.name,
      url || existing.url,
      icon || existing.icon,
      description !== undefined ? description : existing.description,
      category || existing.category,
      sortOrder ?? existing.sort_order,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM manual_services WHERE id = ?').get(req.params.id);
    logAudit('service.update', req.params.id, { name, url }, req.user?.id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update service', message: error.message });
  }
});

// Delete a manual service
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare('DELETE FROM manual_services WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    logAudit('service.delete', req.params.id, null, req.user?.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete service', message: error.message });
  }
});

// Override a discovered service
router.put('/override/:serviceId', (req, res) => {
  try {
    const { name, icon, url, description, category, sortOrder, hidden } = req.body;
    const serverId = req.body.serverId || 'local';
    const db = getDb();

    db.prepare(`
      INSERT INTO service_overrides (service_id, server_id, name, icon, url, description, category, sort_order, hidden)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(service_id, server_id) DO UPDATE SET
        name = excluded.name, icon = excluded.icon, url = excluded.url,
        description = excluded.description, category = excluded.category,
        sort_order = excluded.sort_order, hidden = excluded.hidden
    `).run(req.params.serviceId, serverId, name || null, icon || null, url || null, description || null, category || null, sortOrder || null, hidden ? 1 : 0);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save override', message: error.message });
  }
});

// Check service status
router.get('/:id/status', async (req, res) => {
  try {
    const db = getDb();
    const service = db.prepare('SELECT url FROM manual_services WHERE id = ?').get(req.params.id);

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(service.url, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timeout);
      res.json({ online: response.ok, status: response.status });
    } catch {
      res.json({ online: false, status: 0 });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to check status', message: error.message });
  }
});

export default router;
