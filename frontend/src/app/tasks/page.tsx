/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ListChecks, Plus, Search, LayoutList, Columns3, Trash2, ChevronDown,
  Inbox, SlidersHorizontal, RotateCcw, X,
} from 'lucide-react';
import { PageTransition } from '@/components/ui/PageTransition';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskModal } from '@/components/tasks/TaskModal';
import {
  DUE_BUCKET_META, DUE_BUCKET_ORDER, GROUP_LABELS, PRIORITY_META, PRIORITY_ORDER,
  SORT_LABELS, STATUS_META, dueBucket, isDueToday, isOverdue, matchesQuickFilter,
  parseQuickInput, sortTasks,
  type GroupMode, type QuickFilter, type SortMode,
} from '@/components/tasks/taskUtils';
import * as api from '@/lib/api';
import type { Task, TaskInput, TaskPriority, TaskStatus } from '@/lib/types';

type ViewMode = 'list' | 'board';

interface DropTarget {
  status: TaskStatus;
  beforeId: string | null;
}

/** Ein Abschnitt der Listenansicht. `status` ist nur bei Status-Gruppierung gesetzt (Drop-Ziel). */
interface TaskGroup {
  key: string;
  label: string;
  dot: string;
  tasks: Task[];
  status?: TaskStatus;
  emptyText: string;
}

const BOARD_COLUMNS: TaskStatus[] = ['open', 'doing', 'done'];

const CHIP_STYLES: Record<QuickFilter, string> = {
  all: 'bg-white/[0.12] border-white/20 text-white',
  open: 'bg-white/[0.12] border-white/20 text-white',
  doing: 'bg-cyan-500/15 border-cyan-400/35 text-cyan-200',
  today: 'bg-amber-500/15 border-amber-400/35 text-amber-200',
  overdue: 'bg-red-500/15 border-red-400/35 text-red-200',
  done: 'bg-emerald-500/15 border-emerald-400/35 text-emerald-200',
};

