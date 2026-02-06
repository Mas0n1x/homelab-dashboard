import { Router } from 'express';
import { getDb } from '../services/database.js';

const router = Router();

router.get('/', (req, res) => {
  const db = getDb();
  const bookmarks = db.prepare('SELECT * FROM bookmarks ORDER BY category, sort_order, name').all();
  res.json(bookmarks);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { name, url, icon, category } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'Name and URL required' });
  const id = `bm-${Date.now()}`;
  db.prepare('INSERT INTO bookmarks (id, name, url, icon, category) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, url, icon || 'link', category || 'Allgemein');
  res.json({ id });
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { name, url, icon, category, sort_order } = req.body;
  const sets = [];
  const vals = [];
  if (name !== undefined) { sets.push('name = ?'); vals.push(name); }
  if (url !== undefined) { sets.push('url = ?'); vals.push(url); }
  if (icon !== undefined) { sets.push('icon = ?'); vals.push(icon); }
  if (category !== undefined) { sets.push('category = ?'); vals.push(category); }
  if (sort_order !== undefined) { sets.push('sort_order = ?'); vals.push(sort_order); }
  if (sets.length === 0) return res.json({ ok: true });
  vals.push(req.params.id);
  db.prepare(`UPDATE bookmarks SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM bookmarks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
