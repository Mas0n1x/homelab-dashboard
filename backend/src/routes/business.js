/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';
import * as salenet from '../services/salenet.js';
import * as portfolio from '../services/portfolio.js';
import { getDb } from '../services/database.js';
import { logAudit } from '../services/audit.js';

const router = Router();

function dismissedSet() {
  const rows = getDb().prepare('SELECT ref FROM dismissed_requests').all();
  return new Set(rows.map(r => r.ref));
}

// Zusammengeführte Business-Anfragen (SaleNet + Portfolio), erledigte ausgeblendet.
router.get('/requests', async (req, res) => {
  try {
    const dismissed = dismissedSet();
    const items = [];

    const recent = salenet.getRecent();
    if (recent?.orders) {
      for (const o of recent.orders) {
        items.push({
          ref: `salenet:order:${o.id}`,
          source: 'SaleNet', kind: 'order',
          title: o.package_name || 'Bestellung',
          sub: o.customer_name || o.customer_email || '',
          email: o.customer_email || null,
          amount: o.price != null ? `${o.price} €${o.billing_cycle ? ' / ' + o.billing_cycle : ''}` : null,
          status: o.status, time: o.created_at,
          isNew: o.status === 'pending',
        });
      }
    }
    if (recent?.contacts) {
      for (const c of recent.contacts) {
        items.push({
          ref: `salenet:contact:${c.id}`,
          source: 'SaleNet', kind: 'contact',
          title: c.subject || 'Kontaktanfrage',
          sub: c.name || c.email || '',
          email: c.email || null,
          message: c.message || null,
          status: c.status, time: c.created_at,
          isNew: c.status === 'new',
        });
      }
    }

    let portfolioReqs = [];
    try { portfolioReqs = await portfolio.getRequests(); } catch { /* Portfolio offline */ }
    if (Array.isArray(portfolioReqs)) {
      for (const p of portfolioReqs) {
        const id = p.id ?? p._id ?? `${p.email || ''}-${p.created_at || p.createdAt || ''}`;
        const status = p.status || 'new';
        items.push({
          ref: `portfolio:request:${id}`,
          source: 'Portfolio', kind: 'request',
          title: p.subject || p.projectType || p.title || p.name || 'Anfrage',
          sub: p.name || p.email || p.company || '',
          email: p.email || null,
          message: p.message || p.description || null,
          status, time: p.created_at || p.createdAt || p.date || '',
          isNew: ['new', 'pending', 'open', 'neu'].includes(String(status).toLowerCase()),
        });
      }
    }

    const visible = items.filter(i => !dismissed.has(i.ref));
    visible.sort((a, b) =>
      new Date((b.time || '').replace(' ', 'T')).getTime() - new Date((a.time || '').replace(' ', 'T')).getTime());

    res.json({ items: visible, total: items.length, dismissedCount: dismissed.size });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load business requests', message: error.message });
  }
});

// Eine Anfrage als erledigt markieren (lokal ausblenden)
router.post('/requests/dismiss', (req, res) => {
  try {
    const { ref } = req.body || {};
    if (!ref) return res.status(400).json({ error: 'ref required' });
    getDb().prepare('INSERT OR IGNORE INTO dismissed_requests (ref) VALUES (?)').run(String(ref));
    logAudit('business.dismiss', String(ref), null, req.user?.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to dismiss request', message: error.message });
  }
});

// Ausgeblendete wieder einblenden (einzeln via ref, oder alle)
router.post('/requests/restore', (req, res) => {
  try {
    const { ref } = req.body || {};
    const db = getDb();
    if (ref) db.prepare('DELETE FROM dismissed_requests WHERE ref = ?').run(String(ref));
    else db.prepare('DELETE FROM dismissed_requests').run();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to restore requests', message: error.message });
  }
});

export default router;
