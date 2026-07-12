/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, CheckCircle2, AlertTriangle, ExternalLink, Server } from 'lucide-react';
import { clsx } from 'clsx';
import { PageTransition } from '@/components/ui/PageTransition';
import { GlassCard } from '@/components/ui/GlassCard';
import { useServerStore } from '@/stores/serverStore';
import * as api from '@/lib/api';
import type { ServiceStatusEntry } from '@/lib/types';

interface Svc { id: string; name: string; url?: string | null; category?: string; state?: string; }

function UptimeBars({ timeline }: { timeline: { date: string; uptime: number | null }[] }) {
  return (
    <div className="flex items-stretch gap-[2px] h-7 w-full">
      {timeline.map((d, i) => {
        const c = d.uptime === null ? 'bg-white/[0.07]'
          : d.uptime >= 99 ? 'bg-emerald-400/80'
          : d.uptime >= 80 ? 'bg-amber-400/80'
          : 'bg-red-400/80';
        return (
          <div
            key={i}
            title={`${d.date}: ${d.uptime === null ? 'keine Daten' : d.uptime + '% Uptime'}`}
            className={clsx('flex-1 min-w-[3px] rounded-[2px] transition-colors hover:opacity-80', c)}
          />
        );
      })}
    </div>
  );
}

export default function StatusPage() {
  const { servers } = useServerStore();

  const { data, isLoading } = useQuery({
    queryKey: ['statusBoard', servers.map(s => s.id).join(',')],
    queryFn: async () => {
      return Promise.all(servers.map(async s => {
        const [services, status] = await Promise.all([
          api.getServices(s.id).catch(() => []) as Promise<Svc[]>,
          api.getUptimeStatus(s.id, 30).catch(() => ({})) as Promise<Record<string, ServiceStatusEntry>>,
        ]);
        return { server: s, services: Array.isArray(services) ? services : [], status };
      }));
    },
    refetchInterval: 60000,
    enabled: servers.length > 0,
  });

  const groups = data ?? [];
  let up = 0, down = 0, total = 0;
  for (const g of groups) {
    for (const svc of g.services) {
      const e = g.status[svc.id];
      const isUp = e ? e.current !== false : svc.state === 'running';
      total++;
      if (isUp) up++; else down++;
    }
  }
  const allOk = down === 0 && total > 0;

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Service <span className="text-gradient">Status</span>
          </h1>
          <p className="text-sm text-white/40 mt-1">Live-Verfügbarkeit aller überwachten Dienste, 30-Tage-Verlauf</p>
        </div>

        {/* Gesamt-Banner */}
        <div className={clsx('flex items-center gap-4 p-5 rounded-2xl border', allOk ? 'bg-emerald-500/[0.07] border-emerald-500/20' : down > 0 ? 'bg-amber-500/[0.07] border-amber-500/20' : 'bg-white/[0.02] border-white/[0.06]')}>
          <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center', allOk ? 'bg-emerald-500/15' : 'bg-amber-500/15')}>
            {allOk ? <CheckCircle2 className="w-6 h-6 text-emerald-400" /> : <AlertTriangle className="w-6 h-6 text-amber-400" />}
          </div>
          <div className="flex-1">
            <p className="text-base font-semibold">{allOk ? 'Alle Systeme betriebsbereit' : `${down} von ${total} Diensten offline`}</p>
            <p className="text-xs text-white/40 mt-0.5">{up} online · {total} überwacht · {servers.length} Server</p>
          </div>
          <Activity className={clsx('w-5 h-5', allOk ? 'text-emerald-400/50' : 'text-amber-400/50')} />
        </div>

        {isLoading && <p className="text-sm text-white/30 text-center py-8">Lade Status...</p>}

        {/* Je Server eine Sektion */}
        {groups.map(g => {
          if (g.services.length === 0) return null;
          const sorted = [...g.services].sort((a, b) => {
            const ea = g.status[a.id], eb = g.status[b.id];
            const ua = ea ? ea.current !== false : a.state === 'running';
            const ub = eb ? eb.current !== false : b.state === 'running';
            return (ua === ub) ? a.name.localeCompare(b.name) : (ua ? 1 : -1); // offline zuerst
          });
          return (
            <div key={g.server.id}>
              <div className="flex items-center gap-2 mb-3">
                <Server className="w-4 h-4 text-white/40" />
                <h2 className="text-sm font-semibold">{g.server.name}</h2>
                <span className="text-xs text-white/30">{g.services.length} Dienste</span>
              </div>
              <GlassCard>
                <div className="relative z-10 divide-y divide-white/[0.05]">
                  {sorted.map(svc => {
                    const e = g.status[svc.id];
                    const isUp = e ? e.current !== false : svc.state === 'running';
                    const hasData = !!e;
                    const uptime = e?.uptime24h;
                    const timeline = e?.timeline ?? Array.from({ length: 30 }, () => ({ date: '', uptime: null }));
                    return (
                      <div key={svc.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-2.5 sm:w-52 flex-shrink-0 min-w-0">
                          <span className={clsx('w-2.5 h-2.5 rounded-full flex-shrink-0', isUp ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.5)]')} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{svc.name}</p>
                            {svc.category && <p className="text-[10px] text-white/30 truncate">{svc.category}</p>}
                          </div>
                          {svc.url && (
                            <a href={svc.url} target="_blank" rel="noreferrer" onClick={e2 => e2.stopPropagation()} className="text-white/20 hover:text-white/60 transition-colors flex-shrink-0">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <UptimeBars timeline={timeline} />
                        </div>
                        <div className="flex items-center gap-4 sm:w-40 justify-end flex-shrink-0 text-xs tabular-nums">
                          <div className="text-right">
                            <p className={clsx('font-semibold', !hasData ? 'text-white/30' : (uptime ?? 0) >= 99 ? 'text-emerald-400' : (uptime ?? 0) >= 80 ? 'text-amber-400' : 'text-red-400')}>
                              {hasData && uptime !== null ? `${uptime}%` : '–'}
                            </p>
                            <p className="text-[10px] text-white/25">24h</p>
                          </div>
                          <div className="text-right w-14">
                            <p className="text-white/50">{e?.avgResponseTime ? `${e.avgResponseTime}ms` : '–'}</p>
                            <p className="text-[10px] text-white/25">Ø Antwort</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            </div>
          );
        })}
      </div>
    </PageTransition>
  );
}
