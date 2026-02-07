'use client';

import { Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { clearDoneTasks } from '@/lib/api';
import { useTrackerStore } from '@/stores/trackerStore';
import { KanbanColumn } from './KanbanColumn';
import type { TrackerTask } from '@/lib/types';

interface KanbanBoardProps {
  tasks: TrackerTask[];
}

export function KanbanBoard({ tasks }: KanbanBoardProps) {
  const { setTaskModalId } = useTrackerStore();
  const queryClient = useQueryClient();

  const clearMutation = useMutation({
    mutationFn: clearDoneTasks,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracker-tasks'] });
    },
  });

  const backlog = tasks.filter(t => t.status === 'backlog');
  const inProgress = tasks.filter(t => t.status === 'inprogress');
  const done = tasks.filter(t => t.status === 'done');

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <KanbanColumn
          title="Backlog"
          status="backlog"
          tasks={backlog}
          onTaskClick={(id) => setTaskModalId(id)}
          accentColor="bg-white/40"
        />
        <KanbanColumn
          title="In Arbeit"
          status="inprogress"
          tasks={inProgress}
          onTaskClick={(id) => setTaskModalId(id)}
          accentColor="bg-indigo-400"
        />
        <KanbanColumn
          title="Erledigt"
          status="done"
          tasks={done}
          onTaskClick={(id) => setTaskModalId(id)}
          accentColor="bg-emerald-400"
        />
      </div>

      {done.length > 0 && (
        <div className="flex justify-end mt-3">
          <button
            onClick={() => clearMutation.mutate()}
            className="flex items-center gap-1.5 text-[10px] text-white/30 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Erledigte löschen
          </button>
        </div>
      )}
    </div>
  );
}
