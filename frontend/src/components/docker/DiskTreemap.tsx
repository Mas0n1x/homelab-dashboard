'use client';

import { useQuery } from '@tanstack/react-query';
import { HardDrive } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import * as api from '@/lib/api';
import type { DiskUsage } from '@/lib/types';

function formatSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

interface TreemapItem {
  name: string
  size: number
  type: 'container' | 'image' | 'volume' | 'cache'
}

const TYPE_COLORS = {
  container: { bg: 'bg-cyan-500', text: 'text-cyan-300' },
  image: { bg: 'bg-indigo-500', text: 'text-indigo-300' },
  volume: { bg: 'bg-emerald-500', text: 'text-emerald-300' },
  cache: { bg: 'bg-amber-500', text: 'text-amber-300' },
};

export function DiskTreemap() {
  const { data: usage } = useQuery<DiskUsage>({
    queryKey: ['disk-usage'],
    queryFn: () => api.getDiskUsage() as Promise<DiskUsage>,
    staleTime: 60000,
  });

  if (!usage) return null;

  // Build flat items sorted by size
  const items: TreemapItem[] = [
    ...usage.containers.filter(c => c.rootFs > 0).map(c => ({ name: c.name, size: c.rootFs, type: 'container' as const })),
    ...usage.images.filter(i => i.size > 0).map(i => ({ name: i.repo, size: i.size, type: 'image' as const })),
    ...usage.volumes.filter(v => v.size > 0).map(v => ({ name: v.name.substring(0, 20), size: v.size, type: 'volume' as const })),
    ...(usage.buildCache > 0 ? [{ name: 'Build Cache', size: usage.buildCache, type: 'cache' as const }] : []),
  ].sort((a, b) => b.size - a.size);

  const totalSize = items.reduce((sum, i) => sum + i.size, 0);

  // Category totals
  const categories = [
    { type: 'image' as const, label: 'Images', total: usage.images.reduce((s, i) => s + i.size, 0) },
    { type: 'container' as const, label: 'Container', total: usage.containers.reduce((s, c) => s + c.rootFs, 0) },
    { type: 'volume' as const, label: 'Volumes', total: usage.volumes.reduce((s, v) => s + v.size, 0) },
    { type: 'cache' as const, label: 'Build Cache', total: usage.buildCache },
  ].filter(c => c.total > 0);

  return (
    <GlassCard delay={0.2}>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-white/40" />
            <span className="text-sm font-medium">Docker Speicher</span>
          </div>
          <span className="text-sm font-mono text-white/40">{formatSize(totalSize)}</span>
        </div>

        {/* Category bars */}
        <div className="flex gap-1 h-6 rounded-lg overflow-hidden mb-4">
          {categories.map(cat => (
            <div
              key={cat.type}
              className={`${TYPE_COLORS[cat.type].bg} opacity-60 hover:opacity-100 transition-opacity relative group`}
              style={{ width: `${Math.max((cat.total / totalSize) * 100, 2)}%` }}
              title={`${cat.label}: ${formatSize(cat.total)}`}
            >
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block text-xs bg-black/80 px-2 py-1 rounded whitespace-nowrap z-10">
                {cat.label}: {formatSize(cat.total)}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4">
          {categories.map(cat => (
            <div key={cat.type} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-sm ${TYPE_COLORS[cat.type].bg} opacity-70`} />
              <span className="text-xs text-white/40">{cat.label}</span>
              <span className={`text-xs font-mono ${TYPE_COLORS[cat.type].text}`}>{formatSize(cat.total)}</span>
            </div>
          ))}
        </div>

        {/* Top items */}
        <div className="space-y-1.5">
          {items.slice(0, 8).map((item, i) => (
            <div key={`${item.type}-${item.name}-${i}`} className="flex items-center gap-2">
              <div className={`w-1.5 h-4 rounded-full ${TYPE_COLORS[item.type].bg} opacity-60`} />
              <span className="text-xs truncate flex-1 text-white/60">{item.name}</span>
              <span className="text-xs font-mono text-white/40">{formatSize(item.size)}</span>
              <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className={`h-full rounded-full ${TYPE_COLORS[item.type].bg} opacity-50`}
                  style={{ width: `${(item.size / totalSize) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
