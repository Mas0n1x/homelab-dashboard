'use client';

import { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, CheckCircle, Maximize } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { completeTrackerTask } from '@/lib/api';
import { useTrackerStore } from '@/stores/trackerStore';
import { CoffeeCup } from './CoffeeCup';
import type { TrackerTask, CompletionResult } from '@/lib/types';

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface TimerPanelProps {
  tasks: TrackerTask[];
}

export function TimerPanel({ tasks }: TimerPanelProps) {
  const {
    timer, startTimer, pauseTimer, resumeTimer, resetTimer, getTimerSeconds,
    setFocusMode, showNotification,
  } = useTrackerStore();
  const queryClient = useQueryClient();
  const [, setTick] = useState(0);

  // Tick every second to re-render
  useEffect(() => {
    if (!timer.isRunning) return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [timer.isRunning]);

  const completeMutation = useMutation({
    mutationFn: ({ id, actual_time }: { id: string; actual_time: number }) =>
      completeTrackerTask(id, actual_time) as Promise<CompletionResult>,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tracker-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tracker-player'] });
      queryClient.invalidateQueries({ queryKey: ['tracker-stats'] });
      queryClient.invalidateQueries({ queryKey: ['tracker-achievements'] });
      resetTimer();
      if (result.level_up) {
        showNotification({ type: 'levelup', data: { level: result.new_level } });
      } else if (result.new_achievements?.length > 0) {
        showNotification({ type: 'achievement', data: result.new_achievements[0] });
      }
    },
  });

  const { remaining, elapsed } = timer.isRunning || timer.isPaused
    ? getTimerSeconds()
    : { remaining: 0, elapsed: 0 };

  const fillPercent = timer.durationSeconds > 0
    ? 1 - (remaining / timer.durationSeconds)
    : 0;

  const inProgressTasks = tasks.filter(t => t.status === 'inprogress');
  const activeTask = timer.activeTaskId
    ? tasks.find(t => t.id === timer.activeTaskId)
    : null;

  const handleStart = (task: TrackerTask) => {
    startTimer(task.id, task.estimated_time);
  };

  const handleComplete = () => {
    if (!timer.activeTaskId) return;
    const actualMinutes = Math.max(1, Math.round(elapsed / 60));
    completeMutation.mutate({ id: timer.activeTaskId, actual_time: actualMinutes });
  };

  return (
    <div className="space-y-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 lg:sticky lg:top-4">
      {/* Coffee Cup */}
      <CoffeeCup
        fillPercent={fillPercent}
        isActive={timer.isRunning}
        size={140}
      />

      {/* Timer Display */}
      <div className="text-center">
        <div className="font-mono text-3xl font-bold tracking-wider">
          {formatTime(remaining)}
        </div>
        <div className="text-white/30 text-xs mt-1 font-mono">
          Gestoppt: {formatTime(elapsed)}
        </div>
      </div>

      {/* Active Task */}
      {activeTask && (
        <div className="text-center">
          <span className="text-[10px] text-white/40">Aktive Aufgabe:</span>
          <p className="text-sm font-medium mt-0.5 truncate">{activeTask.title}</p>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap justify-center gap-2">
        {!timer.isRunning && !timer.isPaused ? (
          inProgressTasks.length > 0 ? (
            <div className="space-y-1.5 w-full">
              <p className="text-[10px] text-white/40 text-center">Aufgabe starten:</p>
              {inProgressTasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => handleStart(task)}
                  className="w-full flex items-center gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all text-left"
                >
                  <Play className="w-3.5 h-3.5 text-accent-success shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{task.title}</p>
                    <p className="text-[9px] text-white/30">{task.estimated_time} min</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-white/30 text-center">
              Verschiebe eine Aufgabe nach &quot;In Arbeit&quot;
            </p>
          )
        ) : (
          <>
            {timer.isRunning ? (
              <button onClick={pauseTimer} className="btn-glass py-2 px-3 text-xs flex items-center gap-1.5">
                <Pause className="w-3.5 h-3.5" /> Pause
              </button>
            ) : (
              <button onClick={resumeTimer} className="btn-primary py-2 px-3 text-xs flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5" /> Weiter
              </button>
            )}
            <button onClick={resetTimer} className="btn-glass py-2 px-2.5">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleComplete}
              disabled={completeMutation.isPending}
              className="btn-success py-2 px-3 text-xs flex items-center gap-1.5"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Fertig
            </button>
            <button onClick={() => setFocusMode(true)} className="btn-glass py-2 px-2.5" title="Fokusmodus">
              <Maximize className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
