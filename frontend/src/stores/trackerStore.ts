import { create } from 'zustand';
import type { Achievement } from '@/lib/types';

interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  activeTaskId: string | null;
  durationSeconds: number;
  startedAt: number | null;      // Date.now() when started
  pausedElapsed: number;          // accumulated elapsed when paused
  elapsedAtPause: number;         // stopwatch accumulated at pause
  stopwatchStartedAt: number | null;
}

interface TrackerNotification {
  type: 'achievement' | 'levelup';
  data: Achievement | { level: number };
}

interface TrackerStore {
  // Timer
  timer: TimerState;
  startTimer: (taskId: string, durationMinutes: number) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
  getTimerSeconds: () => { remaining: number; elapsed: number };

  // UI state
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedNoteId: string | null;
  setSelectedNoteId: (id: string | null) => void;
  showAchievements: boolean;
  toggleAchievements: () => void;
  taskModalId: string | null;
  setTaskModalId: (id: string | null) => void;
  focusMode: boolean;
  setFocusMode: (active: boolean) => void;

  // Notifications
  notification: TrackerNotification | null;
  showNotification: (n: TrackerNotification) => void;
  clearNotification: () => void;
}

export const useTrackerStore = create<TrackerStore>((set, get) => ({
  timer: {
    isRunning: false,
    isPaused: false,
    activeTaskId: null,
    durationSeconds: 0,
    startedAt: null,
    pausedElapsed: 0,
    elapsedAtPause: 0,
    stopwatchStartedAt: null,
  },

  startTimer: (taskId, durationMinutes) => set({
    timer: {
      isRunning: true,
      isPaused: false,
      activeTaskId: taskId,
      durationSeconds: durationMinutes * 60,
      startedAt: Date.now(),
      pausedElapsed: 0,
      elapsedAtPause: 0,
      stopwatchStartedAt: Date.now(),
    },
  }),

  pauseTimer: () => {
    const { timer } = get();
    if (!timer.isRunning || timer.isPaused) return;
    const now = Date.now();
    const elapsed = timer.startedAt ? (now - timer.startedAt) / 1000 : 0;
    const stopwatchElapsed = timer.stopwatchStartedAt ? (now - timer.stopwatchStartedAt) / 1000 : 0;
    set({
      timer: {
        ...timer,
        isPaused: true,
        isRunning: false,
        pausedElapsed: timer.pausedElapsed + elapsed,
        elapsedAtPause: timer.elapsedAtPause + stopwatchElapsed,
        startedAt: null,
        stopwatchStartedAt: null,
      },
    });
  },

  resumeTimer: () => {
    const { timer } = get();
    if (!timer.isPaused) return;
    set({
      timer: {
        ...timer,
        isRunning: true,
        isPaused: false,
        startedAt: Date.now(),
        stopwatchStartedAt: Date.now(),
      },
    });
  },

  resetTimer: () => set({
    timer: {
      isRunning: false,
      isPaused: false,
      activeTaskId: null,
      durationSeconds: 0,
      startedAt: null,
      pausedElapsed: 0,
      elapsedAtPause: 0,
      stopwatchStartedAt: null,
    },
  }),

  getTimerSeconds: () => {
    const { timer } = get();
    const now = Date.now();
    const currentSegment = timer.startedAt ? (now - timer.startedAt) / 1000 : 0;
    const totalCountdownElapsed = timer.pausedElapsed + currentSegment;
    const remaining = Math.max(0, timer.durationSeconds - totalCountdownElapsed);

    const stopwatchSegment = timer.stopwatchStartedAt ? (now - timer.stopwatchStartedAt) / 1000 : 0;
    const elapsed = timer.elapsedAtPause + stopwatchSegment;

    return { remaining: Math.floor(remaining), elapsed: Math.floor(elapsed) };
  },

  // UI
  activeTab: 'board',
  setActiveTab: (tab) => set({ activeTab: tab }),
  selectedNoteId: null,
  setSelectedNoteId: (id) => set({ selectedNoteId: id }),
  showAchievements: false,
  toggleAchievements: () => set((s) => ({ showAchievements: !s.showAchievements })),
  taskModalId: null,
  setTaskModalId: (id) => set({ taskModalId: id }),
  focusMode: false,
  setFocusMode: (active) => set({ focusMode: active }),

  // Notifications
  notification: null,
  showNotification: (n) => set({ notification: n }),
  clearNotification: () => set({ notification: null }),
}));
