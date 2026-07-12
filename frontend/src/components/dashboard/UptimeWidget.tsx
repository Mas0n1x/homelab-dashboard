/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
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
  const { servers } = useServerStore();
  const ids = servers.map(s => s.id);

  // Fleet-weit: Uptime-Summary aller Server zusammenfuehren (nicht nur der aktive)
  const { data: summaries } = useQuery<Record<string, UptimeEntry>[]>({
    queryKey: ['uptimeSummaryFleet', ids.join(',')],
    queryFn: () => Promise.all(ids.map(id => api.getUptimeSummary(id).catch(() => ({})) as Promise<Record<string, UptimeEntry>>)),
    refetchInterval: 60000,
    enabled: ids.length > 0,
  });

  const entries = (summaries ?? []).flatMap(s => Object.values(s));
  const total = entries.length;
  const online = entries.filter(e => e.uptime24h !== null && e.uptime24h >= 99).length;
  const avgUptime = total > 0 ? entries.reduce((sum, e) => sum + (e.uptime24h ?? 0), 0) / total : 0;

  return (
    <Link href="/status" className="block group h-full">
      <GlassCard delay={0.25} glow="emerald" hover className="h-full">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Service Health</span>
            <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-emerald-400/60 transition-colors" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="stat-value text-emerald-400"><AnimatedNumber value={online} /></span>
            <span className="text-white/30 text-sm">/ {total}</span>
          </div>
          <p className="text-xs text-white/30 mt-1">Dienste gesund (24h) · fleetweit</p>
          <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-center justify-between">
            <span className="text-xs text-white/40">Ø Verfügbarkeit</span>
            <span className="text-xs text-emerald-400 font-medium">{avgUptime.toFixed(1)}%</span>
          </div>
        </div>
      </GlassCard>
    </Link>
  );
}
