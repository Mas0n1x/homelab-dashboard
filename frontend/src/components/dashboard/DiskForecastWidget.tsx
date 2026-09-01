/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { HardDrive, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import * as api from '@/lib/api';
import type { DiskForecast, DiskForecastServer } from '@/lib/types';

function bytes(n: number | null) {
  if (n === null || !Number.isFinite(n)) return '–';
  const einheiten = ['B', 'KB', 'MB', 'GB', 'TB'];
  let wert = Math.abs(n);
  let i = 0;
  while (wert >= 1024 && i < einheiten.length - 1) { wert /= 1024; i++; }
  const zahl = wert.toFixed(wert >= 100 || i === 0 ? 0 : 1).replace('.', ',');
  return `${n < 0 ? '−' : ''}${zahl} ${einheiten[i]}`;
}

function tageText(tage: number) {
  if (tage < 1) return 'heute';
  if (tage === 1) return 'in 1 Tag';
  if (tage < 60) return `in ${tage} Tagen`;
  const monate = Math.round(tage / 30);
  if (monate < 24) return `in ~${monate} Monaten`;
  return `in ~${Math.round(tage / 365)} Jahren`;
}

/** Unter 30 Tagen wird es eng, unter 90 sollte man es im Blick haben. */
function dringlichkeit(tage: number | null) {
  if (tage === null) return 'unbekannt' as const;
  if (tage <= 30) return 'kritisch' as const;
  if (tage <= 90) return 'warnung' as const;
  return 'ruhig' as const;
}

/**
 * „Platte voll in ~N Tagen" statt nur des aktuellen Prozentwerts.
 *
 * Die Prognose kommt aus einer linearen Regression über die Tageswerte. Fehlt
 * Verlauf oder streuen die Werte zu stark, steht hier bewusst KEINE Zahl —
 * eine erfundene Prognose wäre schlimmer als gar keine.
 */
export function DiskForecastWidget() {
  const { data } = useQuery<DiskForecast>({
    queryKey: ['disk-forecast'],
    queryFn: () => api.getDiskForecast(30),
    refetchInterval: 600000,
    staleTime: 300000,
    retry: false,
  });

  const server = data?.servers ?? [];
  const kritisch = server.filter(s => dringlichkeit(s.daysUntilFull) === 'kritisch');

  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-3">
        <div className={clsx(
          'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
          kritisch.length > 0 ? 'bg-red-500/12' : 'bg-cyan-500/10',
        )}>
          <HardDrive className={clsx('w-3.5 h-3.5', kritisch.length > 0 ? 'text-red-400' : 'text-cyan-400')} />
        </div>
        <span className="text-xs font-medium text-white/60">Speicherplatz-Prognose</span>
        <span className="ml-auto text-[10px] text-white/20">{data?.windowDays ?? 30}-Tage-Trend</span>
      </div>

      {server.length === 0 ? (
        <p className="text-[12px] text-white/25 py-4 text-center">Noch keine Daten.</p>
      ) : (
        <div className="space-y-2.5">
          {server.map(s => <ServerZeile key={s.serverId} s={s} minDays={data?.minDays ?? 7} />)}
        </div>
      )}
    </GlassCard>
  );
}

function ServerZeile({ s, minDays }: { s: DiskForecastServer; minDays: number }) {
  const stufe = dringlichkeit(s.daysUntilFull);
  const prozent = s.percent ?? 0;

  const balken = stufe === 'kritisch' ? 'from-red-500/60 to-red-400'
    : stufe === 'warnung' ? 'from-amber-500/60 to-amber-400'
    : 'from-cyan-500/60 to-cyan-400';

  const TrendIcon = s.trend === 'steigend' ? TrendingUp : s.trend === 'fallend' ? TrendingDown : Minus;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[11px] text-white/45 truncate min-w-0">{s.serverName}</span>
        <span className="text-[11px] text-white/30 tabular-nums flex-shrink-0">
          {prozent ? `${prozent.toFixed(0)} %` : '–'}
        </span>
        <span className={clsx(
          'ml-auto text-[11px] tabular-nums flex-shrink-0 flex items-center gap-1',
          stufe === 'kritisch' ? 'text-red-300' : stufe === 'warnung' ? 'text-amber-300' : 'text-white/40',
        )}>
          <TrendIcon className="w-3 h-3" />
          {s.daysUntilFull !== null ? `voll ${tageText(s.daysUntilFull)}` : 'keine Prognose'}
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
        <div
          className={clsx('h-full rounded-full bg-gradient-to-r transition-all duration-500', balken)}
          style={{ width: `${Math.min(100, prozent)}%` }}
        />
      </div>

      <p className="text-[10px] text-white/25 mt-1 truncate">
        {s.daysUntilFull !== null ? (
          <>
            {bytes(s.usedBytes)} von {bytes(s.totalBytes)} · {bytes(s.bytesPerDay)}/Tag
            {/* Das Bestimmtheitsmaß gehört sichtbar dazu: eine Prognose aus
                verrauschten Daten sieht sonst genauso verlässlich aus. */}
            {s.confidence !== null && s.confidence < 0.7 && (
              <span className="text-amber-300/60"> · schwankt stark</span>
            )}
          </>
        ) : (
          s.reason || `Noch zu wenig Verlauf (${s.historyDays} von ${minDays} Tagen)`
        )}
      </p>
    </div>
  );
}
