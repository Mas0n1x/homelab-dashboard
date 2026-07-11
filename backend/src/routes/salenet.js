/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';
import * as salenet from '../services/salenet.js';

const router = Router();

router.get('/summary', (req, res) => res.json(salenet.getSummary()));
router.get('/recent', (req, res) => res.json(salenet.getRecent()));

export default router;
