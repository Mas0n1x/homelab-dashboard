'use client';

import { HardDrive } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import type { DiskInfo } from '@/lib/types';

function formatBytes(bytes: number) {
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  return `${(bytes / 1e6).toFixed(0)} MB`;
}

function getColor(percent: number) {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 75) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function getTextColor(percent: number) {
  if (percent >= 90) return 'text-red-400';
  if (percent >= 75) return 'text-amber-400';
  return 'text-emerald-400';
}

export function DiskWidget({ disks }: { disks: DiskInfo[] }) {
  if (!disks || disks.length === 0) return null;

  return (
    <GlassCard delay={0.2}>
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <HardDrive className="w-4 h-4 text-white/40" />
          <span className="stat-label">Speicher</span>
        </div>
        <div className="space-y-2.5">
          {disks.map((d) => (
            <div key={d.mountPoint}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-white/50 truncate max-w-[120px]" title={d.mountPoint}>{d.mountPoint}</span>
                <span className={`text-xs font-medium ${getTextColor(d.percent)}`}>{d.percent.toFixed(0)}%</span>
              </div>
              <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${getColor(d.percent)}`} style={{ width: `${d.percent}%` }} />
              </div>
              <p className="text-[10px] text-white/30 mt-0.5">{formatBytes(d.used)} / {formatBytes(d.total)}</p>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