export default function TasksPage() {
  const queryClient = useQueryClient();

  const [view, setView] = useState<ViewMode>('list');
  const [sort, setSort] = useState<SortMode>('manual');
  const [group, setGroup] = useState<GroupMode>('status');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'' | TaskPriority>('');
  const [showFilters, setShowFilters] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [quick, setQuick] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  // Drag & Drop gibt es nur mit Maus — HTML5-DnD löst auf Touch nichts aus.
  // Dort übernehmen „Nach oben/unten" im Karten-Menü.
  const [isDesktop, setIsDesktop] = useState(false);

  // Ansicht, Sortierung und Gruppierung pro Browser merken
  useEffect(() => {
    const savedView = localStorage.getItem('tasks-view');
    if (savedView === 'board' || savedView === 'list') setView(savedView);
    const savedSort = localStorage.getItem('tasks-sort');
    if (savedSort && savedSort in SORT_LABELS) setSort(savedSort as SortMode);
    const savedGroup = localStorage.getItem('tasks-group');
    if (savedGroup && savedGroup in GROUP_LABELS) setGroup(savedGroup as GroupMode);

    const mq = window.matchMedia('(min-width: 768px) and (pointer: fine)');
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const changeView = (next: ViewMode) => { setView(next); localStorage.setItem('tasks-view', next); };
  const changeSort = (next: SortMode) => { setSort(next); localStorage.setItem('tasks-sort', next); };
  const changeGroup = (next: GroupMode) => { setGroup(next); localStorage.setItem('tasks-group', next); };

  const { data, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.getTasks(),
    staleTime: 10000,
  });

  const tasks = useMemo(() => data?.tasks ?? [], [data]);
  const projects = data?.projects ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tasks'] });

  const createMutation = useMutation({
    mutationFn: async ({ input, subtasks }: { input: TaskInput; subtasks: string[] }) => {
      const task = await api.addTask(input);
      for (const title of subtasks) await api.addSubtask(task.id, title);
      return task;
    },
    onSuccess: () => { invalidate(); setModalOpen(false); setEditing(null); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<TaskInput> }) => api.updateTask(id, input),
    onSuccess: () => invalidate(),
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<TaskInput> }) => api.updateTask(id, input),
    onSuccess: () => { invalidate(); setModalOpen(false); setEditing(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: () => invalidate(),
  });

  const clearDoneMutation = useMutation({
    mutationFn: () => api.clearDoneTasks(),
    onSuccess: () => invalidate(),
  });

  const addSubtaskMutation = useMutation({
    mutationFn: ({ taskId, title }: { taskId: string; title: string }) => api.addSubtask(taskId, title),
    onSuccess: () => invalidate(),
  });

  const toggleSubtaskMutation = useMutation({
    mutationFn: ({ subId, done }: { subId: string; done: boolean }) => api.updateSubtask(subId, { done }),
    onSuccess: () => invalidate(),
  });

  const deleteSubtaskMutation = useMutation({
    mutationFn: (subId: string) => api.deleteSubtask(subId),
    onSuccess: () => invalidate(),
  });

  const reorderMutation = useMutation({
    mutationFn: (items: { id: string; status: TaskStatus; sortOrder: number }[]) => api.reorderTasks(items),
    onSuccess: () => invalidate(),
    onError: () => invalidate(),
  });

  // Status-Wechsel optimistisch, damit das Abhaken sofort sitzt.
  const changeStatus = (task: Task, status: TaskStatus) => {
    queryClient.setQueryData<{ tasks: Task[]; projects: string[] }>(['tasks'], old => {
      if (!old) return old;
      return {
        ...old,
        tasks: old.tasks.map(t => t.id === task.id
          ? { ...t, status, completed_at: status === 'done' ? new Date().toISOString() : null }
          : t),
      };
    });
    updateMutation.mutate({ id: task.id, input: { status } });
  };

  const toggleSubtask = (subId: string, done: boolean) => {
    queryClient.setQueryData<{ tasks: Task[]; projects: string[] }>(['tasks'], old => {
      if (!old) return old;
      return {
        ...old,
        tasks: old.tasks.map(t => ({
          ...t,
          subtasks: t.subtasks.map(s => s.id === subId ? { ...s, done: done ? 1 : 0 } : s),
        })),
      };
    });
    toggleSubtaskMutation.mutate({ subId, done });
  };

  const quickAdd = () => {
    const parsed = parseQuickInput(quick);
    if (!parsed.title) return;
    createMutation.mutate({
      input: {
        title: parsed.title,
        project: parsed.project || '',
        priority: parsed.priority || 'medium',
        dueDate: parsed.dueDate || null,
      },
      subtasks: [],
    });
    setQuick('');
  };

  const confirmDelete = (task: Task) => {
    if (confirm(`„${task.title}" wirklich löschen?`)) deleteMutation.mutate(task.id);
  };

  // ─── Filter & Kennzahlen ───

  // Erst Suche + Detailfilter (davon leiten sich die Zähler der Chips ab),
  // danach der Schnellfilter — sonst zeigt jeder Chip nur noch sich selbst.
  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter(t => {
      if (projectFilter && t.project !== projectFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.notes || '').toLowerCase().includes(q) ||
        (t.project || '').toLowerCase().includes(q) ||
        t.subtasks.some(s => s.title.toLowerCase().includes(q))
      );
    });
  }, [tasks, search, projectFilter, priorityFilter]);

  const counts = useMemo(() => ({
    all: scoped.length,
    open: scoped.filter(t => t.status === 'open').length,
    doing: scoped.filter(t => t.status === 'doing').length,
    today: scoped.filter(isDueToday).length,
    overdue: scoped.filter(isOverdue).length,
    done: scoped.filter(t => t.status === 'done').length,
  }), [scoped]);

  const filtered = useMemo(
    () => scoped.filter(t => matchesQuickFilter(t, quickFilter)),
    [scoped, quickFilter],
  );

  const percentDone = counts.all === 0 ? 0 : Math.round((counts.done / counts.all) * 100);

  const activeFilters =
    (projectFilter ? 1 : 0) + (priorityFilter ? 1 : 0) +
    (sort !== 'manual' ? 1 : 0) + (group !== 'status' ? 1 : 0);

  const resetFilters = () => {
    setProjectFilter('');
    setPriorityFilter('');
    changeSort('manual');
    changeGroup('status');
  };

  const byStatus = (status: TaskStatus) => sortTasks(filtered.filter(t => t.status === status), sort);

  // Manuelles Sortieren ergibt nur in der Status-Gruppierung Sinn — sonst
  // stünden Karten unterschiedlicher Spalten in einem Abschnitt.
  const manualOrder = sort === 'manual' && (view === 'board' || group === 'status');
  const dragEnabled = manualOrder && isDesktop;

  // ─── Abschnitte der Listenansicht ───

  const activeTasks = useMemo(() => filtered.filter(t => t.status !== 'done'), [filtered]);
  const doneTasks = useMemo(() => sortTasks(filtered.filter(t => t.status === 'done'), sort), [filtered, sort]);

  const groups: TaskGroup[] = useMemo(() => {
    if (group === 'status') {
      return (['doing', 'open'] as TaskStatus[]).map(status => ({
        key: status,
        label: STATUS_META[status].label,
        dot: STATUS_META[status].dot,
        status,
        tasks: sortTasks(activeTasks.filter(t => t.status === status), sort),
        emptyText: status === 'doing' ? 'Nichts in Arbeit' : 'Keine offenen Aufgaben',
      }));
    }

    if (group === 'due') {
      return DUE_BUCKET_ORDER
        .map(bucket => ({
          key: bucket,
          label: DUE_BUCKET_META[bucket].label,
          dot: DUE_BUCKET_META[bucket].dot,
          tasks: sortTasks(activeTasks.filter(t => dueBucket(t) === bucket), sort),
          emptyText: 'Nichts hier',
        }))
        .filter(g => g.tasks.length > 0);
    }

    const names = Array.from(new Set(activeTasks.map(t => t.project || '')))
      .sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'de')));
    return names.map(name => ({
      key: name || '__none__',
      label: name || 'Ohne Projekt',
      dot: name ? 'bg-accent-light' : 'bg-white/25',
      tasks: sortTasks(activeTasks.filter(t => (t.project || '') === name), sort),
      emptyText: 'Nichts hier',
    }));
  }, [group, activeTasks, sort]);

  // ─── Umsortieren (Drag & Drop am Desktop, Menü auf Touch) ───

  const applyOrder = (items: { id: string; status: TaskStatus; sortOrder: number }[]) => {
    queryClient.setQueryData<{ tasks: Task[]; projects: string[] }>(['tasks'], old => {
      if (!old) return old;
      const map = new Map(items.map(i => [i.id, i]));
      return {
        ...old,
        tasks: old.tasks.map(t => {
          const hit = map.get(t.id);
          if (!hit) return t;
          return {
            ...t,
            status: hit.status,
            sort_order: hit.sortOrder,
            completed_at: hit.status === 'done' ? (t.completed_at ?? new Date().toISOString()) : null,
          };
        }),
      };
    });
    reorderMutation.mutate(items);
  };

  const applyReorder = (id: string, status: TaskStatus, beforeId: string | null) => {
    const dragged = tasks.find(t => t.id === id);
    if (!dragged) return;
    if (dragged.status === status && (beforeId === id || beforeId === null)) {
      // Kein sichtbarer Wechsel, wenn die Karte an ihrer eigenen Position landet.
      const column = tasks.filter(t => t.status === status).sort((a, b) => a.sort_order - b.sort_order);
      if (beforeId === null && column[column.length - 1]?.id === id) return;
      if (beforeId === id) return;
    }

    const column = tasks
      .filter(t => t.status === status && t.id !== id)
      .sort((a, b) => a.sort_order - b.sort_order);
    const idx = beforeId ? column.findIndex(t => t.id === beforeId) : -1;
    const insertAt = idx < 0 ? column.length : idx;
    const nextOrder = [...column.slice(0, insertAt), dragged, ...column.slice(insertAt)];
    applyOrder(nextOrder.map((t, i) => ({ id: t.id, status, sortOrder: i })));
  };

  /** Zwei benachbarte *sichtbare* Karten tauschen — auch wenn dazwischen gefilterte liegen. */
  const moveWithin = (list: Task[], index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const a = list[index];
    const b = list[target];
    if (a.status !== b.status) return;

    const column = tasks.filter(t => t.status === a.status).sort((x, y) => x.sort_order - y.sort_order);
    const ia = column.findIndex(t => t.id === a.id);
    const ib = column.findIndex(t => t.id === b.id);
    if (ia < 0 || ib < 0) return;

    const next = [...column];
    next[ia] = b;
    next[ib] = a;
    applyOrder(next.map((t, i) => ({ id: t.id, status: a.status, sortOrder: i })));
  };

  const handleDrop = (status: TaskStatus) => {
    if (!dragId) return;
    const beforeId = dropTarget && dropTarget.status === status ? dropTarget.beforeId : null;
    applyReorder(dragId, status, beforeId);
    setDragId(null);
    setDropTarget(null);
  };

  // ─── Darstellung ───

  const renderList = (list: Task[], emptyText: string, status?: TaskStatus) => {
    const dropActive = !!status && dragEnabled && !!dragId && dropTarget?.status === status;
    return (
      <div
        onDragOver={e => {
          if (status && dragEnabled && dragId) { e.preventDefault(); setDropTarget({ status, beforeId: null }); }
        }}
        onDrop={e => { if (status) { e.preventDefault(); handleDrop(status); } }}
        className={clsx('space-y-2 rounded-xl transition-colors', dropActive && 'bg-accent/[0.04]')}
      >
        {list.length === 0 ? (
          <div className="py-8 text-center">
            <Inbox className="w-6 h-6 mx-auto mb-2 text-white/10" />
            <p className="text-xs text-white/25">{emptyText}</p>
          </div>
        ) : (
          list.map((task, i) => (
            <div key={task.id}>
              {/* Einfüge-Markierung */}
              <div
                className={clsx(
                  'h-[2px] rounded-full transition-all duration-150',
                  dropActive && dropTarget?.beforeId === task.id ? 'bg-accent-light/70 mb-2' : 'bg-transparent'
                )}
              />
              <TaskCard
                task={task}
                onStatusChange={s => changeStatus(task, s)}
                onEdit={() => { setEditing(task); setModalOpen(true); }}
                onDelete={() => confirmDelete(task)}
                onToggleSubtask={toggleSubtask}
                onMove={manualOrder ? dir => moveWithin(list, i, dir) : undefined}
                canMoveUp={i > 0}
                canMoveDown={i < list.length - 1}
                draggable={dragEnabled && !!status}
                dragging={dragId === task.id}
                onDragStart={e => { setDragId(task.id); e.dataTransfer.effectAllowed = 'move'; }}
                onDragEnd={() => { setDragId(null); setDropTarget(null); }}
                onDragOver={e => {
                  if (!status || !dragEnabled || !dragId || dragId === task.id) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setDropTarget({ status, beforeId: task.id });
                }}
              />
            </div>
          ))
        )}
      </div>
    );
  };

  const chips: { id: QuickFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Alle', count: counts.all },
    { id: 'open', label: 'Offen', count: counts.open },
    { id: 'doing', label: 'In Arbeit', count: counts.doing },
    { id: 'today', label: 'Heute', count: counts.today },
    { id: 'overdue', label: 'Überfällig', count: counts.overdue },
    { id: 'done', label: 'Erledigt', count: counts.done },
  ];

  const doneSection = (
    <div>
      <div className="flex items-center gap-2 mb-2.5 px-1">
        <button
          onClick={() => setDoneOpen(v => !v)}
          className="flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white transition-colors py-1"
        >
          <span className={clsx('w-2 h-2 rounded-full', STATUS_META.done.dot)} />
          Erledigt
          <span className="text-xs text-white/25 font-normal">{doneTasks.length}</span>
          <ChevronDown className={clsx('w-3.5 h-3.5 text-white/30 transition-transform', doneOpen && 'rotate-180')} />
        </button>
        {doneTasks.length > 0 && doneOpen && (
          <button
            onClick={() => { if (confirm('Alle erledigten Aufgaben löschen?')) clearDoneMutation.mutate(); }}
            className="ml-auto flex items-center gap-1.5 text-[11px] text-white/30 hover:text-red-300 transition-colors py-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Aufräumen
          </button>
        )}
      </div>
      {doneOpen && (
        <GlassCard delay={0.05}>
          {renderList(doneTasks, 'Noch nichts erledigt', group === 'status' ? 'done' : undefined)}
        </GlassCard>
      )}
    </div>
  );

  return (
    <PageTransition>
      <PageHeader
        title="Aufgaben"
        subtitle="Priorität, Fälligkeit, Projekte, Checklisten"
        icon={<ListChecks className="w-5 h-5" />}
        actions={
          <button
            onClick={() => { setEditing(null); setModalOpen(true); }}
            className="btn-primary flex items-center gap-1.5"
            title="Neue Aufgabe"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Neue Aufgabe</span>
          </button>
        }
      />

      <div className="space-y-4">
        {/* Kommandozentrale: erfassen, Fortschritt, Schnellfilter — eine Karte statt drei Blöcke */}
        <GlassCard>
          <div className="flex items-center gap-2">
            <input
              className="glass-input flex-1 min-w-0"
              placeholder="Neue Aufgabe hinzufügen..."
              value={quick}
              onChange={e => setQuick(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); quickAdd(); } }}
            />
            <button
              onClick={quickAdd}
              disabled={!quick.trim() || createMutation.isPending}
              className="btn-primary disabled:opacity-30 flex-shrink-0 flex items-center gap-1.5 px-3 sm:px-4"
              title="Aufgabe anlegen"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Anlegen</span>
            </button>
          </div>
          <p className="text-[10px] text-white/25 mt-2">
            <span className="text-white/40">@Projekt</span> · <span className="text-white/40">!hoch</span> ·{' '}
            <span className="text-white/40">heute/morgen</span> werden erkannt
          </p>

          {counts.all > 0 && (
            <>
              <div className="gradient-separator my-3.5" />

              {/* Fortschritt */}
              <div className="flex items-center gap-3">
                <div className="h-1.5 flex-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400/70 to-emerald-300/70 transition-all duration-500"
                    style={{ width: `${percentDone}%` }}
                  />
                </div>
                <span className="text-[11px] text-white/35 tabular-nums flex-shrink-0">
                  {counts.done}/{counts.all} erledigt
                </span>
              </div>

              {/* Schnellfilter — mobil waagerecht scrollbar statt umbrechend */}
              <div className="flex gap-1.5 mt-3 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
                {chips.map(chip => {
                  const active = quickFilter === chip.id;
                  return (
                    <button
                      key={chip.id}
                      onClick={() => setQuickFilter(chip.id)}
                      className={clsx(
                        'flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] transition-colors',
                        active
                          ? CHIP_STYLES[chip.id]
                          : 'bg-white/[0.02] border-white/[0.06] text-white/40 hover:text-white/70 hover:border-white/[0.12]'
                      )}
                    >
                      {chip.label}
                      <span className={clsx('tabular-nums text-[11px]', active ? 'opacity-80' : 'text-white/25')}>
                        {chip.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </GlassCard>

        {/* Werkzeugleiste: Suche, Filter-Ausklapper, Ansicht */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
              <input
                className="glass-input w-full pl-9 pr-8"
                placeholder="Suchen..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-white/25 hover:text-white/60"
                  aria-label="Suche leeren"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={() => setShowFilters(v => !v)}
              className={clsx(
                'flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm transition-colors',
                showFilters || activeFilters > 0
                  ? 'bg-accent/12 border-accent/30 text-accent-light'
                  : 'bg-white/[0.03] border-white/[0.06] text-white/45 hover:text-white/75'
              )}
              title="Filter und Sortierung"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Filter</span>
              {activeFilters > 0 && (
                <span className="text-[10px] tabular-nums w-4 h-4 rounded-full bg-accent/25 flex items-center justify-center">
                  {activeFilters}
                </span>
              )}
            </button>

            <div className="flex-shrink-0 flex gap-1 p-1 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              {([
                { id: 'list' as ViewMode, icon: <LayoutList className="w-4 h-4" />, title: 'Listenansicht' },
                { id: 'board' as ViewMode, icon: <Columns3 className="w-4 h-4" />, title: 'Board-Ansicht' },
              ]).map(v => (
                <button
                  key={v.id}
                  onClick={() => changeView(v.id)}
                  title={v.title}
                  aria-label={v.title}
                  className={clsx(
                    'w-9 h-9 flex items-center justify-center rounded-lg transition-colors',
                    view === v.id ? 'bg-white/[0.08] text-white' : 'text-white/35 hover:text-white/70'
                  )}
                >
                  {v.icon}
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence initial={false}>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <label className="block">
                    <span className="block text-[10px] uppercase tracking-widest text-white/25 mb-1">Projekt</span>
                    <select className="glass-input py-2 w-full" value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>
                      <option value="">Alle Projekte</option>
                      {projects.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>

                  <label className="block">
                    <span className="block text-[10px] uppercase tracking-widest text-white/25 mb-1">Priorität</span>
                    <select
                      className="glass-input py-2 w-full"
                      value={priorityFilter}
                      onChange={e => setPriorityFilter(e.target.value as '' | TaskPriority)}
                    >
                      <option value="">Jede Priorität</option>
                      {PRIORITY_ORDER.map(p => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
                    </select>
                  </label>

                  <label className="block">
                    <span className="block text-[10px] uppercase tracking-widest text-white/25 mb-1">Sortierung</span>
                    <select className="glass-input py-2 w-full" value={sort} onChange={e => changeSort(e.target.value as SortMode)}>
                      {(Object.keys(SORT_LABELS) as SortMode[]).map(m => (
                        <option key={m} value={m}>{SORT_LABELS[m]}</option>
                      ))}
                    </select>
                  </label>

                  <label className={clsx('block', view === 'board' && 'opacity-40')}>
                    <span className="block text-[10px] uppercase tracking-widest text-white/25 mb-1">Gruppierung</span>
                    <select
                      className="glass-input py-2 w-full"
                      value={group}
                      disabled={view === 'board'}
                      onChange={e => changeGroup(e.target.value as GroupMode)}
                    >
                      {(Object.keys(GROUP_LABELS) as GroupMode[]).map(m => (
                        <option key={m} value={m}>{GROUP_LABELS[m]}</option>
                      ))}
                    </select>
                  </label>

                  {activeFilters > 0 && (
                    <button
                      onClick={resetFilters}
                      className="sm:col-span-2 lg:col-span-4 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] text-white/40 hover:text-white/80 hover:bg-white/[0.04] transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Filter zurücksetzen
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {isLoading && <p className="text-sm text-white/30 text-center py-8">Lade Aufgaben...</p>}

        {!isLoading && tasks.length === 0 && (
          <GlassCard delay={0.2}>
            <div className="py-10 text-center">
              <ListChecks className="w-8 h-8 mx-auto mb-3 text-white/10" />
              <p className="text-sm text-white/40">Noch keine Aufgaben</p>
              <p className="text-xs text-white/25 mt-1">Oben eintragen und mit Enter anlegen.</p>
            </div>
          </GlassCard>
        )}

        {!isLoading && tasks.length > 0 && filtered.length === 0 && (
          <GlassCard delay={0.2}>
            <div className="py-10 text-center">
              <Search className="w-8 h-8 mx-auto mb-3 text-white/10" />
              <p className="text-sm text-white/40">Keine Aufgabe passt zum Filter</p>
              <button
                onClick={() => { setQuickFilter('all'); setSearch(''); resetFilters(); }}
                className="text-xs text-accent-light/80 hover:text-accent-light mt-2"
              >
                Alles anzeigen
              </button>
            </div>
          </GlassCard>
        )}

        {!isLoading && filtered.length > 0 && view === 'list' && (
          <div className="space-y-5">
            {groups.map((g, i) => (
              <div key={g.key}>
                <div className="flex items-center gap-2 mb-2.5 px-1">
                  <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', g.dot)} />
                  <h2 className="text-sm font-semibold truncate">{g.label}</h2>
                  <span className="text-xs text-white/25 flex-shrink-0">{g.tasks.length}</span>
                </div>
                <GlassCard delay={0.15 + i * 0.04}>
                  {renderList(g.tasks, g.emptyText, g.status)}
                </GlassCard>
              </div>
            ))}

            {quickFilter !== 'done' && doneSection}
            {quickFilter === 'done' && (
              <GlassCard delay={0.15}>{renderList(doneTasks, 'Noch nichts erledigt', 'done')}</GlassCard>
            )}
          </div>
        )}

        {/* Board — am Desktop drei Spalten, mobil waagerecht durchwischbar */}
        {!isLoading && filtered.length > 0 && view === 'board' && (
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide -mx-4 px-4 pb-1 md:mx-0 md:px-0 md:pb-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible items-stretch">
            {BOARD_COLUMNS.map((status, i) => {
              const list = byStatus(status);
              return (
                <div key={status} className="snap-center flex-shrink-0 w-[86%] max-w-[22rem] md:w-auto md:max-w-none md:flex-shrink">
                  <GlassCard delay={0.15 + i * 0.05} className="h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={clsx('w-2 h-2 rounded-full', STATUS_META[status].dot)} />
                      <h2 className="text-sm font-semibold">{STATUS_META[status].label}</h2>
                      <span className="text-xs text-white/25">{list.length}</span>
                      {status === 'done' && list.length > 0 && (
                        <button
                          onClick={() => { if (confirm('Alle erledigten Aufgaben löschen?')) clearDoneMutation.mutate(); }}
                          className="ml-auto p-1.5 rounded-lg text-white/20 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                          title="Erledigte aufräumen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {/* Mindesthöhe nur am Desktop — mobil erzeugt sie leere Flächen */}
                    <div className="flex-1 md:min-h-[240px]">
                      {renderList(
                        list,
                        status === 'done' ? 'Noch nichts erledigt' : dragEnabled ? 'Leer — Karten hierher ziehen' : 'Leer',
                        status,
                      )}
                    </div>
                  </GlassCard>
                </div>
              );
            })}
          </div>
        )}

        {isDesktop && !dragEnabled && view === 'board' && (
          <p className="text-[11px] text-white/25 text-center">
            Zum Sortieren per Drag &amp; Drop die Sortierung auf „{SORT_LABELS.manual}" stellen.
          </p>
        )}
      </div>

      <TaskModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        task={editing ? (tasks.find(t => t.id === editing.id) ?? editing) : null}
        projects={projects}
        saving={createMutation.isPending || saveMutation.isPending}
        onSave={(input, newSubtasks) => {
          if (editing) saveMutation.mutate({ id: editing.id, input });
          else createMutation.mutate({ input, subtasks: newSubtasks });
        }}
        onAddSubtask={(taskId, title) => addSubtaskMutation.mutate({ taskId, title })}
        onToggleSubtask={toggleSubtask}
        onDeleteSubtask={subId => deleteSubtaskMutation.mutate(subId)}
      />
    </PageTransition>
  );
}
