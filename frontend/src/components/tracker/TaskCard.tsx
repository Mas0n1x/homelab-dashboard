'use client';

import { Clock, GripVertical, CheckCircle2, ChevronRight } from 'lucide-react';
import type { TrackerTask } from '@/lib/types';

const CATEGORY_COLORS: Record<string, string> = {
  arbeit: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  privat: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  lernen: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  sport: 'bg-red-500/20 text-red-300 border-red-500/30',
  projekt: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

const CATEGORY_NAMES: Record<string, string> = {
  arbeit: 'Arbeit',
  privat: 'Privat',
  lernen: 'Lernen',
  sport: 'Sport',
  projekt: 'Projekt',
};

interface TaskCardProps {
  task: TrackerTask;
  onClick: () => void;
  onMoveToColumn?: (status: string) => void;
  isDone?: boolean;
}

export function TaskCard({ task, onClick, onMoveToColumn, isDone }: TaskCardProps) {
  const completedSubtasks = task.subtasks.filter(s => s.completed).length;
  const totalSubtasks = task.subtasks.length;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('taskId', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={onClick}
      className="group p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12] transition-all cursor-pointer"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-3.5 h-3.5 text-white/20 mt-0.5 shrink-0 cursor-grab" />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${isDone ? 'line-through text-white/40' : ''}`}>
            {task.title}
          </p>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {task.category && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-md border ${CATEGORY_COLORS[task.category] || 'bg-white/10 text-white/50'}`}>
                {CATEGORY_NAMES[task.category] || task.category}
              </span>
            )}
            <span className="flex items-center gap-0.5 text-[10px] text-white/30">
              <Clock className="w-3 h-3" />
              {task.estimated_time}min
            </span>
            {totalSubtasks > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-white/30">
                <CheckCircle2 className="w-3 h-3" />
                {completedSubtasks}/{totalSubtasks}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Mobile move buttons */}
      {onMoveToColumn && (
        <div className="flex gap-1 mt-2 md:hidden">
          {task.status !== 'backlog' && (
            <button
              onClick={(e) => { e.stopPropagation(); onMoveToColumn('backlog'); }}
              className="text-[9px] px-2 py-0.5 rounded bg-white/[0.06] text-white/40 hover:text-white/70"
            >
              Backlog
            </button>
          )}
          {task.status !== 'inprogress' && (
            <button
              onClick={(e) => { e.stopPropagation(); onMoveToColumn('inprogress'); }}
              className="text-[9px] px-2 py-0.5 rounded bg-white/[0.06] text-white/40 hover:text-white/70 flex items-center gap-0.5"
            >
              <ChevronRight className="w-2.5 h-2.5" /> Starten
            </button>
          )}
          {task.status !== 'done' && (
            <button
              onClick={(e) => { e.stopPropagation(); onMoveToColumn('done'); }}
              className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
            >
              Erledigt
            </button>
          )}
        </div>
      )}
    </div>
  );
}
