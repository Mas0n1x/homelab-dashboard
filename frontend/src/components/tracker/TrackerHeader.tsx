'use client';

import { Flame, Trophy, Target, Zap } from 'lucide-react';
import type { PlayerData, TodayStats } from '@/lib/types';

interface TrackerHeaderProps {
  player: PlayerData | undefined;
  todayStats: TodayStats | undefined;
  onShowAchievements: () => void;
}

export function TrackerHeader({ player, todayStats, onShowAchievements }: TrackerHeaderProps) {
  if (!player) return null;

  const xpPercent = player.xp_for_next_level > 0
    ? Math.min(100, (player.xp / player.xp_for_next_level) * 100)
    : 0;

  const goalPercent = todayStats && player.daily_goal > 0
    ? Math.min(100, (todayStats.total_minutes / player.daily_goal) * 100)
    : 0;

  return (
    <div className="flex flex-wrap items-center gap-4 mb-4">
      {/* Level & XP */}
      <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-accent-warning" />
          <span className="text-sm font-bold">Lvl {player.level}</span>
        </div>
        <div className="w-24 h-2 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
            style={{ width: `${xpPercent}%` }}
          />
        </div>
        <span className="text-[10px] text-white/40 font-mono">{player.xp}/{player.xp_for_next_level}</span>
      </div>

      {/* Streak */}
      <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <Flame className="w-4 h-4 text-orange-400" />
        <span className="text-sm font-medium">{player.streak}</span>
        <span className="text-[10px] text-white/40">Tage</span>
      </div>

      {/* Daily Goal */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <Target className="w-4 h-4 text-accent-success" />
        <div className="w-20 h-2 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${goalPercent}%` }}
          />
        </div>
        <span className="text-[10px] text-white/40 font-mono">
          {todayStats?.total_minutes || 0}/{player.daily_goal}min
        </span>
      </div>

      {/* Achievements Button */}
      <button
        onClick={onShowAchievements}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors"
      >
        <Trophy className="w-4 h-4 text-yellow-400" />
        <span className="text-xs text-white/60">Achievements</span>
      </button>
    </div>
  );
}
