'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Box, Image, Server } from 'lucide-react';
import { SystemOverview } from '@/components/monitoring/SystemOverview';
import { CpuChart } from '@/components/monitoring/CpuChart';
import { MemoryChart } from '@/components/monitoring/MemoryChart';
import { NetworkChart } from '@/components/monitoring/NetworkChart';
import { GlassCard } from '@/components/ui/GlassCard';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { useServerStore } from '@/stores/serverStore';
import type { SystemStats, DockerInfo, Container, PortfolioData } from '@/lib/types';

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { activeServerId } = useServerStore();

  const stats = queryClient.getQueryData<SystemStats>(['systemStats', activeServerId]);
  const dockerInfo = queryClient.getQueryData<DockerInfo>(['dockerInfo', activeServerId]);
  const containers = queryClient.getQueryData<Container[]>(['containers', activeServerId]);
  const portfolio = queryClient.getQueryData<PortfolioData>(['portfolio']);

  const running = containers?.filter(c => c.state === 'running').length || 0;
  const total = containers?.length || 0;

  return (
    <div className="space-y-6">
      {/* System Stats */}
      <SystemOverview stats={stats || null} />

      {/* Docker + Portfolio Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard delay={0.15} glow="cyan" hover>
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Container</span>
            <Box className="w-4 h-4 text-cyan-400/50" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="stat-value text-cyan-400">
              <AnimatedNumber value={running} />
            </span>
            <span className="text-white/30 text-sm">/ {total}</span>
          </div>
          <p className="text-xs text-white/30 mt-1">laufend</p>
        </GlassCard>

        <GlassCard delay={0.2} hover>
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Images</span>
            <Image className="w-4 h-4 text-white/30" />
          </div>
          <span className="stat-value">
            <AnimatedNumber value={dockerInfo?.images || 0} />
          </span>
          <p className="text-xs text-white/30 mt-1">Docker v{dockerInfo?.dockerVersion || '?'}</p>
        </GlassCard>

        <GlassCard delay={0.25} glow="emerald" hover>
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Uptime</span>
            <Server className="w-4 h-4 text-emerald-400/50" />
          </div>
          <span className="text-xl font-semibold text-emerald-400">{stats?.uptime || 'N/A'}</span>
        </GlassCard>

        {portfolio && (
          <GlassCard delay={0.3} glow="indigo" hover>
            <div className="flex items-center justify-between mb-2">
              <span className="stat-label">Portfolio Anfragen</span>
            </div>
            <span className="stat-value text-accent-light">
              <AnimatedNumber value={portfolio.stats.openRequests} />
            </span>
            <p className="text-xs text-white/30 mt-1">{portfolio.stats.customers} Kunden</p>
          </GlassCard>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CpuChart cpuTotal={stats?.cpu.total || 0} />
        <MemoryChart memPercent={stats?.memory.percent || 0} />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <NetworkChart network={stats?.network || null} />
      </div>
    </div>
  );
}
