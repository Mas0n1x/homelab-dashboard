import { Router } from 'express';
import { getDb } from '../services/database.js';

const router = Router();

// Get all favorites
router.get('/', (req, res) => {
  try {
    const serverId = req.query.serverId || 'local';
    const db = getDb();
    const favorites = db.prepare(
      'SELECT service_id, sort_order FROM favorites WHERE server_id = ? ORDER BY sort_order ASC'
    ).all(serverId);
    res.json(favorites);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add favorite
router.post('/', (req, res) => {
  try {
    const { serviceId, serverId = 'local' } = req.body;
    if (!serviceId) return res.status(400).json({ error: 'serviceId required' });

    const db = getDb();
    const maxOrder = db.prepare(
      'SELECT COALESCE(MAX(sort_order), -1) as max FROM favorites WHERE server_id = ?'
    ).get(serverId);

    db.prepare(
      'INSERT OR IGNORE INTO favorites (service_id, server_id, sort_order) VALUES (?, ?, ?)'
    ).run(serviceId, serverId, (maxOrder?.max ?? -1) + 1);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove favorite
router.delete('/:serviceId', (req, res) => {
  try {
    const serverId = req.query.serverId || 'local';
    const db = getDb();
    db.prepare('DELETE FROM favorites WHERE service_id = ? AND server_id = ?')
      .run(req.params.serviceId, serverId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
