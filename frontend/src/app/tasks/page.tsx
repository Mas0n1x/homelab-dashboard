/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import {
  ListChecks, Plus, Search, LayoutList, Columns3, Circle, Play,
  CalendarClock, AlertTriangle, Trash2, ChevronDown, Inbox,
} from 'lucide-react';
import { PageTransition } from '@/components/ui/PageTransition';
import { PageHeader } from '@/components/ui/PageHeader';
import { GlassCard } from '@/components/ui/GlassCard';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskModal } from '@/components/tasks/TaskModal';
import {
  PRIORITY_META, PRIORITY_ORDER, STATUS_META, SORT_LABELS,
  isDueToday, isOverdue, parseQuickInput, sortTasks, type SortMode,
} from '@/components/tasks/taskUtils';
import * as api from '@/lib/api';
import type { Task, TaskInput, TaskPriority, TaskStatus } from '@/lib/types';

type ViewMode = 'list' | 'board';

interface DropTarget {
  status: TaskStatus;
  beforeId: string | null;
}

const BOARD_COLUMNS: TaskStatus[] = ['open', 'doing', 'done'];

export default function TasksPage() {
  const queryClient = useQueryClient();

  const [view, setView] = useState<ViewMode>('list');
  const [sort, setSort] = useState<SortMode>('manual');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'' | TaskPriority>('');
  const [doneOpen, setDoneOpen] = useState(false);
  const [quick, setQuick] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  // Drag & Drop gibt es nur mit Maus — HTML5-DnD löst auf Touch nichts aus,
  // ein Griff-Symbol wäre dort ein leeres Versprechen.
  const [isDesktop, setIsDesktop] = useState(false);

  // Ansicht pro Browser merken
  useEffect(() => {
    const saved = localStorage.getItem('tasks-view');
    if (saved === 'board' || saved === 'list') setView(saved);

    const mq = window.matchMedia('(min-width: 768px) and (pointer: fine)');
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  const changeView = (next: ViewMode) => {
    setView(next);
    localStorage.setItem('tasks-view', next);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => api.getTasks(),
    staleTime: 10000,
  });

  const tasks = data?.tasks ?? [];
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

  // ─── Filter & Kennzahlen ───

  const filtered = useMemo(() => {
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

  const stats = useMemo(() => ({
    open: filtered.filter(t => t.status === 'open').length,
    doing: filtered.filter(t => t.status === 'doing').length,
    today: filtered.filter(isDueToday).length,
    overdue: filtered.filter(isOverdue).length,
    done: filtered.filter(t => t.status === 'done').length,
  }), [filtered]);

  const byStatus = (status: TaskStatus) => sortTasks(filtered.filter(t => t.status === status), sort);

  const dragEnabled = sort === 'manual' && isDesktop;

  // ─── Drag & Drop ───

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
    const items = nextOrder.map((t, i) => ({ id: t.id, status, sortOrder: i }));

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

  const handleDrop = (status: TaskStatus) => {
    if (!dragId) return;
    const beforeId = dropTarget && dropTarget.status === status ? dropTarget.beforeId : null;
    applyReorder(dragId, status, beforeId);
    setDragId(null);
    setDropTarget(null);
  };

  const cardHandlers = (task: Task) => ({
    onStatusChange: (status: TaskStatus) => changeStatus(task, status),
    onEdit: () => { setEditing(task); setModalOpen(true); },
    onDelete: () => deleteMutation.mutate(task.id),
    onToggleSubtask: toggleSubtask,
  });

  const renderTaskList = (status: TaskStatus, list: Task[], emptyText: string) => (
    <div
      onDragOver={e => { if (dragEnabled && dragId) { e.preventDefault(); setDropTarget({ status, beforeId: null }); } }}
      onDrop={e => { e.preventDefault(); handleDrop(status); }}
      className={clsx(
        'space-y-2 rounded-xl transition-colors',
        dragId && dragEnabled && dropTarget?.status === status && 'bg-accent/[0.04]'
      )}
    >
      {list.length === 0 ? (
        <div className="py-8 text-center">
          <Inbox className="w-6 h-6 mx-auto mb-2 text-white/10" />
          <p className="text-xs text-white/25">{emptyText}</p>
        </div>
      ) : (
        list.map(task => (
          <div key={task.id}>
            {/* Einfüge-Markierung */}
            <div
              className={clsx(
                'h-[2px] rounded-full transition-all duration-150',
                dragId && dragEnabled && dropTarget?.status === status && dropTarget.beforeId === task.id
                  ? 'bg-accent-light/70 mb-2'
                  : 'bg-transparent'
              )}
            />
            <TaskCard
              task={task}
              {...cardHandlers(task)}
              draggable={dragEnabled}
              dragging={dragId === task.id}
              onDragStart={e => { setDragId(task.id); e.dataTransfer.effectAllowed = 'move'; }}
              onDragEnd={() => { setDragId(null); setDropTarget(null); }}
              onDragOver={e => {
                if (!dragEnabled || !dragId || dragId === task.id) return;
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

  const statCards = [
    { label: 'Offen', value: stats.open, icon: <Circle className="w-4 h-4" />, tone: 'text-white/50', bg: 'bg-white/[0.06]' },
    { label: 'In Arbeit', value: stats.doing, icon: <Play className="w-4 h-4" />, tone: 'text-cyan-300', bg: 'bg-cyan-500/12' },
    { label: 'Heute fällig', value: stats.today, icon: <CalendarClock className="w-4 h-4" />, tone: 'text-amber-300', bg: 'bg-amber-500/12' },
    { label: 'Überfällig', value: stats.overdue, icon: <AlertTriangle className="w-4 h-4" />, tone: 'text-red-300', bg: 'bg-red-500/12' },
  ];

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

      <div className="space-y-5">
        {/* Kennzahlen */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 [&>*]:h-full">
          {statCards.map((card, i) => (
            <GlassCard key={card.label} delay={i * 0.04} className="h-full">
              <div className="flex items-center gap-3">
                <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', card.bg, card.tone)}>
                  {card.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-bold tabular-nums leading-none">{card.value}</p>
                  <p className="text-[11px] text-white/35 mt-1 truncate">{card.label}</p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>

        {/* Schnell-Eingabe */}
        <GlassCard delay={0.16}>
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
            <span className="text-white/40">@Projekt</span> · <span className="text-white/40">!hoch</span> · <span className="text-white/40">heute/morgen</span> werden erkannt
          </p>
        </GlassCard>

        {/* Werkzeugleiste */}
        <div className="space-y-2 lg:space-y-0 lg:flex lg:items-center lg:gap-3">
          <div className="relative lg:flex-1 lg:min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
            <input
              className="glass-input w-full pl-9"
              placeholder="Aufgaben durchsuchen..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Mobil: zwei gleich breite Spalten, damit nichts ausfranst */}
          <div className="grid grid-cols-2 gap-2 lg:flex lg:items-center">
            <select className="glass-input py-2 w-full lg:w-auto" value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>
              <option value="">Alle Projekte</option>
              {projects.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            <select
              className="glass-input py-2 w-full lg:w-auto"
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value as '' | TaskPriority)}
            >
              <option value="">Jede Priorität</option>
              {PRIORITY_ORDER.map(p => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
            </select>

            <select className="glass-input py-2 w-full col-span-2 lg:w-auto lg:col-span-1" value={sort} onChange={e => setSort(e.target.value as SortMode)}>
              {(Object.keys(SORT_LABELS) as SortMode[]).map(m => (
                <option key={m} value={m}>{SORT_LABELS[m]}</option>
              ))}
            </select>

            {/* Ansicht */}
            <div className="col-span-2 flex gap-1 p-1 rounded-xl bg-white/[0.02] border border-white/[0.05] lg:col-span-1">
              {([
                { id: 'list' as ViewMode, icon: <LayoutList className="w-4 h-4" />, label: 'Liste', title: 'Listenansicht' },
                { id: 'board' as ViewMode, icon: <Columns3 className="w-4 h-4" />, label: 'Board', title: 'Board-Ansicht' },
              ]).map(v => (
                <button
                  key={v.id}
                  onClick={() => changeView(v.id)}
                  title={v.title}
                  className={clsx(
                    'flex-1 lg:flex-initial flex items-center justify-center gap-1.5 p-2 rounded-lg transition-colors text-xs',
                    view === v.id ? 'bg-white/[0.08] text-white' : 'text-white/35 hover:text-white/70'
                  )}
                >
                  {v.icon}
                  <span className="lg:hidden">{v.label}</span>
                </button>
              ))}
            </div>
          </div>
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

        {!isLoading && tasks.length > 0 && view === 'list' && (
          <div className="space-y-5">
            {(['doing', 'open'] as TaskStatus[]).map((status, i) => {
              const list = byStatus(status);
              return (
                <div key={status}>
                  <div className="flex items-center gap-2 mb-2.5 px-1">
                    <span className={clsx('w-2 h-2 rounded-full', STATUS_META[status].dot)} />
                    <h2 className="text-sm font-semibold">{STATUS_META[status].label}</h2>
                    <span className="text-xs text-white/25">{list.length}</span>
                  </div>
                  <GlassCard delay={0.2 + i * 0.05}>
                    {renderTaskList(status, list, status === 'doing' ? 'Nichts in Arbeit' : 'Keine offenen Aufgaben')}
                  </GlassCard>
                </div>
              );
            })}

            {/* Erledigt (einklappbar) */}
            <div>
              <div className="flex items-center gap-2 mb-2.5 px-1">
                <button
                  onClick={() => setDoneOpen(v => !v)}
                  className="flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white transition-colors"
                >
                  <span className={clsx('w-2 h-2 rounded-full', STATUS_META.done.dot)} />
                  Erledigt
                  <span className="text-xs text-white/25 font-normal">{stats.done}</span>
                  <ChevronDown className={clsx('w-3.5 h-3.5 text-white/30 transition-transform', doneOpen && 'rotate-180')} />
                </button>
                {stats.done > 0 && doneOpen && (
                  <button
                    onClick={() => { if (confirm('Alle erledigten Aufgaben löschen?')) clearDoneMutation.mutate(); }}
                    className="ml-auto flex items-center gap-1.5 text-[11px] text-white/30 hover:text-red-300 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Aufräumen
                  </button>
                )}
              </div>
              {doneOpen && (
                <GlassCard delay={0.05}>
                  {renderTaskList('done', byStatus('done'), 'Noch nichts erledigt')}
                </GlassCard>
              )}
            </div>
          </div>
        )}

        {!isLoading && tasks.length > 0 && view === 'board' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 [&>*]:h-full items-stretch">
            {BOARD_COLUMNS.map((status, i) => {
              const list = byStatus(status);
              return (
                <GlassCard key={status} delay={0.2 + i * 0.05} className="h-full flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={clsx('w-2 h-2 rounded-full', STATUS_META[status].dot)} />
                    <h2 className="text-sm font-semibold">{STATUS_META[status].label}</h2>
                    <span className="text-xs text-white/25">{list.length}</span>
                    {status === 'done' && list.length > 0 && (
                      <button
                        onClick={() => { if (confirm('Alle erledigten Aufgaben löschen?')) clearDoneMutation.mutate(); }}
                        className="ml-auto p-1 rounded-lg text-white/20 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                        title="Erledigte aufräumen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {/* Mindesthöhe nur am Desktop — mobil würde sie leere Flächen erzeugen */}
                  <div className="flex-1 md:min-h-[240px]">
                    {renderTaskList(status, list, status === 'done' ? 'Noch nichts erledigt' : dragEnabled ? 'Leer — Karten hierher ziehen' : 'Leer')}
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}

        {isDesktop && !dragEnabled && view === 'board' && (
          <p className="text-[11px] text-white/25 text-center">
            Sortierung „{SORT_LABELS[sort]}" aktiv — für eigenes Sortieren per Drag &amp; Drop auf „{SORT_LABELS.manual}" umstellen.
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
