'use client';

import { useQuery } from '@tanstack/react-query';
import { Network, Globe, ArrowDown, ArrowUp } from 'lucide-react';
import { clsx } from 'clsx';
import { GlassCard } from '@/components/ui/GlassCard';
import * as api from '@/lib/api';
import type { NetworkConfig } from '@/lib/types';

interface NetworkInfoProps {
  serverId: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatRate(bytesPerSec: number): string {
  if (bytesPerSec === 0) return '0 B/s';
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(1024));
  return `${(bytesPerSec / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function NetworkInfo({ serverId }: NetworkInfoProps) {
  const { data, isLoading, error } = useQuery<NetworkConfig>({
    queryKey: ['networkConfig', serverId],
    queryFn: () => api.getNetworkConfig(serverId),
    refetchInterval: 5000,
  });

  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
          <Network className="w-4 h-4 text-cyan-400" />
        </div>
        <div>
          <h3 className="text-sm font-medium">Netzwerk</h3>
          {data?.publicIp && (
            <p className="text-[10px] text-white/30 flex items-center gap-1">
              <Globe className="w-3 h-3" /> {data.publicIp}
            </p>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-white/20 text-xs">Lade...</div>
      ) : error ? (
        <div className="py-6 text-center text-red-400/60 text-xs">Fehler: {(error as Error).message}</div>
      ) : (
        <div className="space-y-3">
          {data?.interfaces.map(iface => (
            <div key={iface.name} className="glass-card-elevated p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={clsx(
                    'w-2 h-2 rounded-full',
                    iface.isUp ? 'bg-emerald-400' : 'bg-red-400'
                  )} />
                  <span className="text-xs font-medium font-mono">{iface.name}</span>
                </div>
                {iface.speed > 0 && (
                  <span className="text-[10px] text-white/20">{iface.speed} Mbit/s</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <ArrowDown className="w-3 h-3 text-emerald-400/60" />
                  <div>
                    <span className="text-white/30">RX: </span>
                    <span className="text-emerald-400/80 tabular-nums">{formatRate(iface.rxRate)}</span>
                    <span className="text-white/15 ml-1">({formatBytes(iface.rxBytes)})</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <ArrowUp className="w-3 h-3 text-blue-400/60" />
                  <div>
                    <span className="text-white/30">TX: </span>
                    <span className="text-blue-400/80 tabular-nums">{formatRate(iface.txRate)}</span>
                    <span className="text-white/15 ml-1">({formatBytes(iface.txBytes)})</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
