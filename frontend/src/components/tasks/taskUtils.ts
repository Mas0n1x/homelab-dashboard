/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
import type { Task, TaskPriority, TaskStatus } from '@/lib/types';

export const STATUS_META: Record<TaskStatus, { label: string; dot: string; ring: string }> = {
  open: { label: 'Offen', dot: 'bg-white/40', ring: 'border-white/20' },
  doing: { label: 'In Arbeit', dot: 'bg-cyan-400', ring: 'border-cyan-400/50' },
  done: { label: 'Erledigt', dot: 'bg-emerald-400', ring: 'border-emerald-400/50' },
};

export const STATUS_ORDER: TaskStatus[] = ['open', 'doing', 'done'];

export const PRIORITY_META: Record<TaskPriority, { label: string; chip: string; dot: string; weight: number }> = {
  urgent: { label: 'Dringend', chip: 'bg-red-500/10 border-red-500/25 text-red-300', dot: 'bg-red-400', weight: 0 },
  high: { label: 'Hoch', chip: 'bg-amber-500/10 border-amber-500/25 text-amber-300', dot: 'bg-amber-400', weight: 1 },
  medium: { label: 'Mittel', chip: 'bg-indigo-500/10 border-indigo-500/25 text-indigo-300', dot: 'bg-indigo-400', weight: 2 },
  low: { label: 'Niedrig', chip: 'bg-white/[0.04] border-white/[0.08] text-white/45', dot: 'bg-white/30', weight: 3 },
};

export const PRIORITY_ORDER: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];

/** Lokales Datum als YYYY-MM-DD (kein UTC-Versatz wie bei toISOString). */
export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export type DueTone = 'overdue' | 'today' | 'soon' | 'later' | 'none';

export interface DueMeta {
  label: string;
  tone: DueTone;
  className: string;
  days: number;
}

const TONE_CLASS: Record<DueTone, string> = {
  overdue: 'bg-red-500/12 border-red-500/25 text-red-300',
  today: 'bg-amber-500/12 border-amber-500/25 text-amber-300',
  soon: 'bg-white/[0.05] border-white/[0.08] text-white/60',
  later: 'bg-white/[0.04] border-white/[0.07] text-white/40',
  none: 'bg-white/[0.04] border-white/[0.07] text-white/30',
};

