/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { PackageSearch, RefreshCw, CheckCircle2, AlertTriangle, ChevronDown } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import * as api from '@/lib/api';
import type { ImageUpdateSummary } from '@/lib/types';

function vorZeit(iso: string | null) {
  if (!iso) return 'noch nie';
  const diff = Date.now() - Date.parse(iso);
  if (Number.isNaN(diff)) return 'unbekannt';
  const min = Math.round(diff / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const std = Math.round(min / 60);
  if (std < 24) return `vor ${std} Std.`;
  return `vor ${Math.round(std / 24)} Tagen`;
}

/**
 * Welche Container laufen auf einem veralteten Image?
 *
 * Die Prüfung selbst läuft alle 6 Stunden im Hintergrund und vergleicht nur
 * Digests bei der Registry — hier wird ausschließlich das Ergebnis gezeigt.
 * Ein Klick auf „Prüfen" stößt einen neuen Lauf an.
 */
export function ImageUpdatesWidget() {
  const queryClient = useQueryClient();
  const [offen, setOffen] = useState(false);

  const { data } = useQuery<ImageUpdateSummary>({
    queryKey: ['image-update-summary'],
    queryFn: api.getImageUpdateSummary,
    refetchInterval: 300000,
    staleTime: 120000,
    retry: false,
  });

  const pruefen = useMutation({
    mutationFn: api.refreshImageUpdates,
    onSuccess: (neu) => queryClient.setQueryData(['image-update-summary'], { ...neu, pending: false }),
  });

  const veraltet = data?.outdated ?? [];
  const anzahl = veraltet.length;
  const wartet = data?.pending || pruefen.isPending;

  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-3">
        <div className={clsx(
          'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
          anzahl > 0 ? 'bg-amber-500/12' : 'bg-emerald-500/10',
        )}>
          <PackageSearch className={clsx('w-3.5 h-3.5', anzahl > 0 ? 'text-amber-400' : 'text-emerald-400')} />
        </div>
        <span className="text-xs font-medium text-white/60">Image-Updates</span>
        <button
          onClick={() => pruefen.mutate()}
          disabled={pruefen.isPending}
          className="ml-auto p-1 rounded-lg text-white/25 hover:text-white/70 hover:bg-white/[0.05] transition-colors disabled:opacity-40"
          title="Jetzt prüfen (fragt die Registries ab)"
        >
          <RefreshCw className={clsx('w-3.5 h-3.5', pruefen.isPending && 'animate-spin')} />
        </button>
      </div>

      {wartet && !data?.checkedAt ? (
        <p className="text-[12px] text-white/25 py-4 text-center">
          {pruefen.isPending ? 'Fragt die Registries ab …' : 'Erste Prüfung läuft nach dem Start.'}
        </p>
      ) : anzahl === 0 ? (
        <div className="flex items-center gap-2.5 py-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-[13px] text-white/70">Alle Images aktuell</span>
          <span className="ml-auto text-[10px] text-white/25">{data?.counts.checked ?? 0} geprüft</span>
        </div>
      ) : (
        <>
          <button
            onClick={() => setOffen(v => !v)}
            className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-amber-400/20 bg-amber-500/[0.07] hover:bg-amber-500/[0.11] transition-colors mb-2"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="text-[13px] text-amber-200 text-left">
              {anzahl} {anzahl === 1 ? 'Container läuft' : 'Container laufen'} auf einem veralteten Image
            </span>
            <ChevronDown className={clsx('w-3.5 h-3.5 text-amber-300/50 ml-auto flex-shrink-0 transition-transform', offen && 'rotate-180')} />
          </button>

          {offen && (
            <div className="space-y-1.5 mb-2">
              {veraltet.slice(0, 10).map(c => (
                <div key={c.containerId} className="flex items-center gap-2.5">
                  <span className={clsx(
                    'w-1.5 h-1.5 rounded-full flex-shrink-0',
                    c.state === 'running' ? 'bg-emerald-400' : 'bg-white/25',
                  )} />
                  <span className="text-[12px] truncate min-w-0">{c.containerName}</span>
                  <span className="text-[10px] text-white/25 truncate flex-shrink-0 hidden sm:inline font-mono">
                    {c.image}
                  </span>
                </div>
              ))}
              {veraltet.length > 10 && (
                <p className="text-[10px] text-white/25 pl-4">und {veraltet.length - 10} weitere</p>
              )}
            </div>
          )}
        </>
      )}

      {/* Ein erreichtes Abruf-Limit MUSS sichtbar sein — sonst hält man ein
          unvollständiges Ergebnis für ein sauberes „alles aktuell". */}
      {data?.rateLimited && (
        <p className="text-[10px] text-amber-300/70 mt-1">
          Abruf-Limit der Registry erreicht — Ergebnis unvollständig.
        </p>
      )}

      <p className="text-[10px] text-white/20 mt-2">
        Geprüft {vorZeit(data?.checkedAt ?? null)}
        {(data?.counts.failed ?? 0) > 0 && ` · ${data?.counts.failed} nicht erreichbar`}
      </p>
    </GlassCard>
  );
}
