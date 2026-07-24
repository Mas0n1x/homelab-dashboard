/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { Settings2, CheckCircle, XCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { GlassCard } from '@/components/ui/GlassCard';
import * as api from '@/lib/api';
import type { SystemdService } from '@/lib/types';

interface SystemdServicesProps {
  serverId: string;
}

export function SystemdServices({ serverId }: SystemdServicesProps) {
  const { data: services, isLoading, error } = useQuery<SystemdService[]>({
    queryKey: ['systemd', serverId],
    queryFn: () => api.getSystemdServices(serverId),
    refetchInterval: 10000,
  });

  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
          <Settings2 className="w-4 h-4 text-purple-400" />
        </div>
        <div>
          <h3 className="text-sm font-medium">Systemd Services</h3>
          <p className="text-[10px] text-white/30">Via Glances Monitoring</p>
        </div>
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-white/20 text-xs">Lade Services...</div>
      ) : error ? (
        <div className="py-6 text-center text-red-400/60 text-xs">Fehler: {(error as Error).message}</div>
      ) : !services || services.length === 0 ? (
        <div className="py-6 text-center text-white/20 text-xs">
          <p>Keine überwachten Services</p>
          <p className="text-[10px] text-white/10 mt-1">Services in der Glances-Konfiguration hinzufügen</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {services.map(service => (
            <div key={service.name} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/[0.02] transition-colors">
              {service.status === 'running' ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              )}
              <span className="text-xs font-medium flex-1 truncate">{service.name}</span>
              {service.cpu > 0 && (
                <span className="text-[10px] text-white/30 tabular-nums">
                  CPU {service.cpu.toFixed(1)}%
                </span>
              )}
              {service.mem > 0 && (
                <span className="text-[10px] text-white/30 tabular-nums">
                  MEM {service.mem.toFixed(1)}%
                </span>
              )}
              <span className={clsx(
                'text-[10px] px-1.5 py-0.5 rounded-full',
                service.status === 'running' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
              )}>
                {service.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
