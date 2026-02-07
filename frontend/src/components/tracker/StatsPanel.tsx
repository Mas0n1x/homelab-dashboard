'use client';

import { useQuery } from '@tanstack/react-query';
import { getTrackerStatsToday, getTrackerStatsWeek, getTrackerAccuracy } from '@/lib/api';
import { GlassCard } from '@/components/ui/GlassCard';
import { HeatmapGrid } from './HeatmapGrid';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { CheckCircle, Clock, Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { TodayStats, DailyStats, AccuracyStats } from '@/lib/types';

const CATEGORY_COLORS: Record<string, string> = {
  arbeit: '#6366f1',
  privat: '#10b981',
  lernen: '#f59e0b',
  sport: '#ef4444',
  projekt: '#8b5cf6',
};

const CATEGORY_NAMES: Record<string, string> = {
  arbeit: 'Arbeit',
  privat: 'Privat',
  lernen: 'Lernen',
  sport: 'Sport',
  projekt: 'Projekt',
};

const DAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export function StatsPanel() {
  const { data: today } = useQuery<TodayStats>({
    queryKey: ['tracker-stats', 'today'],
    queryFn: getTrackerStatsToday as () => Promise<TodayStats>,
  });

  const { data: week } = useQuery<DailyStats[]>({
    queryKey: ['tracker-stats', 'week'],
    queryFn: getTrackerStatsWeek as () => Promise<DailyStats[]>,
  });

  const { data: accuracy } = useQuery<AccuracyStats>({
    queryKey: ['tracker-stats', 'accuracy'],
    queryFn: getTrackerAccuracy as () => Promise<AccuracyStats>,
  });

  const weekData = (week || []).map(d => ({
    day: DAY_NAMES[new Date(d.date + 'T00:00:00').getDay()],
    tasks: d.completed,
    minuten: d.total_minutes,
  }));

  return (
    <div className="space-y-6">
      {/* Today */}
      <div>
        <h3 className="text-sm font-medium text-white/60 mb-3">Heute</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <GlassCard delay={0}>
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-accent-success" />
              <span className="text-[10px] text-white/40 uppercase">Aufgaben</span>
            </div>
            <p className="text-2xl font-bold">{today?.completed || 0}</p>
          </GlassCard>
          <GlassCard delay={0.05}>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-accent-info" />
              <span className="text-[10px] text-white/40 uppercase">Minuten</span>
            </div>
            <p className="text-2xl font-bold">{today?.total_minutes || 0}</p>
          </GlassCard>
          <GlassCard delay={0.1} className="col-span-2">
            <span className="text-[10px] text-white/40 uppercase">Kategorien</span>
            <div className="flex gap-2 mt-2 flex-wrap">
              {today?.categories && Object.entries(today.categories).map(([cat, count]) => (
                <span
                  key={cat}
                  className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${CATEGORY_COLORS[cat]}20`, color: CATEGORY_COLORS[cat] }}
                >
                  {CATEGORY_NAMES[cat] || cat}: {count as number}
                </span>
              ))}
              {(!today?.categories || Object.keys(today.categories).length === 0) && (
                <span className="text-[10px] text-white/20">Keine Daten</span>
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Week Chart */}
      <div>
        <h3 className="text-sm font-medium text-white/60 mb-3">Woche</h3>
        <GlassCard>
          {weekData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekData}>
                <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  contentStyle={{ background: 'rgba(15,15,35,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '12px' }}
                  labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
                />
                <Bar dataKey="tasks" name="Aufgaben" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="minuten" name="Minuten" fill="#6366f180" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-white/20 text-center py-8">Keine Daten diese Woche</p>
          )}
        </GlassCard>
      </div>

      {/* Accuracy */}
      {accuracy && accuracy.total > 0 && (
        <div>
          <h3 className="text-sm font-medium text-white/60 mb-3">Schätzgenauigkeit</h3>
          <div className="grid grid-cols-3 gap-3">
            <GlassCard>
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] text-white/40">Schneller</span>
              </div>
              <p className="text-xl font-bold text-emerald-400">{accuracy.faster}</p>
            </GlassCard>
            <GlassCard delay={0.05}>
              <div className="flex items-center gap-1.5 mb-1">
                <Minus className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[10px] text-white/40">Pünktlich</span>
              </div>
              <p className="text-xl font-bold text-indigo-400">{accuracy.on_time}</p>
            </GlassCard>
            <GlassCard delay={0.1}>
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] text-white/40">Langsamer</span>
              </div>
              <p className="text-xl font-bold text-amber-400">{accuracy.slower}</p>
            </GlassCard>
          </div>
          <p className="text-[10px] text-white/30 mt-2 text-center">
            Durchschnittliche Abweichung: {accuracy.avg_deviation} min | Genauigkeit: {accuracy.accuracy_percent}%
          </p>
        </div>
      )}

      {/* Heatmap */}
      <div>
        <h3 className="text-sm font-medium text-white/60 mb-3">Produktivitäts-Heatmap</h3>
        <GlassCard>
          <HeatmapGrid />
        </GlassCard>
      </div>
    </div>
  );
}
