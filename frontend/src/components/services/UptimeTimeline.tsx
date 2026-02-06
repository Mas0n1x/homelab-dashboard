'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Activity, Zap } from 'lucide-react';
import * as api from '@/lib/api';

interface TimelineDay {
  date: string;
  uptime: number | null;
  checks: number;
  avgResponseTime: number;
}

interface TimelineData {
  serviceId: string;
  days: number;
  timeline: TimelineDay[];
  overallUptime: number | null;
  totalChecks: number;
}

function getBarColor(uptime: number | null): string {
  if (uptime === null) return 'bg-white/[0.06]';
  if (uptime >= 99) return 'bg-emerald-400';
  if (uptime >= 95) return 'bg-emerald-400/70';
  if (uptime >= 90) return 'bg-amber-400';
  if (uptime >= 50) return 'bg-amber-400/70';
  return 'bg-red-400';
}

function getUptimeColor(uptime: number | null): string {
  if (uptime === null) return 'text-white/30';
  if (uptime >= 99) return 'text-emerald-400';
  if (uptime >= 90) return 'text-amber-400';
  return 'text-red-400';
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

export function UptimeTimeline({ serviceId, serviceName }: { serviceId: string; serviceName: string }) {
  const [hoveredDay, setHoveredDay] = useState<TimelineDay | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number>(-1);

  const { data: timeline } = useQuery<TimelineData>({
    queryKey: ['uptimeTimeline', serviceId],
    queryFn: () => api.getUptimeTimeline(serviceId, 30) as Promise<TimelineData>,
    staleTime: 60000,
  });

  if (!timeline) return null;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="pt-3 pb-1 px-1 border-t border-white/[0.04]">
        {/* Header stats */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-white/30" />
              <span className={`text-sm font-mono font-semibold ${getUptimeColor(timeline.overallUptime)}`}>
                {timeline.overallUptime !== null ? `${timeline.overallUptime}%` : 'N/A'}
              </span>
              <span className="text-xs text-white/30">30 Tage</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-white/30" />
              <span className="text-xs text-white/40">{timeline.totalChecks} Checks</span>
            </div>
          </div>

          {/* Tooltip */}
          <AnimatePresence>
            {hoveredDay && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs text-right"
              >
                <span className="text-white/50">{formatDate(hoveredDay.date)}</span>
                <span className="mx-1.5 text-white/20">|</span>
                <span className={getUptimeColor(hoveredDay.uptime)}>
                  {hoveredDay.uptime !== null ? `${hoveredDay.uptime}%` : 'Keine Daten'}
                </span>
                {hoveredDay.avgResponseTime > 0 && (
                  <>
                    <span className="mx-1.5 text-white/20">|</span>
                    <span className="text-white/40">{hoveredDay.avgResponseTime}ms</span>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Timeline bars */}
        <div className="flex gap-[2px] items-end h-8 px-1">
          {timeline.timeline.map((day, i) => {
            const barHeight = day.uptime !== null
              ? Math.max(20, (day.uptime / 100) * 100) + '%'
              : '100%';

            return (
              <div
                key={day.date}
                className="relative flex-1 h-full flex items-end cursor-pointer group"
                onMouseEnter={() => { setHoveredDay(day); setHoveredIndex(i); }}
                onMouseLeave={() => { setHoveredDay(null); setHoveredIndex(-1); }}
              >
                <div
                  className={`w-full rounded-sm transition-all duration-150 ${getBarColor(day.uptime)} ${
                    hoveredIndex === i ? 'opacity-100 scale-y-110' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ height: barHeight, transformOrigin: 'bottom' }}
                />
              </div>
            );
          })}
        </div>

        {/* Date labels */}
        <div className="flex justify-between mt-1.5 px-1">
          <span className="text-[10px] text-white/20">30 Tage</span>
          <span className="text-[10px] text-white/20">Heute</span>
        </div>
      </div>
    </motion.div>
  );
}
