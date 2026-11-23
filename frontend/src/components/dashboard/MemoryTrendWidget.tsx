/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { MemoryStick, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Sparkline } from '@/components/ui/Sparkline';
import { zahl } from '@/lib/formatters';
import * as api from '@/lib/api';
import type { MemoryTrend } from '@/lib/types';

/**
 * RAM-Grundbedarf je Server über mehrere Tage.
 *
 * Gemessen wird der niedrigste Stundenwert je Tag — die normale Tagesschwankung
 * fällt heraus, ein schleichendes Speicherleck nicht. Ohne drei volle Tage
 * Verlauf steht hier bewusst keine Aussage.
 */
export function MemoryTrendWidget() {
  const { data } = useQuery<MemoryTrend[]>({
    queryKey: ['memory-trends'],
    queryFn: api.getMemoryTrends,
    refetchInterval: 600000,
    staleTime: 300000,
    retry: false,
  });
  const liste = data ?? [];
  const leck = liste.filter(t => t.status === 'steigend');

  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-3">
        <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', leck.length ? 'bg-amber-500/12' : 'bg-violet-500/10')}>
          <MemoryStick className={clsx('w-3.5 h-3.5', leck.length ? 'text-amber-400' : 'text-violet-400')} />
        </div>
        <span className="text-xs font-medium text-white/70">RAM-Trend</span>
        <span className="ml-auto text-[11px] text-white/50">Ø je Tag</span>
      </div>
      {liste.length === 0 ? (
        <p className="text-[12px] text-white/50 py-4 text-center">Noch keine Daten.</p>
      ) : (
        <div className="space-y-2.5">
          {liste.map(t => {
            const Icon = t.status === 'steigend' ? TrendingUp : t.status === 'fallend' ? TrendingDown : Minus;
            const farbe = t.status === 'steigend' ? 'text-amber-300' : 'text-white/55';
            return (
              <div key={t.serverId} className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-white/70 truncate">{t.serverName}</span>
                    <span className={clsx('ml-auto text-[12px] tabular-nums flex items-center gap-1 flex-shrink-0', farbe)}>
                      <Icon className="w-3 h-3" />
                      {t.status === 'unbekannt' ? 'zu wenig Daten' : t.status === 'stabil' ? 'stabil' : `${t.slopePerDay! > 0 ? '+' : ''}${zahl(t.slopePerDay!, 1)} %/Tag`}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/50 truncate">
                    {t.status === 'unbekannt'
                      ? `${t.days} von 3 Tagen Verlauf`
                      : t.status === 'steigend' && t.daysUntilFull
                        ? `voll in ca. ${t.daysUntilFull} Tagen`
                        : `aktuell ${t.current != null ? zahl(t.current, 0) : '–'} % belegt`}
                  </p>
                </div>
                <Sparkline data={t.series.map(s => s.value)} color={t.status === 'steigend' ? '#f59e0b' : '#8b5cf6'} height={26} />
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