/** Fälligkeit in eine sprechende Beschriftung + Farbton übersetzen. */
export function dueMeta(due: string | null | undefined): DueMeta | null {
  if (!due) return null;
  const today = todayISO();
  const diffDays = Math.round(
    (new Date(`${due}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000
  );

  let label: string;
  let tone: DueTone;
  if (diffDays < 0) {
    label = diffDays === -1 ? 'Gestern fällig' : `${Math.abs(diffDays)} Tage überfällig`;
    tone = 'overdue';
  } else if (diffDays === 0) {
    label = 'Heute fällig';
    tone = 'today';
  } else if (diffDays === 1) {
    label = 'Morgen';
    tone = 'soon';
  } else if (diffDays <= 7) {
    label = new Date(`${due}T00:00:00`).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
    tone = 'soon';
  } else {
    label = new Date(`${due}T00:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
    tone = 'later';
  }

  return { label, tone, className: TONE_CLASS[tone], days: diffDays };
}

export function isOverdue(task: Task): boolean {
  if (task.status === 'done' || !task.due_date) return false;
  return task.due_date < todayISO();
}

export function isDueToday(task: Task): boolean {
  if (task.status === 'done' || !task.due_date) return false;
  return task.due_date === todayISO();
}

export function subtaskProgress(task: Task): { done: number; total: number; percent: number } {
  const total = task.subtasks.length;
  const done = task.subtasks.filter(s => s.done).length;
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export type SortMode = 'manual' | 'due' | 'priority' | 'created';

export const SORT_LABELS: Record<SortMode, string> = {
  manual: 'Eigene Reihenfolge',
  due: 'Fälligkeit',
  priority: 'Priorität',
  created: 'Neueste zuerst',
};

export function sortTasks(tasks: Task[], mode: SortMode): Task[] {
  const list = [...tasks];
  switch (mode) {
    case 'due':
      return list.sort((a, b) => {
        if (!a.due_date && !b.due_date) return a.sort_order - b.sort_order;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
    case 'priority':
      return list.sort((a, b) => {
        const d = PRIORITY_META[a.priority].weight - PRIORITY_META[b.priority].weight;
        return d !== 0 ? d : a.sort_order - b.sort_order;
      });
    case 'created':
      return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    default:
      return list.sort((a, b) => a.sort_order - b.sort_order);
  }
}

export interface QuickParse {
  title: string;
  project?: string;
  priority?: TaskPriority;
  dueDate?: string;
}

const PRIORITY_TOKENS: Record<string, TaskPriority> = {
  dringend: 'urgent', urgent: 'urgent', '1': 'urgent',
  hoch: 'high', high: 'high', '2': 'high',
  mittel: 'medium', medium: 'medium', '3': 'medium',
  niedrig: 'low', low: 'low', '4': 'low',
};

/**
 * Schnell-Eingabe: "@Projekt" setzt das Projekt, "!hoch" die Priorität,
 * "heute"/"morgen" das Fälligkeitsdatum. Alles Übrige bleibt Titel.
 */
export function parseQuickInput(raw: string): QuickParse {
  let text = ` ${raw} `;
  const result: QuickParse = { title: '' };

  text = text.replace(/\s@([^\s@!]+)/g, (_m, p: string) => { result.project = p; return ' '; });
  text = text.replace(/\s!([^\s@!]+)/g, (m, p: string) => {
    const prio = PRIORITY_TOKENS[String(p).toLowerCase()];
    if (!prio) return m;
    result.priority = prio;
    return ' ';
  });
  text = text.replace(/\s(heute|morgen|übermorgen)(?=\s)/gi, (_m, word: string) => {
    const w = word.toLowerCase();
    result.dueDate = w === 'heute' ? todayISO() : w === 'morgen' ? addDaysISO(1) : addDaysISO(2);
    return ' ';
  });

  result.title = text.replace(/\s+/g, ' ').trim();
  return result;
}

// ─── Gruppierung ───

export type GroupMode = 'status' | 'due' | 'project';

export const GROUP_LABELS: Record<GroupMode, string> = {
  status: 'Nach Status',
  due: 'Nach Fälligkeit',
  project: 'Nach Projekt',
};

export type DueBucket = 'overdue' | 'today' | 'week' | 'later' | 'none';

export const DUE_BUCKET_ORDER: DueBucket[] = ['overdue', 'today', 'week', 'later', 'none'];

export const DUE_BUCKET_META: Record<DueBucket, { label: string; dot: string }> = {
  overdue: { label: 'Überfällig', dot: 'bg-red-400' },
  today: { label: 'Heute fällig', dot: 'bg-amber-400' },
  week: { label: 'Diese Woche', dot: 'bg-cyan-400' },
  later: { label: 'Später', dot: 'bg-indigo-400' },
  none: { label: 'Ohne Datum', dot: 'bg-white/25' },
};

/** Aufgabe einem Fälligkeits-Abschnitt zuordnen (für die Gruppierung). */
export function dueBucket(task: Task): DueBucket {
  const meta = dueMeta(task.due_date);
  if (!meta) return 'none';
  if (meta.days < 0) return 'overdue';
  if (meta.days === 0) return 'today';
  if (meta.days <= 7) return 'week';
  return 'later';
}

// ─── Schnellfilter (die Chips über der Liste) ───

export type QuickFilter = 'all' | 'open' | 'doing' | 'today' | 'overdue' | 'done';

export function matchesQuickFilter(task: Task, filter: QuickFilter): boolean {
  switch (filter) {
    case 'open': return task.status === 'open';
    case 'doing': return task.status === 'doing';
    case 'today': return isDueToday(task);
    case 'overdue': return isOverdue(task);
    case 'done': return task.status === 'done';
    default: return true;
  }
}
