/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, CheckCircle2, AlertTriangle, ExternalLink, Server,
  Sparkles, Trash2, Clock, RefreshCw,
} from 'lucide-react';
import { clsx } from 'clsx';
import { PageTransition } from '@/components/ui/PageTransition';
import { GlassCard } from '@/components/ui/GlassCard';
import * as api from '@/lib/api';
import type { StatusBoard, StatusService } from '@/lib/types';

const RANGES = [
  { days: 7, label: '7 T' },
  { days: 30, label: '30 T' },
  { days: 90, label: '90 T' },
];

function UptimeBars({ timeline }: { timeline: { date: string; uptime: number | null }[] }) {
  return (
    <div className="flex items-stretch gap-[2px] h-7 w-full" aria-hidden>
      {timeline.map((d, i) => {
        const c = d.uptime === null ? 'bg-white/[0.07]'
          : d.uptime >= 99 ? 'bg-emerald-400/80'
          : d.uptime >= 80 ? 'bg-amber-400/80'
          : 'bg-red-400/80';
        return (
          <div
            key={i}
            title={`${d.date}: ${d.uptime === null ? 'keine Daten' : d.uptime + ' % Verfügbarkeit'}`}
            className={clsx('flex-1 min-w-[2px] rounded-[2px] transition-colors hover:opacity-80', c)}
          />
        );
      })}
    </div>
  );
}

