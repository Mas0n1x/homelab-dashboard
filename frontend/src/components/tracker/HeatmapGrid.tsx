'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTrackerHeatmap } from '@/lib/api';

const DAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getIntensityStyle(count: number, max: number): { bg: string; border: string } {
  if (count === 0 || max === 0) return { bg: 'rgba(255,255,255,0.02)', border: 'transparent' };
  const ratio = count / max;
  // Gradient from deep blue-purple to vibrant purple-pink
  if (ratio < 0.2) return { bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.1)' };
  if (ratio < 0.4) return { bg: 'rgba(124, 58, 237, 0.25)', border: 'rgba(124, 58, 237, 0.15)' };
  if (ratio < 0.6) return { bg: 'rgba(139, 92, 246, 0.4)', border: 'rgba(139, 92, 246, 0.2)' };
  if (ratio < 0.8) return { bg: 'rgba(168, 85, 247, 0.6)', border: 'rgba(168, 85, 247, 0.3)' };
  return { bg: 'rgba(192, 132, 252, 0.8)', border: 'rgba(192, 132, 252, 0.4)' };
}

export function HeatmapGrid() {
  const { data: heatmap } = useQuery<Record<string, number>>({
    queryKey: ['tracker-stats', 'heatmap'],
    queryFn: getTrackerHeatmap as () => Promise<Record<string, number>>,
  });

  const [tooltip, setTooltip] = useState<{ day: number; hour: number; count: number; x: number; y: number } | null>(null);

  if (!heatmap) return <p className="text-sm text-white/20 text-center py-4">Laden...</p>;

  const maxCount = Math.max(1, ...Object.values(heatmap));
  const totalTasks = Object.values(heatmap).reduce((sum, v) => sum + v, 0);

  return (
    <div className="relative">
      {/* Stats bar */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-white/40">Letzte 30 Tage</span>
        <span className="text-xs text-white/30">{totalTasks} Aufgaben abgeschlossen</span>
      </div>

      <div className="flex gap-[2px]">
        {/* Day labels */}
        <div className="flex flex-col gap-[2px] mr-1.5 pt-5">
          {DAY_LABELS.map((label, i) => (
            <div key={i} className="h-[16px] flex items-center">
              <span className="text-[9px] text-white/25 w-6 font-medium">{label}</span>
            </div>
          ))}
        </div>

        {/* Hour columns */}
        <div className="flex gap-[2px] flex-1 overflow-x-auto scrollbar-hide">
          {HOURS.map((hour) => (
            <div key={hour} className="flex flex-col gap-[2px] items-center">
              <span className="text-[8px] text-white/15 h-4 flex items-end font-mono">
                {hour % 3 === 0 ? `${String(hour).padStart(2, '0')}` : ''}
              </span>
              {DAY_LABELS.map((_, day) => {
                const key = `${day}-${hour}`;
                const count = heatmap[key] || 0;
                const style = getIntensityStyle(count, maxCount);
                return (
                  <div
                    key={key}
                    className="w-[16px] h-[16px] rounded-[3px] cursor-pointer transition-all duration-150 hover:scale-125 hover:z-10"
                    style={{
                      background: style.bg,
                      border: `1px solid ${style.border}`,
                      boxShadow: count > 0 ? `0 0 4px ${style.bg}` : 'none',
                    }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltip({ day, hour, count, x: rect.left, y: rect.top });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1.5 mt-3">
        <span className="text-[9px] text-white/20">Weniger</span>
        {[0, 0.2, 0.4, 0.6, 0.8, 1].map((ratio, i) => {
          const style = getIntensityStyle(ratio === 0 ? 0 : ratio * 10, 10);
          return (
            <div
              key={i}
              className="w-[12px] h-[12px] rounded-[2px]"
              style={{ background: style.bg, border: `1px solid ${style.border}` }}
            />
          );
        })}
        <span className="text-[9px] text-white/20">Mehr</span>
      </div>

      {/* Tooltip */}
      {tooltip && tooltip.count > 0 && (
        <div
          className="fixed z-50 px-2.5 py-1.5 rounded-lg glass-card text-[11px] text-white/80 pointer-events-none"
          style={{ left: tooltip.x + 20, top: tooltip.y - 10 }}
        >
          <span className="font-medium">{DAY_LABELS[tooltip.day]} {String(tooltip.hour).padStart(2, '0')}:00</span>
          <span className="text-white/40 mx-1.5">—</span>
          <span className="text-purple-400 font-semibold">{tooltip.count}</span>
          <span className="text-white/40 ml-1">{tooltip.count === 1 ? 'Aufgabe' : 'Aufgaben'}</span>
        </div>
      )}
    </div>
  );
}
