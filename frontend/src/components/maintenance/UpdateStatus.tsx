'use client';

import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Package, AlertCircle, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { GlassCard } from '@/components/ui/GlassCard';
import * as api from '@/lib/api';
import type { UpdateStatus as UpdateStatusType } from '@/lib/types';

interface UpdateStatusProps {
  serverId: string;
}

export function UpdateStatus({ serverId }: UpdateStatusProps) {
  const { data, isLoading, error, refetch } = useQuery<UpdateStatusType>({
    queryKey: ['updates', serverId],
    queryFn: () => api.getUpdateStatus(serverId),
    refetchInterval: 60000,
  });

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <RefreshCw className="w-4 h-4 text-emerald-400" />
          </div>
          <h3 className="text-sm font-medium">System Updates</h3>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="btn-glass text-xs py-1 px-2.5 flex items-center gap-1.5"
        >
          <RefreshCw className={clsx('w-3 h-3', isLoading && 'animate-spin')} />
          Pruefen
        </button>
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-white/20 text-xs">Pruefe Updates...</div>
      ) : error ? (
        <div className="py-6 text-center text-red-400/60 text-xs">Fehler: {(error as Error).message}</div>
      ) : data?.error ? (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-amber-400/80">{data.error}</p>
            {data.lastCheck && (
              <p className="text-[10px] text-white/20 mt-1">
                Letzter Check: {new Date(data.lastCheck).toLocaleString('de-DE')}
              </p>
            )}
          </div>
        </div>
      ) : data?.available ? (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-amber-400">{data.count} Updates verfuegbar</span>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-hide">
            {data.packages.map((pkg, i) => (
              <div key={i} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-white/[0.02] text-xs">
                <span className="text-white/60 font-mono">{pkg.name}</span>
                <span className="text-white/25 text-[10px] font-mono">{pkg.version}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 py-4 justify-center">
          <CheckCircle className="w-4 h-4 text-emerald-400/60" />
          <span className="text-xs text-emerald-400/60">System ist aktuell</span>
        </div>
      )}
    </GlassCard>
  );
}
