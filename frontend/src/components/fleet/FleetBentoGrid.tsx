/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Activity, Clock, ArrowUpDown, Shield, Zap } from 'lucide-react';
import { useServerStore } from '@/stores/serverStore';
import { useFleetStore } from '@/stores/fleetStore';
import { GlassCard } from '@/components/ui/GlassCard';
import { SpeedtestWidget } from '@/components/dashboard/SpeedtestWidget';
import { UptimeWidget } from '@/components/dashboard/UptimeWidget';
import { CalendarWidget } from '@/components/dashboard/CalendarWidget';
import { NotesWidget } from '@/components/dashboard/NotesWidget';
import { BookmarksWidget } from '@/components/dashboard/BookmarksWidget';
import { WeatherWidget } from '@/components/dashboard/WeatherWidget';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B/s';
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function NetworkOverview() {
  const { servers } = useServerStore();
  const { serverData } = useFleetStore();

  return (
    <GlassCard delay={0.3}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <ArrowUpDown className="w-3.5 h-3.5 text-blue-400" />
        </div>
        <span className="text-xs font-medium text-white/60">Netzwerk</span>
      </div>
      <div className="space-y-2.5">
        {servers.map(server => {
          const data = serverData[server.id];
          const network = data?.system?.network;
          const totalRx = network?.reduce((sum, n) => sum + (n.rxRate || 0), 0) ?? 0;
          const totalTx = network?.reduce((sum, n) => sum + (n.txRate || 0), 0) ?? 0;

          return (
            <div key={server.id} className="flex items-center gap-3">
              <span className="text-[11px] text-white/40 w-20 truncate">{server.name}</span>
              <div className="flex-1 flex items-center gap-4 text-[11px] tabular-nums">
                <span className="text-emerald-400/70">
                  <span className="text-white/20 mr-1">&darr;</span>
                  {formatBytes(totalRx)}
                </span>
                <span className="text-blue-400/70">
                  <span className="text-white/20 mr-1">&uarr;</span>
                  {formatBytes(totalTx)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

function ContainerOverview() {
  const { servers } = useServerStore();
  const { serverData } = useFleetStore();

  return (
    <GlassCard delay={0.35}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
        </div>
        <span className="text-xs font-medium text-white/60">Container pro Server</span>
      </div>
      <div className="space-y-2.5">
        {servers.map(server => {
          const data = serverData[server.id];
          const containers = data?.containers || [];
          const running = containers.filter(c => c.state === 'running').length;
          const total = containers.length;
          const percent = total > 0 ? (running / total) * 100 : 0;

          return (
            <div key={server.id} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white/40 truncate">{server.name}</span>
                <span className="text-[11px] text-white/50 tabular-nums">
                  <span className="text-cyan-400">{running}</span>/{total}
                </span>
              </div>
              <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500/60 to-cyan-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${percent}%` }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  style={{ boxShadow: '0 0 6px rgba(6,182,212,0.3)' }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

export function FleetBentoGrid() {
  return (
    <div className="bento-grid">
      {/* Row 1: Container overview + Network + Speedtest + Uptime */}
      <div className="bento-2x1">
        <ContainerOverview />
      </div>
      <div className="bento-1x1">
        <SpeedtestWidget />
      </div>
      <div className="bento-1x1">
        <UptimeWidget />
      </div>

      {/* Row 2: Network + Weather + Calendar */}
      <div className="bento-1x1">
        <NetworkOverview />
      </div>
      <div className="bento-1x1">
        <WeatherWidget />
      </div>
      <div className="bento-2x1">
        <CalendarWidget />
      </div>

      {/* Row 3: Bookmarks + Notes */}
      <div className="bento-2x1">
        <BookmarksWidget />
      </div>
      <div className="bento-2x1">
        <NotesWidget />
      </div>
    </div>
  );
}
