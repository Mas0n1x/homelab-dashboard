'use client';

import { useQuery } from '@tanstack/react-query';
import { Box, Image, Server } from 'lucide-react';
import { SystemOverview } from '@/components/monitoring/SystemOverview';
import { CpuChart } from '@/components/monitoring/CpuChart';
import { MemoryChart } from '@/components/monitoring/MemoryChart';
import { NetworkChart } from '@/components/monitoring/NetworkChart';
import { FavoritesBar } from '@/components/dashboard/FavoritesBar';
import { SpeedtestWidget } from '@/components/dashboard/SpeedtestWidget';
import { SearchBar } from '@/components/dashboard/SearchBar';
import { WeatherWidget } from '@/components/dashboard/WeatherWidget';
import { GitHubWidget } from '@/components/dashboard/GitHubWidget';
import { CalendarWidget } from '@/components/dashboard/CalendarWidget';
import { BookmarksWidget } from '@/components/dashboard/BookmarksWidget';
import { NotesWidget } from '@/components/dashboard/NotesWidget';
import { DiskWidget } from '@/components/dashboard/DiskWidget';
import { UptimeWidget } from '@/components/dashboard/UptimeWidget';
import { GlassCard } from '@/components/ui/GlassCard';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { useServerStore } from '@/stores/serverStore';
import * as api from '@/lib/api';
import type { SystemStats, DockerInfo, Container, PortfolioData } from '@/lib/types';

export default function DashboardPage() {
  const { activeServerId, wsFallbackMode } = useServerStore();

  const { data: stats } = useQuery<SystemStats>({
    queryKey: ['systemStats', activeServerId],
    queryFn: () => api.getSystemStats() as Promise<SystemStats>,
    enabled: wsFallbackMode,
    refetchInterval: wsFallbackMode ? 5000 : false,
  });
  const { data: dockerInfo } = useQuery<DockerInfo>({
    queryKey: ['dockerInfo', activeServerId],
    queryFn: () => api.getDockerInfo() as Promise<DockerInfo>,
    enabled: wsFallbackMode,
    refetchInterval: wsFallbackMode ? 5000 : false,
  });
  const { data: containers } = useQuery<Container[]>({
    queryKey: ['containers', activeServerId],
    queryFn: () => api.getContainers() as Promise<Container[]>,
    enabled: wsFallbackMode,
    refetchInterval: wsFallbackMode ? 5000 : false,
  });
  const { data: portfolio } = useQuery<PortfolioData>({
    queryKey: ['portfolio'],
    queryFn: () => api.getPortfolioDashboard() as Promise<PortfolioData>,
    enabled: wsFallbackMode,
    refetchInterval: wsFallbackMode ? 30000 : false,
  });

  const running = containers?.filter(c => c.state === 'running').length || 0;
  const total = containers?.length || 0;

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <SearchBar />

      {/* Favorites */}
      <FavoritesBar />

      {/* System Stats */}
      <SystemOverview stats={stats || null} />

      {/* Docker + Uptime + Speedtest + Health */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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

        <UptimeWidget />
        <SpeedtestWidget />
      </div>

      {/* Disk Storage */}
      {stats?.disk && stats.disk.length > 0 && (
        <DiskWidget disks={stats.disk} />
      )}

      {/* Weather + Calendar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <WeatherWidget />
        <CalendarWidget />
        {portfolio ? (
          <GlassCard delay={0.3} glow="indigo" hover>
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <span className="stat-label">Portfolio Anfragen</span>
                <span className="stat-value text-accent-light block mt-1">
                  <AnimatedNumber value={portfolio.stats.openRequests} />
                </span>
              </div>
              <span className="text-sm text-white/30">{portfolio.stats.customers} Kunden</span>
            </div>
          </GlassCard>
        ) : (
          <BookmarksWidget />
        )}
      </div>

      {/* Bookmarks + Notes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {portfolio && <BookmarksWidget />}
        <NotesWidget />
      </div>

      {/* GitHub */}
      <GitHubWidget />

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
