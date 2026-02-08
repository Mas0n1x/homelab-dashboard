'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { useServerStore } from '@/stores/serverStore';
import * as api from '@/lib/api';

interface UptimeEntry {
  uptime24h: number | null;
  uptime7d: number | null;
  avgResponseTime: number;
}

export function UptimeWidget() {
  const { activeServerId } = useServerStore();

  const { data: summary } = useQuery<Record<string, UptimeEntry>>({
    queryKey: ['uptimeSummary', activeServerId],
    queryFn: () => api.getUptimeSummary(activeServerId) as Promise<Record<string, UptimeEntry>>,
    refetchInterval: 60000,
  });

  if (!summary) return null;

  const entries = Object.values(summary);
  const total = entries.length;
  const online = entries.filter(e => e.uptime24h !== null && e.uptime24h >= 99).length;
  const avgUptime = total > 0
    ? entries.reduce((sum, e) => sum + (e.uptime24h ?? 0), 0) / total
    : 0;

  return (
    <GlassCard delay={0.25} glow="emerald" hover>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <span className="stat-label">Service Health</span>
          <Activity className="w-4 h-4 text-emerald-400/50" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="stat-value text-emerald-400">
            <AnimatedNumber value={online} />
          </span>
          <span className="text-white/30 text-sm">/ {total}</span>
        </div>
        <p className="text-xs text-white/30 mt-1">online (24h)</p>
        <div className="mt-2 pt-2 border-t border-white/[0.06]">
          <span className="text-xs text-white/40">Durchschnitt: </span>
          <span className="text-xs text-emerald-400 font-medium">{avgUptime.toFixed(1)}%</span>
        </div>
      </div>
    </GlassCard>
  );
}
