'use client';

import { Cpu, MemoryStick, HardDrive, Thermometer, Clock, Wifi } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import type { SystemStats } from '@/lib/types';
import { formatBytes, formatBytesPerSec, formatPercent } from '@/lib/formatters';

interface SystemOverviewProps {
  stats: SystemStats | null;
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  const colorClass =
    color === 'indigo' ? 'from-indigo-500 to-indigo-400' :
    color === 'purple' ? 'from-purple-500 to-purple-400' :
    color === 'cyan' ? 'from-cyan-500 to-cyan-400' :
    color === 'amber' ? 'from-amber-500 to-amber-400' :
    value > 90 ? 'from-red-500 to-red-400' :
    value > 70 ? 'from-amber-500 to-amber-400' :
    'from-emerald-500 to-emerald-400';

  return (
    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${colorClass} transition-all duration-700 ease-out`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}

export function SystemOverview({ stats }: SystemOverviewProps) {
  if (!stats) return null;

  const mainDisk = stats.disk?.[0];
  const mainTemp = stats.temperature?.[0];
  const mainNet = stats.network?.[0];

  const cards = [
    {
      icon: Cpu,
      label: 'CPU',
      value: stats.cpu.total,
      suffix: '%',
      decimals: 1,
      color: 'indigo' as const,
      sub: `User: ${stats.cpu.user.toFixed(1)}% | Sys: ${stats.cpu.system.toFixed(1)}%`,
    },
    {
      icon: MemoryStick,
      label: 'RAM',
      value: stats.memory.percent,
      suffix: '%',
      decimals: 1,
      color: 'purple' as const,
      sub: `${formatBytes(stats.memory.used)} / ${formatBytes(stats.memory.total)}`,
    },
    {
      icon: HardDrive,
      label: 'Disk',
      value: mainDisk?.percent || 0,
      suffix: '%',
      decimals: 1,
      color: 'cyan' as const,
      sub: mainDisk ? `${formatBytes(mainDisk.used)} / ${formatBytes(mainDisk.total)}` : 'N/A',
    },
    {
      icon: Thermometer,
      label: 'Temperatur',
      value: mainTemp?.value || 0,
      suffix: '°C',
      decimals: 0,
      color: 'amber' as const,
      sub: mainTemp?.label || 'N/A',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <GlassCard key={card.label} delay={i * 0.08} glow={card.color === 'indigo' ? 'indigo' : card.color === 'cyan' ? 'cyan' : undefined} hover>
          <div className="flex items-center justify-between mb-3">
            <span className="stat-label">{card.label}</span>
            <card.icon className="w-4 h-4 text-white/30" />
          </div>
          <div className="stat-value mb-2">
            <AnimatedNumber value={card.value} decimals={card.decimals} suffix={card.suffix} />
          </div>
          <ProgressBar value={card.value} color={card.color} />
          <p className="text-xs text-white/40 mt-2">{card.sub}</p>
        </GlassCard>
      ))}
    </div>
  );
}
