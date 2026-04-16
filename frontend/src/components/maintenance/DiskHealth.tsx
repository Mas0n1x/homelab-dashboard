'use client';

import { useQuery } from '@tanstack/react-query';
import { HardDrive, ArrowDown, ArrowUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { GlassCard } from '@/components/ui/GlassCard';
import * as api from '@/lib/api';
import type { DiskHealthInfo } from '@/lib/types';

interface DiskHealthProps {
  serverId: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatRate(bytes: number): string {
  return formatBytes(bytes) + '/s';
}

export function DiskHealth({ serverId }: DiskHealthProps) {
  const { data, isLoading, error } = useQuery<DiskHealthInfo>({
    queryKey: ['diskHealth', serverId],
    queryFn: () => api.getDiskHealth(serverId),
    refetchInterval: 10000,
  });

  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
          <HardDrive className="w-4 h-4 text-amber-400" />
        </div>
        <h3 className="text-sm font-medium">Disk Health</h3>
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-white/20 text-xs">Lade...</div>
      ) : error ? (
        <div className="py-6 text-center text-red-400/60 text-xs">Fehler: {(error as Error).message}</div>
      ) : (
        <div className="space-y-3">
          {data?.disks.map(disk => {
            const color = disk.percent > 90 ? '#ef4444' : disk.percent > 75 ? '#f59e0b' : '#10b981';
            return (
              <div key={disk.mountPoint} className="glass-card-elevated p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-xs font-mono font-medium">{disk.mountPoint}</span>
                    <span className="text-[10px] text-white/20 ml-2">{disk.device}</span>
                  </div>
                  <span className="text-[10px] text-white/20">{disk.fsType}</span>
                </div>
                <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden mb-1.5">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${disk.percent}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-white/30">
                  <span>{formatBytes(disk.used)} belegt</span>
                  <span style={{ color }} className="font-semibold">{disk.percent.toFixed(1)}%</span>
                  <span>{formatBytes(disk.free)} frei</span>
                </div>
              </div>
            );
          })}

          {/* Disk I/O */}
          {data?.io && data.io.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/[0.04]">
              <p className="text-[10px] uppercase tracking-wider text-white/20 mb-2">I/O</p>
              <div className="space-y-1.5">
                {data.io.map(io => (
                  <div key={io.name} className="flex items-center gap-3 text-[11px]">
                    <span className="text-white/40 font-mono w-16 truncate">{io.name}</span>
                    <div className="flex items-center gap-1 text-emerald-400/60">
                      <ArrowDown className="w-3 h-3" />
                      <span className="tabular-nums">{formatRate(io.readRate)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-blue-400/60">
                      <ArrowUp className="w-3 h-3" />
                      <span className="tabular-nums">{formatRate(io.writeRate)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}
