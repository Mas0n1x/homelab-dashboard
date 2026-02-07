import { getDb } from './database.js';

// 5 categories
export const CATEGORIES = [
  { id: 'arbeit', name: 'Arbeit', color: '#6366f1' },
  { id: 'privat', name: 'Privat', color: '#10b981' },
  { id: 'lernen', name: 'Lernen', color: '#f59e0b' },
  { id: 'sport', name: 'Sport', color: '#ef4444' },
  { id: 'projekt', name: 'Projekt', color: '#8b5cf6' },
];

// 16 achievements
export const ACHIEVEMENTS = [
  { id: 'first_task', name: 'Erste Schritte', desc: 'Schließe deine erste Aufgabe ab', icon: 'footprints' },
  { id: 'tasks_5', name: 'Fleißig', desc: 'Schließe 5 Aufgaben ab', icon: 'star' },
  { id: 'tasks_10', name: 'Produktiv', desc: 'Schließe 10 Aufgaben ab', icon: 'zap' },
  { id: 'tasks_25', name: 'Meister', desc: 'Schließe 25 Aufgaben ab', icon: 'crown' },
  { id: 'tasks_50', name: 'König', desc: 'Schließe 50 Aufgaben ab', icon: 'trophy' },
  { id: 'streak_3', name: 'Durchhalter', desc: '3 Tage Streak', icon: 'flame' },
  { id: 'streak_7', name: 'Wochenkrieger', desc: '7 Tage Streak', icon: 'sword' },
  { id: 'streak_14', name: 'Unaufhaltsam', desc: '14 Tage Streak', icon: 'shield' },
  { id: 'streak_30', name: 'Legende', desc: '30 Tage Streak', icon: 'gem' },
  { id: 'level_5', name: 'Kletterer', desc: 'Erreiche Level 5', icon: 'mountain' },
  { id: 'level_10', name: 'Veteran', desc: 'Erreiche Level 10', icon: 'medal' },
  { id: 'speed_demon', name: 'Speed Demon', desc: 'Aufgabe 20% schneller als geschätzt', icon: 'rocket' },
  { id: 'daily_goal', name: 'Tagesmensch', desc: 'Tagesziel erreicht', icon: 'target' },
  { id: 'early_bird', name: 'Frühaufsteher', desc: 'Aufgabe vor 7 Uhr abgeschlossen', icon: 'sunrise' },
  { id: 'night_owl', name: 'Nachteule', desc: 'Aufgabe nach 22 Uhr abgeschlossen', icon: 'moon' },
  { id: 'category_master', name: 'Kategorieexperte', desc: 'Alle 5 Kategorien genutzt', icon: 'layers' },
];