function relativeTime(iso: string | null) {
  if (!iso) return 'nie';
  const diff = Date.now() - Date.parse(iso);
  if (Number.isNaN(diff)) return 'unbekannt';
  const min = Math.round(diff / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const std = Math.round(min / 60);
  if (std < 24) return `vor ${std} Std.`;
  return `vor ${Math.round(std / 24)} Tagen`;
}

function ServiceRow({ svc }: { svc: StatusService }) {
  const isUp = svc.current !== false && !svc.vanished;
  const uptime = svc.uptime24h;

  return (
    <div
      className={clsx(
        'py-3 flex flex-col sm:flex-row sm:items-center gap-3',
        svc.vanished && 'opacity-50',
      )}
    >
      {/* Name + Zustand */}
      <div className="flex items-center gap-2.5 sm:w-56 flex-shrink-0 min-w-0">
        <span
          className={clsx(
            'w-2.5 h-2.5 rounded-full flex-shrink-0',
            svc.vanished ? 'bg-white/25'
              : isUp ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]'
              : 'bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.5)]',
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className={clsx('text-sm font-medium truncate', svc.vanished && 'line-through')}>{svc.name}</p>
            {svc.isNew && (
              <span className="flex items-center gap-0.5 flex-shrink-0 px-1.5 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-400/30 text-[9px] font-semibold text-cyan-300 uppercase tracking-wide">
                <Sparkles className="w-2.5 h-2.5" /> Neu
              </span>
            )}
            {svc.vanished && (
              <span className="flex items-center gap-0.5 flex-shrink-0 px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-[9px] font-semibold text-white/50 uppercase tracking-wide">
                <Trash2 className="w-2.5 h-2.5" /> Entfernt
              </span>
            )}
          </div>
          {svc.category && <p className="text-[10px] text-white/30 truncate">{svc.category}</p>}
        </div>
        {svc.url && !svc.vanished && (
          <a
            href={svc.url}
            target="_blank"
            rel="noreferrer"
            className="text-white/20 hover:text-white/60 transition-colors flex-shrink-0 p-1 -m-1"
            title="Dienst öffnen"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Verlauf */}
      <div className="flex-1 min-w-0">
        <UptimeBars timeline={svc.timeline} />
      </div>

      {/* Kennzahlen — mobil über die Breite verteilt statt rechts geklebt */}
      <div className="flex items-center gap-4 justify-between sm:w-44 sm:justify-end flex-shrink-0 text-xs tabular-nums">
        <div className="text-right w-14">
          <p className={clsx(
            'font-semibold',
            uptime === null ? 'text-white/30'
              : uptime >= 99 ? 'text-emerald-400'
              : uptime >= 80 ? 'text-amber-400'
              : 'text-red-400',
          )}>
            {uptime !== null ? `${uptime} %` : '–'}
          </p>
          <p className="text-[10px] text-white/25">24 Std.</p>
        </div>
        <div className="text-right w-16">
          <p className="text-white/50">{svc.avgResponseTime ? `${svc.avgResponseTime} ms` : '–'}</p>
          <p className="text-[10px] text-white/25">Ø Antwort</p>
        </div>
      </div>
    </div>
  );
}

export default function StatusPage() {
  const [days, setDays] = useState(30);

  const { data, isLoading, isFetching, refetch, error } = useQuery<StatusBoard>({
    queryKey: ['statusBoard', days],
    queryFn: () => api.getStatusBoard(days),
    // Das Board kommt aus der Datenbank und wird alle 60 Sekunden durch neue
    // Messwerte bewegt — öfter zu fragen bringt nichts.
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const { summary, groups } = useMemo(() => ({
    summary: data?.summary ?? { up: 0, down: 0, total: 0, servers: 0 },
    groups: data?.groups ?? [],
  }), [data]);

  const allOk = summary.down === 0 && summary.total > 0;

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Kopfzeile */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              Service <span className="text-gradient">Status</span>
            </h1>
            <p className="text-sm text-white/40 mt-1">
              Dienste erscheinen automatisch beim Deploy und verschwinden, sobald sie vom Server sind
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-xl bg-white/[0.03] border border-white/[0.06] p-0.5">
              {RANGES.map(r => (
                <button
                  key={r.days}
                  onClick={() => setDays(r.days)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    days === r.days ? 'bg-white/[0.09] text-white' : 'text-white/40 hover:text-white/70',
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => refetch()}
              className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white/80 transition-colors"
              title="Neu laden"
            >
              <RefreshCw className={clsx('w-4 h-4', isFetching && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Gesamtlage */}
        <div className={clsx(
          'flex items-center gap-4 p-5 rounded-2xl border',
          allOk ? 'bg-emerald-500/[0.07] border-emerald-500/20'
            : summary.down > 0 ? 'bg-amber-500/[0.07] border-amber-500/20'
            : 'bg-white/[0.02] border-white/[0.06]',
        )}>
          <div className={clsx(
            'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
            allOk ? 'bg-emerald-500/15' : 'bg-amber-500/15',
          )}>
            {allOk
              ? <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              : <AlertTriangle className="w-6 h-6 text-amber-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold">
              {isLoading ? 'Lade Status …'
                : allOk ? 'Alle Systeme betriebsbereit'
                : `${summary.down} von ${summary.total} Diensten offline`}
            </p>
            <p className="text-xs text-white/40 mt-0.5">
              {summary.up} online · {summary.total} überwacht · {summary.servers} Server
            </p>
          </div>
          <Activity className={clsx('w-5 h-5 flex-shrink-0', allOk ? 'text-emerald-400/50' : 'text-amber-400/50')} />
        </div>

        {error && (
          <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/[0.06] text-sm text-red-300">
            Status konnte nicht geladen werden: {(error as Error).message}
          </div>
        )}

        {/* Ladezustand als Platzhalter statt eines Textes — sonst springt die
            Seite beim Eintreffen der Daten. */}
        {isLoading && (
          <div className="space-y-3">
            {[0, 1].map(i => (
              <div key={i} className="h-40 rounded-2xl bg-white/[0.02] border border-white/[0.05] animate-pulse" />
            ))}
          </div>
        )}

        {/* Je Server ein Abschnitt */}
        {groups.map(g => (
          <div key={g.server.id}>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Server className="w-4 h-4 text-white/40 flex-shrink-0" />
              <h2 className="text-sm font-semibold">{g.server.name}</h2>
              <span className="text-xs text-white/30">{g.services.length} Dienste</span>
              {g.stale && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-400/25 text-[10px] text-amber-300">
                  <Clock className="w-2.5 h-2.5" />
                  Erkennung {relativeTime(g.lastDiscovery)}
                </span>
              )}
            </div>
            <GlassCard>
              <div className="relative z-10 divide-y divide-white/[0.05]">
                {g.services.length === 0 ? (
                  <p className="py-6 text-center text-sm text-white/30">
                    Keine Dienste erkannt — läuft auf diesem Server gerade nichts?
                  </p>
                ) : (
                  g.services.map(svc => <ServiceRow key={svc.id} svc={svc} />)
                )}
              </div>
            </GlassCard>
          </div>
        ))}

        {!isLoading && groups.length === 0 && (
          <p className="text-sm text-white/30 text-center py-8">Keine Server angebunden.</p>
        )}
      </div>
    </PageTransition>
  );
}
