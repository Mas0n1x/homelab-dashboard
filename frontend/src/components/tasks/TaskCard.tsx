/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import {
  Check, Circle, CalendarDays, Folder, Pencil, Trash2, GripVertical,
  ChevronDown, ListChecks, Play, RotateCcw,
} from 'lucide-react';
import type { Task, TaskStatus } from '@/lib/types';
import { PRIORITY_META, dueMeta, subtaskProgress } from './taskUtils';

interface TaskCardProps {
  task: Task;
  onStatusChange: (status: TaskStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleSubtask: (subId: string, done: boolean) => void;
  draggable?: boolean;
  dragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
}

export function TaskCard({
  task,
  onStatusChange,
  onEdit,
  onDelete,
  onToggleSubtask,
  draggable = false,
  dragging = false,
  onDragStart,
  onDragEnd,
  onDragOver,
}: TaskCardProps) {
  const [showSubtasks, setShowSubtasks] = useState(false);
  const done = task.status === 'done';
  const prio = PRIORITY_META[task.priority];
  const due = done ? null : dueMeta(task.due_date);
  const progress = subtaskProgress(task);

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      className={clsx(
        'group relative rounded-xl border bg-white/[0.02] border-white/[0.06] p-3 transition-all duration-200',
        'hover:bg-white/[0.045] hover:border-white/[0.12]',
        dragging && 'opacity-40',
        done && 'opacity-60',
        draggable && 'cursor-grab active:cursor-grabbing'
      )}
    >
      {/* Prioritäts-Kante */}
      <span className={clsx('absolute left-0 top-3 bottom-3 w-[3px] rounded-full', prio.dot, done && 'opacity-30')} />

      <div className="flex items-start gap-2.5 pl-2">
        {/* Abschluss-Checkbox */}
        <button
          onClick={() => onStatusChange(done ? 'open' : 'done')}
          title={done ? 'Wieder öffnen' : 'Als erledigt markieren'}
          className={clsx(
            'mt-0.5 w-[18px] h-[18px] rounded-full border flex items-center justify-center flex-shrink-0 transition-all duration-200',
            done
              ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
              : 'border-white/25 text-transparent hover:border-accent-light hover:bg-accent/10'
          )}
        >
          {done ? <Check className="w-3 h-3" /> : <Circle className="w-2 h-2 opacity-0" />}
        </button>

        <div className="flex-1 min-w-0">
          <p
            className={clsx(
              'text-[13px] font-medium leading-snug break-words',
              done ? 'line-through text-white/40' : 'text-white/90'
            )}
          >
            {task.title}
          </p>

          {task.notes && (
            <p className="text-[11px] text-white/35 mt-1 line-clamp-2 whitespace-pre-wrap break-words">
              {task.notes}
            </p>
          )}

          {/* Meta-Chips */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-md border', prio.chip)}>
              {prio.label}
            </span>
            {task.project && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md border bg-white/[0.04] border-white/[0.08] text-white/50 flex items-center gap-1 max-w-[10rem]">
                <Folder className="w-2.5 h-2.5 flex-shrink-0" />
                <span className="truncate">{task.project}</span>
              </span>
            )}
            {due && (
              <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-md border flex items-center gap-1', due.className)}>
                <CalendarDays className="w-2.5 h-2.5" />
                {due.label}
              </span>
            )}
            {progress.total > 0 && (
              <button
                onClick={() => setShowSubtasks(v => !v)}
                className="text-[10px] px-1.5 py-0.5 rounded-md border bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white/80 hover:border-white/[0.15] flex items-center gap-1 transition-colors"
              >
                <ListChecks className="w-2.5 h-2.5" />
                {progress.done}/{progress.total}
                <ChevronDown className={clsx('w-2.5 h-2.5 transition-transform', showSubtasks && 'rotate-180')} />
              </button>
            )}
          </div>

          {/* Fortschrittsbalken der Checkliste */}
          {progress.total > 0 && (
            <div className="mt-2 h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-accent-light/70 transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          )}

          {/* Checkliste */}
          {showSubtasks && progress.total > 0 && (
            <div className="mt-2 space-y-1">
              {task.subtasks.map(sub => (
                <button
                  key={sub.id}
                  onClick={() => onToggleSubtask(sub.id, !sub.done)}
                  className="w-full flex items-center gap-2 px-1.5 py-1 rounded-lg text-left hover:bg-white/[0.04] transition-colors"
                >
                  <span
                    className={clsx(
                      'w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0',
                      sub.done ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300' : 'border-white/20 text-transparent'
                    )}
                  >
                    <Check className="w-2.5 h-2.5" />
                  </span>
                  <span className={clsx('text-[11px] truncate', sub.done ? 'line-through text-white/30' : 'text-white/60')}>
                    {sub.title}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Aktionen */}
        <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {task.status === 'open' && (
            <button
              onClick={() => onStatusChange('doing')}
              title="In Arbeit nehmen"
              className="p-1 rounded-lg text-white/25 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}
          {task.status === 'doing' && (
            <button
              onClick={() => onStatusChange('open')}
              title="Zurück zu Offen"
              className="p-1 rounded-lg text-white/25 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onEdit}
            title="Bearbeiten"
            className="p-1 rounded-lg text-white/25 hover:text-accent-light hover:bg-accent/10 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            title="Löschen"
            className="p-1 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {draggable && (
            <span className="p-1 text-white/15" title="Ziehen zum Sortieren">
              <GripVertical className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
