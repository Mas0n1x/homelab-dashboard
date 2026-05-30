/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { moveTrackerTask, completeTrackerTask, updateTrackerTask } from '@/lib/api';
import { useTrackerStore } from '@/stores/trackerStore';
import { TaskCard } from './TaskCard';
import { TaskForm } from './TaskForm';
import type { TrackerTask, CompletionResult } from '@/lib/types';

interface KanbanColumnProps {
  title: string;
  status: 'backlog' | 'inprogress' | 'done';
  tasks: TrackerTask[];
  onTaskClick: (id: string) => void;
  accentColor: string;
}

export function KanbanColumn({ title, status, tasks, onTaskClick, accentColor }: KanbanColumnProps) {
  const queryClient = useQueryClient();
  const { showNotification, timer, resetTimer } = useTrackerStore();

  const moveMutation = useMutation({
    mutationFn: ({ id, newStatus }: { id: string; newStatus: string }) =>
      moveTrackerTask(id, newStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracker-tasks'] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, actual_time }: { id: string; actual_time: number }) =>
      completeTrackerTask(id, actual_time) as Promise<CompletionResult>,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tracker-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tracker-player'] });
      queryClient.invalidateQueries({ queryKey: ['tracker-stats'] });
      queryClient.invalidateQueries({ queryKey: ['tracker-achievements'] });

      if (result.level_up) {
        showNotification({ type: 'levelup', data: { level: result.new_level } });
      } else if (result.new_achievements?.length > 0) {
        showNotification({ type: 'achievement', data: result.new_achievements[0] });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      updateTrackerTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracker-tasks'] });
    },
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId) return;

    if (status === 'done') {
      completeMutation.mutate({ id: taskId, actual_time: 0 });
    } else {
      moveMutation.mutate({ id: taskId, newStatus: status });
    }
  };

  const handleMoveToColumn = (taskId: string, newStatus: string) => {
    if (newStatus === 'done') {
      completeMutation.mutate({ id: taskId, actual_time: 0 });
    } else {
      moveMutation.mutate({ id: taskId, newStatus });
    }
  };

  const handleToggleSubtask = (task: TrackerTask, subtaskIndex: number) => {
    const updatedSubtasks = task.subtasks.map((s, i) =>
      i === subtaskIndex ? { ...s, completed: !s.completed } : s
    );
    updateMutation.mutate({ id: task.id, data: { subtasks: updatedSubtasks } });
  };

  const handlePause = (taskId: string) => {
    // If timer is running for this task, reset it
    if (timer.activeTaskId === taskId) {
      resetTimer();
    }
    // Move task to paused status
    moveMutation.mutate({ id: taskId, newStatus: 'paused' });
  };

  const handleResume = (taskId: string) => {
    // Move task back to inprogress
    moveMutation.mutate({ id: taskId, newStatus: 'inprogress' });
  };

  // Sort: active tasks first, paused tasks at the bottom
  const sortedTasks = status === 'inprogress'
    ? [...tasks].sort((a, b) => {
        if (a.status === 'paused' && b.status !== 'paused') return 1;
        if (a.status !== 'paused' && b.status === 'paused') return -1;
        return 0;
      })
    : tasks;

  return (
    <div
      className="flex flex-col rounded-2xl bg-white/[0.02] border border-white/[0.06] p-3 min-h-[300px]"
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${accentColor}`} />
          <h3 className="text-sm font-medium">{title}</h3>
        </div>
        <span className="text-[10px] text-white/30 bg-white/[0.06] px-2 py-0.5 rounded-full">
          {tasks.length}
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto max-h-[500px]">
        {sortedTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onClick={() => onTaskClick(task.id)}
            onMoveToColumn={(newStatus) => handleMoveToColumn(task.id, newStatus)}
            onToggleSubtask={task.status === 'inprogress' ? (idx) => handleToggleSubtask(task, idx) : undefined}
            onPause={task.status === 'inprogress' ? () => handlePause(task.id) : undefined}
            onResume={task.status === 'paused' ? () => handleResume(task.id) : undefined}
            isDone={status === 'done'}
            isPaused={task.status === 'paused'}
          />
        ))}
      </div>

      {status === 'backlog' && (
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          <TaskForm />
        </div>
      )}
    </div>
  );
}
