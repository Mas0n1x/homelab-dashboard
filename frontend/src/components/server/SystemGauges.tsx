'use client';

import { motion } from 'framer-motion';
import { Cpu, MemoryStick, HardDrive, Thermometer } from 'lucide-react';
import { clsx } from 'clsx';
import type { SystemStats } from '@/lib/types';

interface SystemGaugesProps {
  stats: SystemStats | null;
}

function ArcGauge({
  percent,
  label,
  icon,
  color,
  sublabel,
  size = 120,
}: {
  percent: number;
  label: string;
  icon: React.ReactNode;
  color: string;
  sublabel?: string;
  size?: number;
}) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius * 0.75; // 270 degree arc
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;

  return (
    <div className="glass-card-elevated p-4 flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[135deg]">
          {/* Background arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={0}
            strokeLinecap="round"
          />
          {/* Value arc */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ filter: `drop-shadow(0 0 6px ${color}50)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-white/30 mb-1">{icon}</span>
          <span className="text-2xl font-bold tabular-nums" style={{ color }}>
            {percent.toFixed(1)}%
          </span>
        </div>
      </div>
      <p className="text-xs font-medium text-white/60 mt-2">{label}</p>
      {sublabel && <p className="text-[10px] text-white/30 mt-0.5">{sublabel}</p>}
    </div>
  );
}

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

export function SystemGauges({ stats }: SystemGaugesProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="glass-card-elevated p-4 h-48 animate-pulse flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-white/[0.02]" />
          </div>
        ))}
      </div>
    );
  }

  const cpuColor = stats.cpu.total > 80 ? '#ef4444' : stats.cpu.total > 50 ? '#f59e0b' : '#10b981';
  const memColor = stats.memory.percent > 80 ? '#ef4444' : stats.memory.percent > 50 ? '#f59e0b' : '#8b5cf6';
  const mainDisk = stats.disk?.[0];
  const diskColor = mainDisk && mainDisk.percent > 90 ? '#ef4444' : mainDisk?.percent && mainDisk.percent > 75 ? '#f59e0b' : '#06b6d4';
  const temp = stats.temperature?.[0]?.value ?? null;
  const tempColor = temp !== null ? (temp > 75 ? '#ef4444' : temp > 60 ? '#f59e0b' : '#10b981') : '#6b7280';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <ArcGauge
        percent={stats.cpu.total}
        label="CPU"
        icon={<Cpu className="w-4 h-4" />}
        color={cpuColor}
        sublabel={`User: ${stats.cpu.user.toFixed(1)}% | Sys: ${stats.cpu.system.toFixed(1)}%`}
      />
      <ArcGauge
        percent={stats.memory.percent}
        label="Arbeitsspeicher"
        icon={<MemoryStick className="w-4 h-4" />}
        color={memColor}
        sublabel={`${formatBytes(stats.memory.used)} / ${formatBytes(stats.memory.total)}`}
      />
      {mainDisk && (
        <ArcGauge
          percent={mainDisk.percent}
          label="Speicher"
          icon={<HardDrive className="w-4 h-4" />}
          color={diskColor}
          sublabel={`${formatBytes(mainDisk.used)} / ${formatBytes(mainDisk.total)}`}
        />
      )}
      <ArcGauge
        percent={temp !== null ? Math.min((temp / 100) * 100, 100) : 0}
        label="Temperatur"
        icon={<Thermometer className="w-4 h-4" />}
        color={tempColor}
        sublabel={temp !== null ? `${temp.toFixed(1)}°C` : 'N/A'}
      />
    </div>
  );
}
