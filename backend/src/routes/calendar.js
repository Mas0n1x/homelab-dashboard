import { Router } from 'express';
import { getDb } from '../services/database.js';

const router = Router();

router.get('/', (req, res) => {
  const db = getDb();
  const { month, year } = req.query;
  let events;
  if (month && year) {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = `${year}-${String(Number(month) + 1).padStart(2, '0')}-01`;
    events = db.prepare('SELECT * FROM calendar_events WHERE date >= ? AND date < ? ORDER BY date, time').all(start, end);
  } else {
    events = db.prepare('SELECT * FROM calendar_events ORDER BY date DESC, time LIMIT 100').all();
  }
  res.json(events);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { title, description, date, time, color } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'Title and date required' });
  const id = `cal-${Date.now()}`;
  db.prepare('INSERT INTO calendar_events (id, title, description, date, time, color) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, title, description || '', date, time || null, color || 'indigo');
  res.json({ id });
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const { title, description, date, time, color } = req.body;
  const sets = [];
  const vals = [];
  if (title !== undefined) { sets.push('title = ?'); vals.push(title); }
  if (description !== undefined) { sets.push('description = ?'); vals.push(description); }
  if (date !== undefined) { sets.push('date = ?'); vals.push(date); }
  if (time !== undefined) { sets.push('time = ?'); vals.push(time); }
  if (color !== undefined) { sets.push('color = ?'); vals.push(color); }
  if (sets.length === 0) return res.json({ ok: true });
  vals.push(req.params.id);
  db.prepare(`UPDATE calendar_events SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM calendar_events WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
