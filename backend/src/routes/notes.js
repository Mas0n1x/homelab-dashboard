import { Router } from 'express';
import { getDb } from '../services/database.js';

const router = Router();

router.get('/', (req, res) => {
  const db = getDb();
  const notes = db.prepare('SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC').all();
  res.json(notes);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { title, content, color } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const id = `note-${Date.now()}`;
  db.prepare('INSERT INTO notes (id, title, content, color) VALUES (?, ?, ?, ?)')
    .run(id, title, content || '', color || 'default');
  res.json({ id });
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { title, content, pinned, color } = req.body;
  const sets = ["updated_at = datetime('now')"];
  const vals = [];
  if (title !== undefined) { sets.push('title = ?'); vals.push(title); }
  if (content !== undefined) { sets.push('content = ?'); vals.push(content); }
  if (pinned !== undefined) { sets.push('pinned = ?'); vals.push(pinned ? 1 : 0); }
  if (color !== undefined) { sets.push('color = ?'); vals.push(color); }
  vals.push(req.params.id);
  db.prepare(`UPDATE notes SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
