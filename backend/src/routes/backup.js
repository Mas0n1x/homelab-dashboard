import { Router } from 'express';
import { getBackups, getBackupStatus, runBackup } from '../services/backup.js';

const router = Router();

// Get backup history
router.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    res.json(getBackups(limit));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch backups', message: error.message });
  }
});

// Get backup status
router.get('/status', (req, res) => {
  try {
    res.json(getBackupStatus());
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch backup status', message: error.message });
  }
});

// Run backup
router.post('/run', async (req, res) => {
  try {
    const { type = 'database' } = req.body;
    const result = await runBackup(type, req.user?.id);
    res.json(result);
  } catch (error) {
    res.status(error.message.includes('already running') ? 409 : 500)
      .json({ error: error.message });
  }
});

export default router;
