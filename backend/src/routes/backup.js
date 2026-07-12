/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';
import {
  getBackups,
  getBackupStatus,
  runBackup,
  deleteBackup,
  getBackupFile,
  getBackupSchedule,
  setBackupSchedule,
  restoreBackup,
  getOffsiteConfig,
  setOffsiteConfig,
} from '../services/backup.js';

const router = Router();

// Off-Site-Konfiguration
router.get('/offsite', (req, res) => {
  try { res.json(getOffsiteConfig()); } catch (e) { res.status(500).json({ error: e.message }); }
});
router.put('/offsite', (req, res) => {
  try { res.json(setOffsiteConfig(req.body || {})); } catch (e) { res.status(500).json({ error: e.message }); }
});

// Backup wiederherstellen
router.post('/:id/restore', async (req, res) => {
  try {
    const result = await restoreBackup(parseInt(req.params.id), req.user?.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Wiederherstellung fehlgeschlagen', message: error.message });
  }
});

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

// Zeitplan für automatische Backups lesen
router.get('/schedule', (req, res) => {
  try {
    res.json(getBackupSchedule());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Zeitplan für automatische Backups setzen
router.put('/schedule', (req, res) => {
  try {
    res.json(setBackupSchedule(req.body || {}));
  } catch (error) {
    res.status(500).json({ error: error.message });
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

// Backup-Datei herunterladen
router.get('/:id/download', (req, res) => {
  try {
    const { path, filename } = getBackupFile(req.params.id);
    res.download(path, filename);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Backup löschen
router.delete('/:id', (req, res) => {
  try {
    res.json(deleteBackup(req.params.id, req.user?.id));
  } catch (error) {
    const code = error.message.includes('nicht gefunden') ? 404
      : error.message.includes('Laufendes') ? 409 : 500;
    res.status(code).json({ error: error.message });
  }
});

export default router;