// XP needed for a given level
export function getXpForLevel(level) {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

// Calculate XP earned for completing a task
export function calculateXP(estimatedTime, actualTime) {
  let xp = 10; // base
  xp += Math.floor(estimatedTime / 5); // time bonus
  if (actualTime > 0 && actualTime < estimatedTime * 0.8) {
    xp += 5; // speed bonus
  }
  return xp;
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

// Complete a task: update task, award XP, update streak, update stats, check achievements
export function completeTask(taskId, actualTime) {
  const db = getDb();

  const result = db.transaction(() => {
    const task = db.prepare('SELECT * FROM tracker_tasks WHERE id = ?').get(taskId);
    if (!task) throw new Error('Task nicht gefunden');
    if (task.status === 'done') throw new Error('Task bereits abgeschlossen');

    const now = new Date().toISOString();
    const today = getTodayDate();

    // Update task
    db.prepare(`
      UPDATE tracker_tasks SET status = 'done', actual_time = ?, completed_at = ? WHERE id = ?
    `).run(actualTime, now, taskId);

    // Calculate and award XP
    const xpGained = calculateXP(task.estimated_time, actualTime);
    const player = db.prepare('SELECT * FROM tracker_player WHERE id = 1').get();

    let newXp = player.xp + xpGained;
    let newTotalXp = player.total_xp + xpGained;
    let newLevel = player.level;
    let levelUp = false;

    // Check level up (possibly multiple levels)
    while (newXp >= getXpForLevel(newLevel)) {
      newXp -= getXpForLevel(newLevel);
      newLevel++;
      levelUp = true;
    }

    // Update streak
    let newStreak = player.streak;
    if (player.last_active_date !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (player.last_active_date === yesterdayStr) {
        newStreak = player.streak + 1;
      } else if (player.last_active_date !== today) {
        newStreak = 1; // reset streak
      }
    }

    db.prepare(`
      UPDATE tracker_player
      SET xp = ?, total_xp = ?, level = ?, streak = ?, last_active_date = ?, updated_at = ?
      WHERE id = 1
    `).run(newXp, newTotalXp, newLevel, newStreak, today, now);

    // Update daily stats
    const existingStats = db.prepare('SELECT * FROM tracker_daily_stats WHERE date = ?').get(today);
    const taskCategory = task.category || 'arbeit';

    if (existingStats) {
      const cats = JSON.parse(existingStats.categories || '{}');
      cats[taskCategory] = (cats[taskCategory] || 0) + 1;
      db.prepare(`
        UPDATE tracker_daily_stats SET completed = completed + 1, total_minutes = total_minutes + ?, categories = ? WHERE date = ?
      `).run(actualTime, JSON.stringify(cats), today);
    } else {
      const cats = { [taskCategory]: 1 };
      db.prepare(`
        INSERT INTO tracker_daily_stats (date, completed, total_minutes, categories) VALUES (?, 1, ?, ?)
      `).run(today, actualTime, JSON.stringify(cats));
    }

    // Check achievements
    const newAchievements = checkAchievements(db, {
      totalCompleted: db.prepare("SELECT COUNT(*) as c FROM tracker_tasks WHERE status = 'done'").get().c,
      streak: newStreak,
      level: newLevel,
      estimatedTime: task.estimated_time,
      actualTime,
      today,
      dailyGoal: player.daily_goal,
    });

    return {
      xp_gained: xpGained,
      level_up: levelUp,
      new_level: newLevel,
      current_xp: newXp,
      total_xp: newTotalXp,
      streak: newStreak,
      new_achievements: newAchievements,
    };
  })();

  return result;
}

function checkAchievements(db, ctx) {
  const unlocked = db.prepare('SELECT id FROM tracker_achievements').all().map(r => r.id);
  const newlyUnlocked = [];

  const checks = [
    { id: 'first_task', condition: ctx.totalCompleted >= 1 },
    { id: 'tasks_5', condition: ctx.totalCompleted >= 5 },
    { id: 'tasks_10', condition: ctx.totalCompleted >= 10 },
    { id: 'tasks_25', condition: ctx.totalCompleted >= 25 },
    { id: 'tasks_50', condition: ctx.totalCompleted >= 50 },
    { id: 'streak_3', condition: ctx.streak >= 3 },
    { id: 'streak_7', condition: ctx.streak >= 7 },
    { id: 'streak_14', condition: ctx.streak >= 14 },
    { id: 'streak_30', condition: ctx.streak >= 30 },
    { id: 'level_5', condition: ctx.level >= 5 },
    { id: 'level_10', condition: ctx.level >= 10 },
    { id: 'speed_demon', condition: ctx.actualTime > 0 && ctx.actualTime < ctx.estimatedTime * 0.8 },
  ];

  // Daily goal check
  const todayStats = db.prepare('SELECT total_minutes FROM tracker_daily_stats WHERE date = ?').get(ctx.today);
  if (todayStats && todayStats.total_minutes >= ctx.dailyGoal) {
    checks.push({ id: 'daily_goal', condition: true });
  }

  // Time-based achievements
  const hour = new Date().getHours();
  checks.push({ id: 'early_bird', condition: hour < 7 });
  checks.push({ id: 'night_owl', condition: hour >= 22 });

  // Category master: check if all 5 categories used
  const catCounts = db.prepare(`
    SELECT DISTINCT category FROM tracker_tasks WHERE status = 'done' AND category != ''
  `).all();
  const usedCats = new Set(catCounts.map(r => r.category));
  const allCatsUsed = CATEGORIES.every(c => usedCats.has(c.id));
  checks.push({ id: 'category_master', condition: allCatsUsed });

  const insert = db.prepare('INSERT OR IGNORE INTO tracker_achievements (id) VALUES (?)');

  for (const check of checks) {
    if (check.condition && !unlocked.includes(check.id)) {
      insert.run(check.id);
      const def = ACHIEVEMENTS.find(a => a.id === check.id);
      newlyUnlocked.push(def);
    }
  }

  return newlyUnlocked;
}
