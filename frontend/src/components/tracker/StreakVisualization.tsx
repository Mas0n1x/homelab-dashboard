'use client';

import { motion } from 'framer-motion';
import { Flame, Target, Trophy } from 'lucide-react';
import { clsx } from 'clsx';

interface StreakVisualizationProps {
  streak: number;
  dailyGoal: number;
  todayMinutes: number;
}

const MILESTONES = [3, 7, 14, 30, 60, 100];

export function StreakVisualization({ streak, dailyGoal, todayMinutes }: StreakVisualizationProps) {
  const goalReached = dailyGoal > 0 && todayMinutes >= dailyGoal;
  const goalPercent = dailyGoal > 0 ? Math.min((todayMinutes / dailyGoal) * 100, 100) : 0;
  const nextMilestone = MILESTONES.find(m => m > streak) || streak + 10;

  // Flame intensity based on streak
  const flameColor = streak >= 30 ? 'text-orange-400' : streak >= 14 ? 'text-amber-400' : streak >= 7 ? 'text-yellow-400' : streak >= 3 ? 'text-orange-300/70' : 'text-white/20';
  const flameBg = streak >= 30 ? 'bg-orange-500/15' : streak >= 14 ? 'bg-amber-500/15' : streak >= 7 ? 'bg-yellow-500/15' : streak >= 3 ? 'bg-orange-500/10' : 'bg-white/[0.03]';
  const flameGlow = streak >= 7 ? `0 0 20px ${streak >= 30 ? 'rgba(251,146,60,0.3)' : streak >= 14 ? 'rgba(245,158,11,0.3)' : 'rgba(234,179,8,0.2)'}` : 'none';

  return (
    <div className="glass-card-elevated p-4">
      <div className="flex items-start gap-4">
        {/* Flame Icon */}
        <motion.div
          animate={streak > 0 ? {
            scale: [1, 1.08, 1],
            rotate: [0, -3, 3, 0],
          } : undefined}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className={clsx('w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0', flameBg)}
          style={{ boxShadow: flameGlow }}
        >
          <Flame className={clsx('w-7 h-7', flameColor)} />
        </motion.div>

        {/* Streak Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tabular-nums">{streak}</span>
            <span className="text-xs text-white/40">Tage Streak</span>
          </div>

          {/* Milestone progress */}
          <div className="mt-2">
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-white/30">Naechster Milestone</span>
              <span className="text-white/40 flex items-center gap-1">
                <Trophy className="w-3 h-3" />
                {nextMilestone} Tage
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
                  boxShadow: '0 0 8px rgba(245,158,11,0.3)',
                }}
                initial={{ width: 0 }}
                animate={{ width: `${(streak / nextMilestone) * 100}%` }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
          </div>

          {/* Daily Goal */}
          {dailyGoal > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <Target className={clsx('w-3.5 h-3.5', goalReached ? 'text-emerald-400' : 'text-white/30')} />
              <div className="flex-1">
                <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background: goalReached ? '#10b981' : 'rgba(var(--accent-rgb), 0.6)',
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${goalPercent}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>
              <span className={clsx('text-[10px] tabular-nums', goalReached ? 'text-emerald-400' : 'text-white/30')}>
                {todayMinutes}/{dailyGoal}m
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Milestone badges */}
      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-white/[0.04]">
        {MILESTONES.slice(0, 5).map(m => (
          <span
            key={m}
            className={clsx(
              'text-[10px] px-2 py-0.5 rounded-full border',
              streak >= m
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                : 'bg-white/[0.02] border-white/[0.04] text-white/15'
            )}
          >
            {m}d
          </span>
        ))}
      </div>
    </div>
  );
}
