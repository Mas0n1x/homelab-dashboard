/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type { Task, TaskInput, TaskPriority, TaskStatus } from '@/lib/types';
import { PRIORITY_META, PRIORITY_ORDER, STATUS_META, STATUS_ORDER, addDaysISO, todayISO } from './taskUtils';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  projects: string[];
  saving?: boolean;
  onSave: (input: TaskInput, newSubtasks: string[]) => void;
  onAddSubtask: (taskId: string, title: string) => void;
  onToggleSubtask: (subId: string, done: boolean) => void;
  onDeleteSubtask: (subId: string) => void;
}

const EMPTY = { title: '', notes: '', status: 'open' as TaskStatus, priority: 'medium' as TaskPriority, project: '', dueDate: '' };

export function TaskModal({
  isOpen,
  onClose,
  task,
  projects,
  saving = false,
  onSave,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
}: TaskModalProps) {
  const [form, setForm] = useState(EMPTY);
  const [subInput, setSubInput] = useState('');
  // Beim Neuanlegen gibt es noch keine ID — Checklisten-Punkte werden gepuffert.
  const [pendingSubtasks, setPendingSubtasks] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setSubInput('');
    setPendingSubtasks([]);
    setForm(task
      ? {
          title: task.title,
          notes: task.notes || '',
          status: task.status,
          priority: task.priority,
          project: task.project || '',
          dueDate: task.due_date || '',
        }
      : EMPTY);
  }, [isOpen, task]);

  const submit = () => {
    if (!form.title.trim()) return;
    onSave(
      {
        title: form.title.trim(),
        notes: form.notes,
        status: form.status,
        priority: form.priority,
        project: form.project.trim(),
        dueDate: form.dueDate || null,
      },
      pendingSubtasks,
    );
  };

  const addSub = () => {
    const title = subInput.trim();
    if (!title) return;
    if (task) onAddSubtask(task.id, title);
    else setPendingSubtasks(prev => [...prev, title]);
    setSubInput('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={task ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'} size="md">
      <div className="space-y-5">
        {/* Titel */}
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-white/30 mb-1.5">Titel</label>
          <input
            className="glass-input w-full"
            placeholder="Was ist zu tun?"
            value={form.title}
            autoFocus
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
          />
        </div>

        {/* Priorität */}
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-white/30 mb-1.5">Priorität</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PRIORITY_ORDER.map(p => (
              <button
                key={p}
                onClick={() => setForm(f => ({ ...f, priority: p }))}
                className={clsx(
                  'px-2 py-2 rounded-xl border text-xs font-medium transition-all duration-200 flex items-center justify-center gap-1.5',
                  form.priority === p
                    ? PRIORITY_META[p].chip + ' ring-1 ring-white/15'
                    : 'bg-white/[0.02] border-white/[0.06] text-white/40 hover:text-white/70 hover:border-white/[0.12]'
                )}
              >
                <span className={clsx('w-1.5 h-1.5 rounded-full', PRIORITY_META[p].dot)} />
                {PRIORITY_META[p].label}
              </button>
            ))}
          </div>
        </div>

        {/* Status + Projekt */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-white/30 mb-1.5">Status</label>
            <select
              className="glass-input w-full"
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as TaskStatus }))}
            >
              {STATUS_ORDER.map(s => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-widest text-white/30 mb-1.5">Projekt</label>
            <input
              className="glass-input w-full"
              placeholder="z. B. LawNet"
              list="task-projects"
              value={form.project}
              onChange={e => setForm(f => ({ ...f, project: e.target.value }))}
            />
            <datalist id="task-projects">
              {projects.map(p => <option key={p} value={p} />)}
            </datalist>
          </div>
        </div>

        {/* Fälligkeit */}
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-white/30 mb-1.5">Fällig am</label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              className="glass-input w-full sm:w-auto"
              value={form.dueDate}
              onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
            />
            {[
              { label: 'Heute', value: todayISO() },
              { label: 'Morgen', value: addDaysISO(1) },
              { label: 'In 7 Tagen', value: addDaysISO(7) },
            ].map(q => (
              <button
                key={q.label}
                onClick={() => setForm(f => ({ ...f, dueDate: q.value }))}
                className={clsx(
                  'px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors',
                  form.dueDate === q.value
                    ? 'bg-accent/15 border-accent/30 text-accent-light'
                    : 'bg-white/[0.02] border-white/[0.06] text-white/45 hover:text-white/75'
                )}
              >
                {q.label}
              </button>
            ))}
            {form.dueDate && (
              <button
                onClick={() => setForm(f => ({ ...f, dueDate: '' }))}
                className="px-2 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-white/35 hover:text-red-300 hover:border-red-500/25 transition-colors"
                title="Fälligkeit entfernen"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Notizen */}
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-white/30 mb-1.5">Notizen</label>
          <textarea
            className="glass-input w-full min-h-[90px] resize-y"
            placeholder="Details, Links, Kontext..."
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          />
        </div>

        {/* Checkliste */}
        <div>
          <label className="block text-[11px] uppercase tracking-widest text-white/30 mb-1.5">Checkliste</label>
          <div className="space-y-1.5">
            {task?.subtasks.map(sub => (
              <div key={sub.id} className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                <button
                  onClick={() => onToggleSubtask(sub.id, !sub.done)}
                  className={clsx(
                    'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                    sub.done ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300' : 'border-white/20 text-transparent hover:border-accent-light'
                  )}
                >
                  <Check className="w-2.5 h-2.5" />
                </button>
                <span className={clsx('flex-1 text-xs truncate', sub.done ? 'line-through text-white/30' : 'text-white/70')}>
                  {sub.title}
                </span>
                <button
                  onClick={() => onDeleteSubtask(sub.id)}
                  className="p-1 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}

            {pendingSubtasks.map((title, i) => (
              <div key={`pending-${i}`} className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                <span className="w-4 h-4 rounded border border-white/20 flex-shrink-0" />
                <span className="flex-1 text-xs text-white/70 truncate">{title}</span>
                <button
                  onClick={() => setPendingSubtasks(prev => prev.filter((_, idx) => idx !== i))}
                  className="p-1 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}

            <div className="flex items-center gap-2">
              <input
                className="glass-input flex-1 text-xs"
                placeholder="Punkt hinzufügen..."
                value={subInput}
                onChange={e => setSubInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSub(); } }}
              />
              <button
                onClick={addSub}
                disabled={!subInput.trim()}
                className="btn-primary px-3 py-2 disabled:opacity-30"
                title="Punkt hinzufügen"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Aktionen */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2.5 sm:py-2 rounded-xl text-sm text-white/50 hover:text-white/80 hover:bg-white/[0.05] transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={submit}
            disabled={!form.title.trim() || saving}
            className="btn-primary py-2.5 sm:py-2 disabled:opacity-30"
          >
            {saving ? 'Speichert...' : task ? 'Speichern' : 'Aufgabe anlegen'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
