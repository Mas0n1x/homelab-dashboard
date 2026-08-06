/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import { Router } from 'express';
import { getDb } from '../services/database.js';

const router = Router();

const STATUSES = ['open', 'doing', 'done'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

// Aufgaben inkl. Unteraufgaben laden; Reihenfolge = manuelle Sortierung je Spalte.
function loadTasks(db) {
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY sort_order ASC, created_at DESC').all();
  const subtasks = db.prepare('SELECT * FROM task_subtasks ORDER BY sort_order ASC, created_at ASC').all();
  const byTask = new Map();
  for (const s of subtasks) {
    if (!byTask.has(s.task_id)) byTask.set(s.task_id, []);
    byTask.get(s.task_id).push(s);
  }
  return tasks.map(t => ({ ...t, subtasks: byTask.get(t.id) || [] }));
}

router.get('/', (req, res) => {
  const db = getDb();
  const tasks = loadTasks(db);
  const projects = db
    .prepare("SELECT DISTINCT project FROM tasks WHERE project IS NOT NULL AND project != '' ORDER BY project COLLATE NOCASE")
    .all()
    .map(r => r.project);
  res.json({ tasks, projects });
});

router.post('/', (req, res) => {
  const db = getDb();
  const { title, notes, status, priority, project, dueDate } = req.body || {};
  if (!title || !String(title).trim()) return res.status(400).json({ error: 'Titel erforderlich' });
  if (status && !STATUSES.includes(status)) return res.status(400).json({ error: 'Ungültiger Status' });
  if (priority && !PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Ungültige Priorität' });
  if (dueDate && !isDate(dueDate)) return res.status(400).json({ error: 'Fälligkeitsdatum muss YYYY-MM-DD sein' });

  const finalStatus = status || 'open';
  const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  // Neue Aufgaben landen oben in ihrer Spalte.
  const min = db.prepare('SELECT MIN(sort_order) AS m FROM tasks WHERE status = ?').get(finalStatus)?.m;
  const sortOrder = (min ?? 0) - 1;

  db.prepare(`
    INSERT INTO tasks (id, title, notes, status, priority, project, due_date, sort_order, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    String(title).trim(),
    notes || '',
    finalStatus,
    priority || 'medium',
    (project || '').trim(),
    dueDate || null,
    sortOrder,
    finalStatus === 'done' ? new Date().toISOString() : null,
  );

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.json({ ...task, subtasks: [] });
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Aufgabe nicht gefunden' });

  const { title, notes, status, priority, project, dueDate, sortOrder } = req.body || {};
  if (status !== undefined && !STATUSES.includes(status)) return res.status(400).json({ error: 'Ungültiger Status' });
  if (priority !== undefined && !PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Ungültige Priorität' });
  if (dueDate !== undefined && dueDate !== null && dueDate !== '' && !isDate(dueDate)) {
    return res.status(400).json({ error: 'Fälligkeitsdatum muss YYYY-MM-DD sein' });
  }

  const sets = ["updated_at = datetime('now')"];
  const vals = [];
  if (title !== undefined) {
    if (!String(title).trim()) return res.status(400).json({ error: 'Titel erforderlich' });
    sets.push('title = ?'); vals.push(String(title).trim());
  }
  if (notes !== undefined) { sets.push('notes = ?'); vals.push(notes || ''); }
  if (priority !== undefined) { sets.push('priority = ?'); vals.push(priority); }
  if (project !== undefined) { sets.push('project = ?'); vals.push((project || '').trim()); }
  if (dueDate !== undefined) { sets.push('due_date = ?'); vals.push(dueDate || null); }
  if (sortOrder !== undefined) { sets.push('sort_order = ?'); vals.push(Number(sortOrder) || 0); }
  if (status !== undefined) {
    sets.push('status = ?'); vals.push(status);
    // Abschlusszeitpunkt mitpflegen — Basis für die "erledigt (7 Tage)"-Kennzahl.
    if (status === 'done' && existing.status !== 'done') {
      sets.push('completed_at = ?'); vals.push(new Date().toISOString());
    } else if (status !== 'done' && existing.status === 'done') {
      sets.push('completed_at = NULL');
    }
  }

  vals.push(req.params.id);
  db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...vals);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  const subtasks = db.prepare('SELECT * FROM task_subtasks WHERE task_id = ? ORDER BY sort_order ASC, created_at ASC').all(req.params.id);
  res.json({ ...task, subtasks });
});

// Drag & Drop: Reihenfolge (und ggf. Spalte) mehrerer Aufgaben in einem Rutsch setzen.
router.post('/reorder', (req, res) => {
  const db = getDb();
  const items = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!items) return res.status(400).json({ error: 'items erforderlich' });
  for (const it of items) {
    if (!it?.id) return res.status(400).json({ error: 'id je Element erforderlich' });
    if (it.status !== undefined && !STATUSES.includes(it.status)) return res.status(400).json({ error: 'Ungültiger Status' });
  }

  const read = db.prepare('SELECT status FROM tasks WHERE id = ?');
  const update = db.prepare(`
    UPDATE tasks SET sort_order = ?, status = ?, completed_at = ?, updated_at = datetime('now') WHERE id = ?
  `);
  const now = new Date().toISOString();

  db.transaction(() => {
    items.forEach((it, idx) => {
      const current = read.get(it.id);
      if (!current) return;
      const status = it.status ?? current.status;
      const order = it.sortOrder !== undefined ? Number(it.sortOrder) : idx;
      // Abschlusszeitpunkt beim Spaltenwechsel setzen bzw. zurücknehmen.
      let completedAt = null;
      if (status === 'done') {
        completedAt = current.status === 'done'
          ? (db.prepare('SELECT completed_at AS c FROM tasks WHERE id = ?').get(it.id)?.c ?? now)
          : now;
      }
      update.run(order, status, completedAt, it.id);
    });
  })();

  res.json({ ok: true, updated: items.length });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const info = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Aufgabe nicht gefunden' });
  res.json({ ok: true });
});

// Alle erledigten Aufgaben aufräumen.
router.post('/clear-done', (req, res) => {
  const db = getDb();
  const info = db.prepare("DELETE FROM tasks WHERE status = 'done'").run();
  res.json({ ok: true, deleted: info.changes });
});

// ─── Unteraufgaben (Checkliste) ───

router.post('/:id/subtasks', (req, res) => {
  const db = getDb();
  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Aufgabe nicht gefunden' });

  const { title } = req.body || {};
  if (!title || !String(title).trim()) return res.status(400).json({ error: 'Titel erforderlich' });

  const id = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const max = db.prepare('SELECT MAX(sort_order) AS m FROM task_subtasks WHERE task_id = ?').get(req.params.id)?.m;
  db.prepare('INSERT INTO task_subtasks (id, task_id, title, sort_order) VALUES (?, ?, ?, ?)')
    .run(id, req.params.id, String(title).trim(), (max ?? -1) + 1);

  res.json(db.prepare('SELECT * FROM task_subtasks WHERE id = ?').get(id));
});

router.put('/subtasks/:subId', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM task_subtasks WHERE id = ?').get(req.params.subId);
  if (!existing) return res.status(404).json({ error: 'Unteraufgabe nicht gefunden' });

  const { title, done } = req.body || {};
  const sets = [];
  const vals = [];
  if (title !== undefined) {
    if (!String(title).trim()) return res.status(400).json({ error: 'Titel erforderlich' });
    sets.push('title = ?'); vals.push(String(title).trim());
  }
  if (done !== undefined) { sets.push('done = ?'); vals.push(done ? 1 : 0); }
  if (sets.length === 0) return res.json(existing);

  vals.push(req.params.subId);
  db.prepare(`UPDATE task_subtasks SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  res.json(db.prepare('SELECT * FROM task_subtasks WHERE id = ?').get(req.params.subId));
});

router.delete('/subtasks/:subId', (req, res) => {
  const db = getDb();
  const info = db.prepare('DELETE FROM task_subtasks WHERE id = ?').run(req.params.subId);
  if (info.changes === 0) return res.status(404).json({ error: 'Unteraufgabe nicht gefunden' });
  res.json({ ok: true });
});

export default router;
