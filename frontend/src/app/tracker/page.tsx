'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { getTrackerTasks, getTrackerPlayer, getTrackerStatsToday } from '@/lib/api';
import { useTrackerStore } from '@/stores/trackerStore';
import { Tabs } from '@/components/ui/Tabs';
import { TrackerHeader } from '@/components/tracker/TrackerHeader';
import { KanbanBoard } from '@/components/tracker/KanbanBoard';
import { TaskModal } from '@/components/tracker/TaskModal';
import { TimerPanel } from '@/components/tracker/TimerPanel';
import { FocusMode } from '@/components/tracker/FocusMode';
import { StatsPanel } from '@/components/tracker/StatsPanel';
import { NotesPanel } from '@/components/tracker/NotesPanel';
import { ProjectsPanel } from '@/components/tracker/ProjectsPanel';
import { SettingsPanel } from '@/components/tracker/SettingsPanel';
import { AchievementsDrawer } from '@/components/tracker/AchievementsDrawer';
import { AchievementNotification } from '@/components/tracker/AchievementNotification';
import type { TrackerTask, PlayerData, TodayStats } from '@/lib/types';

const TABS = [
  { id: 'board', label: 'Board' },
  { id: 'statistik', label: 'Statistik' },
  { id: 'notizen', label: 'Notizen' },
  { id: 'projekte', label: 'Projekte' },
  { id: 'einstellungen', label: 'Einstellungen' },
];

export default function TrackerPage() {
  const { activeTab, setActiveTab, taskModalId, setTaskModalId, toggleAchievements } = useTrackerStore();

  const { data: tasks = [] } = useQuery<TrackerTask[]>({
    queryKey: ['tracker-tasks'],
    queryFn: getTrackerTasks as () => Promise<TrackerTask[]>,
  });

  const { data: player } = useQuery<PlayerData>({
    queryKey: ['tracker-player'],
    queryFn: getTrackerPlayer as () => Promise<PlayerData>,
  });

  const { data: todayStats } = useQuery<TodayStats>({
    queryKey: ['tracker-stats', 'today'],
    queryFn: getTrackerStatsToday as () => Promise<TodayStats>,
  });

  const selectedTask = taskModalId ? tasks.find(t => t.id === taskModalId) || null : null;

  const tabsWithCounts = TABS.map(tab => {
    if (tab.id === 'board') return { ...tab, count: tasks.filter(t => t.status !== 'done').length };
    return tab;
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold mb-4">Tracker</h1>

        <TrackerHeader
          player={player}
          todayStats={todayStats}
          onShowAchievements={toggleAchievements}
        />

        <div className="mb-6">
          <Tabs tabs={tabsWithCounts} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        {/* Tab Content */}
        {activeTab === 'board' && (
          <div className="flex gap-4 items-start">
            <div className="flex-1 min-w-0">
              <KanbanBoard tasks={tasks} />
            </div>
            <div className="hidden lg:block w-64 shrink-0">
              <TimerPanel tasks={tasks} />
            </div>
          </div>
        )}
        {/* Mobile: Timer below board */}
        {activeTab === 'board' && (
          <div className="lg:hidden mt-4">
            <TimerPanel tasks={tasks} />
          </div>
        )}
        {activeTab === 'statistik' && <StatsPanel />}
        {activeTab === 'notizen' && <NotesPanel />}
        {activeTab === 'projekte' && <ProjectsPanel />}
        {activeTab === 'einstellungen' && <SettingsPanel />}
      </motion.div>

      {/* Modals & Overlays */}
      <TaskModal
        task={selectedTask}
        isOpen={!!taskModalId}
        onClose={() => setTaskModalId(null)}
      />
      <FocusMode tasks={tasks} />
      <AchievementsDrawer />
      <AchievementNotification />
    </div>
  );
}
