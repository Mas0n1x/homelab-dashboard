'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTrackerHeatmap } from '@/lib/api';

const DAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getIntensityClass(count: number, max: number): string {
  if (count === 0 || max === 0) return 'bg-white/[0.02]';
  const ratio = count / max;
  if (ratio < 0.2) return 'bg-indigo-500/20';
  if (ratio < 0.4) return 'bg-indigo-500/35';
  if (ratio < 0.6) return 'bg-indigo-500/50';
  if (ratio < 0.8) return 'bg-indigo-500/70';
  return 'bg-indigo-500/90';
}

export function HeatmapGrid() {
  const { data: heatmap } = useQuery<Record<string, number>>({
    queryKey: ['tracker-stats', 'heatmap'],
    queryFn: getTrackerHeatmap as () => Promise<Record<string, number>>,
  });

  const [tooltip, setTooltip] = useState<{ day: number; hour: number; count: number; x: number; y: number } | null>(null);

  if (!heatmap) return <p className="text-sm text-white/20 text-center py-4">Laden...</p>;

  const maxCount = Math.max(1, ...Object.values(heatmap));

  return (
    <div className="relative">
      <div className="flex gap-[2px]">
        {/* Day labels */}
        <div className="flex flex-col gap-[2px] mr-1 pt-5">
          {DAY_LABELS.map((label, i) => (
            <div key={i} className="h-[14px] flex items-center">
              <span className="text-[8px] text-white/30 w-5">{label}</span>
            </div>
          ))}
        </div>

        {/* Hour columns */}
        <div className="flex gap-[2px] flex-1 overflow-x-auto">
          {HOURS.map((hour) => (
            <div key={hour} className="flex flex-col gap-[2px] items-center">
              <span className="text-[7px] text-white/20 h-4 flex items-end">
                {hour % 3 === 0 ? hour : ''}
              </span>
              {DAY_LABELS.map((_, day) => {
                const key = `${day}-${hour}`;
                const count = heatmap[key] || 0;
                return (
                  <div
                    key={key}
                    className={`w-[14px] h-[14px] rounded-[2px] ${getIntensityClass(count, maxCount)} cursor-pointer transition-all hover:ring-1 hover:ring-white/20`}
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

      {/* Tooltip */}
      {tooltip && tooltip.count > 0 && (
        <div
          className="fixed z-50 px-2 py-1 rounded-lg bg-surface-elevated border border-white/10 text-[10px] text-white/70 pointer-events-none"
          style={{ left: tooltip.x + 20, top: tooltip.y - 5 }}
        >
          {DAY_LABELS[tooltip.day]} {tooltip.hour}:00 - {tooltip.count} {tooltip.count === 1 ? 'Aufgabe' : 'Aufgaben'}
        </div>
      )}
    </div>
  );
}
