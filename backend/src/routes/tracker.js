import { Router } from 'express';
import { getDb } from '../services/database.js';
import { completeTask, ACHIEVEMENTS, CATEGORIES, getXpForLevel } from '../services/tracker.js';

const router = Router();

// ─── Tasks ───

router.get('/tasks', (req, res) => {
  try {
    const db = getDb();
    const { status } = req.query;
    let tasks;
    if (status) {
      const statuses = status.split(',');
      tasks = db.prepare(
        `SELECT * FROM tracker_tasks WHERE status IN (${statuses.map(() => '?').join(',')}) ORDER BY sort_order ASC, created_at DESC`
      ).all(...statuses);
    } else {
      tasks = db.prepare('SELECT * FROM tracker_tasks ORDER BY sort_order ASC, created_at DESC').all();
    }
    // Parse JSON fields
    tasks = tasks.map(t => ({
      ...t,
      labels: JSON.parse(t.labels || '[]'),
      subtasks: JSON.parse(t.subtasks || '[]'),
    }));
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/tasks', (req, res) => {
  try {
    const db = getDb();
    const { title, description, estimated_time, category, labels, project_id, subtasks } = req.body;
    if (!title) return res.status(400).json({ error: 'Titel erforderlich' });

    const id = `task-${Date.now()}`;
    const maxOrder = db.prepare("SELECT MAX(sort_order) as m FROM tracker_tasks WHERE status = 'backlog'").get();

    db.prepare(`
      INSERT INTO tracker_tasks (id, title, description, estimated_time, category, labels, project_id, subtasks, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      title,
      description || '',
      estimated_time || 25,
      category || '',
      JSON.stringify(labels || []),
      project_id || null,
      JSON.stringify(subtasks || []),
      (maxOrder?.m || 0) + 1
    );

    const task = db.prepare('SELECT * FROM tracker_tasks WHERE id = ?').get(id);
    res.json({ ...task, labels: JSON.parse(task.labels), subtasks: JSON.parse(task.subtasks) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/tasks/:id', (req, res) => {
  try {
    const db = getDb();
    const task = db.prepare('SELECT * FROM tracker_tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task nicht gefunden' });

    const fields = ['title', 'description', 'notes', 'estimated_time', 'category', 'project_id'];
    const updates = [];
    const values = [];

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }
    // JSON fields
    if (req.body.labels !== undefined) {
      updates.push('labels = ?');
      values.push(JSON.stringify(req.body.labels));
    }
    if (req.body.subtasks !== undefined) {
      updates.push('subtasks = ?');
      values.push(JSON.stringify(req.body.subtasks));
    }

    if (updates.length > 0) {
      values.push(req.params.id);
      db.prepare(`UPDATE tracker_tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updated = db.prepare('SELECT * FROM tracker_tasks WHERE id = ?').get(req.params.id);
    res.json({ ...updated, labels: JSON.parse(updated.labels), subtasks: JSON.parse(updated.subtasks) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/tasks/:id/move', (req, res) => {
  try {
    const db = getDb();
    const { status, sort_order } = req.body;
    if (!status) return res.status(400).json({ error: 'Status erforderlich' });

    db.prepare('UPDATE tracker_tasks SET status = ?, sort_order = ? WHERE id = ?')
      .run(status, sort_order || 0, req.params.id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/tasks/:id/complete', (req, res) => {
  try {
    const { actual_time } = req.body;
    const result = completeTask(req.params.id, actual_time || 0);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/tasks/done', (req, res) => {
  try {
    const db = getDb();
    const result = db.prepare("DELETE FROM tracker_tasks WHERE status = 'done'").run();
    res.json({ deleted: result.changes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/tasks/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM tracker_tasks WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Projects ───

router.get('/projects', (req, res) => {
  try {
    const db = getDb();
    const projects = db.prepare('SELECT * FROM tracker_projects ORDER BY created_at DESC').all();
    // Aggregate time from done tasks
    const result = projects.map(p => {
      const stats = db.prepare(
        "SELECT COALESCE(SUM(actual_time), 0) as total_time, COUNT(*) as task_count FROM tracker_tasks WHERE project_id = ? AND status = 'done'"
      ).get(p.id);
      return { ...p, total_time: stats.total_time, task_count: stats.task_count };
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/projects', (req, res) => {
  try {
    const db = getDb();
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Name erforderlich' });

    const id = `proj-${Date.now()}`;
    db.prepare('INSERT INTO tracker_projects (id, name, color) VALUES (?, ?, ?)').run(id, name, color || '#6366f1');

    const project = db.prepare('SELECT * FROM tracker_projects WHERE id = ?').get(id);
    res.json({ ...project, total_time: 0, task_count: 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/projects/:id', (req, res) => {
  try {
    const db = getDb();
    const { name, color } = req.body;
    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (color !== undefined) { updates.push('color = ?'); values.push(color); }
    if (updates.length > 0) {
      values.push(req.params.id);
      db.prepare(`UPDATE tracker_projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
    const project = db.prepare('SELECT * FROM tracker_projects WHERE id = ?').get(req.params.id);
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/projects/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM tracker_projects WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Player / Gamification ───

router.get('/player', (req, res) => {
  try {
    const db = getDb();
    const player = db.prepare('SELECT * FROM tracker_player WHERE id = 1').get();
    player.xp_for_next_level = getXpForLevel(player.level);
    res.json(player);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/player/goal', (req, res) => {
  try {
    const db = getDb();
    const { daily_goal } = req.body;
    if (!daily_goal || daily_goal < 1) return res.status(400).json({ error: 'Ungültiges Tagesziel' });

    db.prepare('UPDATE tracker_player SET daily_goal = ? WHERE id = 1').run(daily_goal);
    const player = db.prepare('SELECT * FROM tracker_player WHERE id = 1').get();
    player.xp_for_next_level = getXpForLevel(player.level);
    res.json(player);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Achievements ───

router.get('/achievements', (req, res) => {
  try {
    const db = getDb();
    const unlocked = db.prepare('SELECT * FROM tracker_achievements').all();
    const unlockedMap = Object.fromEntries(unlocked.map(a => [a.id, a.unlocked_at]));

    const result = ACHIEVEMENTS.map(a => ({
      ...a,
      unlocked: !!unlockedMap[a.id],
      unlocked_at: unlockedMap[a.id] || null,
    }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Stats ───

router.get('/stats/today', (req, res) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];
    const stats = db.prepare('SELECT * FROM tracker_daily_stats WHERE date = ?').get(today);
    const player = db.prepare('SELECT daily_goal FROM tracker_player WHERE id = 1').get();

    res.json({
      completed: stats?.completed || 0,
      total_minutes: stats?.total_minutes || 0,
      categories: JSON.parse(stats?.categories || '{}'),
      daily_goal: player.daily_goal,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats/week', (req, res) => {
  try {
    const db = getDb();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }
    const stats = db.prepare(
      `SELECT * FROM tracker_daily_stats WHERE date IN (${days.map(() => '?').join(',')})`
    ).all(...days);

    const statsMap = Object.fromEntries(stats.map(s => [s.date, s]));
    const result = days.map(date => ({
      date,
      completed: statsMap[date]?.completed || 0,
      total_minutes: statsMap[date]?.total_minutes || 0,
      categories: JSON.parse(statsMap[date]?.categories || '{}'),
    }));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats/heatmap', (req, res) => {
  try {
    const db = getDb();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const tasks = db.prepare(
      "SELECT completed_at FROM tracker_tasks WHERE status = 'done' AND completed_at >= ?"
    ).all(thirtyDaysAgo.toISOString());

    // Build heatmap: day_of_week (0-6) x hour (0-23)
    const heatmap = {};
    for (const t of tasks) {
      if (!t.completed_at) continue;
      const d = new Date(t.completed_at);
      const day = d.getDay(); // 0=Sun
      const hour = d.getHours();
      const key = `${day}-${hour}`;
      heatmap[key] = (heatmap[key] || 0) + 1;
    }
    res.json(heatmap);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats/accuracy', (req, res) => {
  try {
    const db = getDb();
    const tasks = db.prepare(
      "SELECT estimated_time, actual_time FROM tracker_tasks WHERE status = 'done' AND actual_time > 0 AND estimated_time > 0"
    ).all();

    if (tasks.length === 0) {
      return res.json({ total: 0, faster: 0, on_time: 0, slower: 0, avg_deviation: 0, accuracy_percent: 0 });
    }

    let faster = 0, onTime = 0, slower = 0, totalDeviation = 0;
    for (const t of tasks) {
      const ratio = t.actual_time / t.estimated_time;
      totalDeviation += Math.abs(t.actual_time - t.estimated_time);
      if (ratio < 0.9) faster++;
      else if (ratio <= 1.1) onTime++;
      else slower++;
    }

    res.json({
      total: tasks.length,
      faster,
      on_time: onTime,
      slower,
      avg_deviation: Math.round(totalDeviation / tasks.length),
      accuracy_percent: Math.round((onTime / tasks.length) * 100),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Notes ───

router.get('/notes', (req, res) => {
  try {
    const db = getDb();
    const notes = db.prepare('SELECT * FROM tracker_notes ORDER BY updated_at DESC').all();
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/notes', (req, res) => {
  try {
    const db = getDb();
    const { title, content } = req.body;
    if (!title) return res.status(400).json({ error: 'Titel erforderlich' });

    const id = `tnote-${Date.now()}`;
    db.prepare('INSERT INTO tracker_notes (id, title, content) VALUES (?, ?, ?)').run(id, title, content || '');

    const note = db.prepare('SELECT * FROM tracker_notes WHERE id = ?').get(id);
    res.json(note);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/notes/:id', (req, res) => {
  try {
    const db = getDb();
    const { title, content } = req.body;
    const updates = [];
    const values = [];
    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (content !== undefined) { updates.push('content = ?'); values.push(content); }
    updates.push("updated_at = datetime('now')");
    values.push(req.params.id);
    db.prepare(`UPDATE tracker_notes SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const note = db.prepare('SELECT * FROM tracker_notes WHERE id = ?').get(req.params.id);
    res.json(note);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/notes/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM tracker_notes WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Backup ───

router.get('/backup/export', (req, res) => {
  try {
    const db = getDb();
    const data = {
      tasks: db.prepare('SELECT * FROM tracker_tasks').all(),
      projects: db.prepare('SELECT * FROM tracker_projects').all(),
      player: db.prepare('SELECT * FROM tracker_player WHERE id = 1').get(),
      achievements: db.prepare('SELECT * FROM tracker_achievements').all(),
      daily_stats: db.prepare('SELECT * FROM tracker_daily_stats').all(),
      notes: db.prepare('SELECT * FROM tracker_notes').all(),
      exported_at: new Date().toISOString(),
    };
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/backup/import', (req, res) => {
  try {
    const db = getDb();
    const data = req.body;

    db.transaction(() => {
      // Clear existing data
      db.prepare('DELETE FROM tracker_tasks').run();
      db.prepare('DELETE FROM tracker_projects').run();
      db.prepare('DELETE FROM tracker_achievements').run();
      db.prepare('DELETE FROM tracker_daily_stats').run();
      db.prepare('DELETE FROM tracker_notes').run();

      // Import projects first (foreign key)
      if (data.projects) {
        const insertProject = db.prepare('INSERT INTO tracker_projects (id, name, color, created_at) VALUES (?, ?, ?, ?)');
        for (const p of data.projects) {
          insertProject.run(p.id, p.name, p.color, p.created_at);
        }
      }

      // Import tasks
      if (data.tasks) {
        const insertTask = db.prepare(`
          INSERT INTO tracker_tasks (id, title, description, notes, estimated_time, actual_time, status, category, labels, project_id, subtasks, sort_order, created_at, completed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const t of data.tasks) {
          insertTask.run(t.id, t.title, t.description, t.notes, t.estimated_time, t.actual_time, t.status, t.category, t.labels, t.project_id, t.subtasks, t.sort_order, t.created_at, t.completed_at);
        }
      }

      // Import player
      if (data.player) {
        db.prepare(`
          UPDATE tracker_player SET level = ?, xp = ?, total_xp = ?, streak = ?, last_active_date = ?, daily_goal = ?, updated_at = ?
          WHERE id = 1
        `).run(data.player.level, data.player.xp, data.player.total_xp, data.player.streak, data.player.last_active_date, data.player.daily_goal, data.player.updated_at);
      }

      // Import achievements
      if (data.achievements) {
        const insertAchievement = db.prepare('INSERT INTO tracker_achievements (id, unlocked_at) VALUES (?, ?)');
        for (const a of data.achievements) {
          insertAchievement.run(a.id, a.unlocked_at);
        }
      }

      // Import daily stats
      if (data.daily_stats) {
        const insertStats = db.prepare('INSERT INTO tracker_daily_stats (date, completed, total_minutes, categories) VALUES (?, ?, ?, ?)');
        for (const s of data.daily_stats) {
          insertStats.run(s.date, s.completed, s.total_minutes, s.categories);
        }
      }

      // Import notes
      if (data.notes) {
        const insertNote = db.prepare('INSERT INTO tracker_notes (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
        for (const n of data.notes) {
          insertNote.run(n.id, n.title, n.content, n.created_at, n.updated_at);
        }
      }
    })();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Categories ───

router.get('/categories', (req, res) => {
  res.json(CATEGORIES);
});

export default router;
