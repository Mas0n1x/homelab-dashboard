'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useServerStore } from '@/stores/serverStore';
import type { ContainerStats } from '@/lib/types';

function formatMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(0);
}

export function ContainerComparison() {
  const { activeServerId } = useServerStore();

  const { data: stats } = useQuery<ContainerStats[]>({
    queryKey: ['containerStats', activeServerId],
    enabled: false,
  });

  if (!stats || stats.length === 0) {
    return (
      <GlassCard>
        <div className="relative z-10 py-6 text-center">
          <BarChart3 className="w-8 h-8 mx-auto mb-2 text-white/10" />
          <p className="text-xs text-white/30">Keine Container-Stats verfügbar</p>
        </div>
      </GlassCard>
    );
  }

  // Sort by CPU usage descending
  const sorted = [...stats].sort((a, b) => b.cpu - a.cpu);
  const maxCpu = Math.max(...sorted.map(s => s.cpu), 1);
  const maxMem = Math.max(...sorted.map(s => s.memUsage), 1);

  return (
    <GlassCard>
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-white/30" />
          <span className="text-sm font-medium">Container-Vergleich</span>
          <span className="text-[10px] text-white/20">{stats.length} Container</span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-3">
          <span className="flex items-center gap-1.5 text-[10px] text-white/40">
            <span className="w-2 h-2 rounded-full bg-indigo-500" /> CPU %
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-white/40">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> RAM (MB)
          </span>
        </div>

        {/* Bars */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {sorted.map(container => (
            <div key={container.id} className="group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-white/60 truncate max-w-[150px]">{container.name.replace(/^\//, '')}</span>
                <div className="flex items-center gap-3 text-[10px] font-mono">
                  <span className="text-indigo-400">{container.cpu.toFixed(1)}%</span>
                  <span className="text-emerald-400">{formatMB(container.memUsage)} MB</span>
                </div>
              </div>
              <div className="flex gap-1">
                {/* CPU Bar */}
                <div className="flex-1 h-2 rounded-full bg-white/[0.03] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-500"
                    style={{ width: `${Math.max((container.cpu / maxCpu) * 100, 1)}%` }}
                  />
                </div>
                {/* Memory Bar */}
                <div className="flex-1 h-2 rounded-full bg-white/[0.03] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
                    style={{ width: `${Math.max((container.memUsage / maxMem) * 100, 1)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-4 pt-3 border-t border-white/[0.04] grid grid-cols-3 gap-3 text-center">
          <div>
            <span className="text-xs font-bold text-indigo-400 block">
              {sorted.reduce((s, c) => s + c.cpu, 0).toFixed(1)}%
            </span>
            <span className="text-[9px] text-white/30">CPU Gesamt</span>
          </div>
          <div>
            <span className="text-xs font-bold text-emerald-400 block">
              {formatMB(sorted.reduce((s, c) => s + c.memUsage, 0))} MB
            </span>
            <span className="text-[9px] text-white/30">RAM Gesamt</span>
          </div>
          <div>
            <span className="text-xs font-bold text-white/60 block">
              {sorted.length}
            </span>
            <span className="text-[9px] text-white/30">Container</span>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
