'use client';

import { useEffect, useState } from 'react';
import { Minimize, Pause, Play, CheckCircle, RotateCcw } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { completeTrackerTask } from '@/lib/api';
import { useTrackerStore } from '@/stores/trackerStore';
import { CoffeeCup } from './CoffeeCup';
import type { TrackerTask, CompletionResult } from '@/lib/types';
import { createPortal } from 'react-dom';

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface FocusModeProps {
  tasks: TrackerTask[];
}

export function FocusMode({ tasks }: FocusModeProps) {
  const {
    focusMode, setFocusMode, timer, pauseTimer, resumeTimer, resetTimer, getTimerSeconds, showNotification,
  } = useTrackerStore();
  const queryClient = useQueryClient();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!timer.isRunning) return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [timer.isRunning]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocusMode(false);
    };
    if (focusMode) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [focusMode, setFocusMode]);

  const completeMutation = useMutation({
    mutationFn: ({ id, actual_time }: { id: string; actual_time: number }) =>
      completeTrackerTask(id, actual_time) as Promise<CompletionResult>,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tracker-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tracker-player'] });
      queryClient.invalidateQueries({ queryKey: ['tracker-stats'] });
      queryClient.invalidateQueries({ queryKey: ['tracker-achievements'] });
      resetTimer();
      setFocusMode(false);
      if (result.level_up) {
        showNotification({ type: 'levelup', data: { level: result.new_level } });
      } else if (result.new_achievements?.length > 0) {
        showNotification({ type: 'achievement', data: result.new_achievements[0] });
      }
    },
  });

  if (!focusMode) return null;

  const { remaining, elapsed } = getTimerSeconds();
  const fillPercent = timer.durationSeconds > 0 ? 1 - (remaining / timer.durationSeconds) : 0;
  const activeTask = timer.activeTaskId ? tasks.find(t => t.id === timer.activeTaskId) : null;

  const handleComplete = () => {
    if (!timer.activeTaskId) return;
    const actualMinutes = Math.max(1, Math.round(elapsed / 60));
    completeMutation.mutate({ id: timer.activeTaskId, actual_time: actualMinutes });
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-[#050510] flex flex-col items-center justify-center">
      <button
        onClick={() => setFocusMode(false)}
        className="absolute top-6 right-6 p-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] transition-colors"
        title="Escape zum Schließen"
      >
        <Minimize className="w-5 h-5 text-white/50" />
      </button>

      <CoffeeCup fillPercent={fillPercent} isActive={timer.isRunning} size={280} />

      <div className="font-mono text-7xl font-bold tracking-wider mt-8">
        {formatTime(remaining)}
      </div>
      <div className="text-white/30 text-lg mt-2 font-mono">
        {formatTime(elapsed)}
      </div>

      {activeTask && (
        <p className="text-xl text-white/60 mt-6">{activeTask.title}</p>
      )}

      <div className="flex gap-4 mt-10">
        {timer.isRunning ? (
          <button onClick={pauseTimer} className="btn-glass py-4 px-8 text-lg flex items-center gap-3">
            <Pause className="w-6 h-6" /> Pause
          </button>
        ) : timer.isPaused ? (
          <button onClick={resumeTimer} className="btn-primary py-4 px-8 text-lg flex items-center gap-3">
            <Play className="w-6 h-6" /> Fortsetzen
          </button>
        ) : null}
        <button onClick={resetTimer} className="btn-glass py-4 px-6">
          <RotateCcw className="w-6 h-6" />
        </button>
        <button
          onClick={handleComplete}
          disabled={completeMutation.isPending}
          className="btn-success py-4 px-8 text-lg flex items-center gap-3"
        >
          <CheckCircle className="w-6 h-6" /> Abschließen
        </button>
      </div>
    </div>,
    document.body
  );
}
