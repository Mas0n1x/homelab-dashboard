import { Router } from 'express';
import { getAuditLog } from '../services/audit.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const logs = getAuditLog(limit, offset);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit log', message: error.message });
  }
});

export default router;
