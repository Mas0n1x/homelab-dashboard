/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { GitCompareArrows, Sparkles, Trash2, HardDriveDownload, ArrowRight } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import * as api from '@/lib/api';
import type { FleetChange } from '@/lib/types';

function vorZeit(iso: string) {
  const diff = Date.now() - Date.parse(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(diff)) return '';
  const min = Math.round(diff / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const std = Math.round(min / 60);
  if (std < 24) return `vor ${std} Std.`;
  return `vor ${Math.round(std / 24)} Tagen`;
}

/**
 * Was hat sich auf der Flotte verändert — und wann wurde zuletzt gesichert?
 *
 * Beide Fragen beantwortet sonst niemand von selbst: ein Deploy sieht man erst,
 * wenn man danach sucht, und ein stehengebliebenes Backup merkt man genau dann,
 * wenn man es braucht.
 */
export function ChangesWidget() {
  const { data } = useQuery({
    queryKey: ['fleet-changes'],
    queryFn: () => api.getFleetChanges(7),
    refetchInterval: 120000,
    staleTime: 60000,
    retry: false,
  });

  const { data: backupStatus } = useQuery({
    queryKey: ['backup-status-widget'],
    queryFn: api.getBackupStatus,
    refetchInterval: 300000,
    staleTime: 120000,
    retry: false,
  });

  const changes: FleetChange[] = data?.changes ?? [];
  const letztes = backupStatus?.latest as { completed_at?: string } | undefined;
  const backupAlterStunden = letztes?.completed_at
    ? (Date.now() - Date.parse(String(letztes.completed_at).replace(' ', 'T') + 'Z')) / 3600000
    : null;
  // Über 48 Stunden ohne Sicherung ist ein Zustand, den man sehen muss.
  const backupVeraltet = backupAlterStunden === null || backupAlterStunden > 48;

  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
          <GitCompareArrows className="w-3.5 h-3.5 text-violet-400" />
        </div>
        <span className="text-xs font-medium text-white/60">Änderungen &amp; Sicherung</span>
        <Link href="/status" className="ml-auto text-white/20 hover:text-white/60 transition-colors">
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Backup-Alter */}
      <div className={clsx(
        'flex items-center gap-2.5 p-2.5 rounded-xl border mb-3',
        backupVeraltet ? 'bg-amber-500/[0.07] border-amber-400/20' : 'bg-white/[0.02] border-white/[0.05]',
      )}>
        <HardDriveDownload className={clsx('w-3.5 h-3.5 flex-shrink-0', backupVeraltet ? 'text-amber-400' : 'text-emerald-400')} />
        <span className="text-[12px] min-w-0 truncate">
          {letztes?.completed_at
            ? <>Letztes Backup <span className="text-white/50">{vorZeit(String(letztes.completed_at))}</span></>
            : <span className="text-amber-200/80">Noch kein Backup abgeschlossen</span>}
        </span>
        <Link
          href="/settings"
          className="ml-auto flex-shrink-0 text-[10px] text-white/30 hover:text-white/70 transition-colors"
        >
          Einstellungen
        </Link>
      </div>

      {changes.length === 0 ? (
        <p className="text-[12px] text-white/25 py-3 text-center">
          Keine Zu- oder Abgänge in den letzten 7 Tagen.
        </p>
      ) : (
        <div className="space-y-1.5">
          {changes.slice(0, 6).map(c => (
            <div key={`${c.type}-${c.id}`} className="flex items-center gap-2.5">
              <span className={clsx(
                'w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0',
                c.type === 'neu' ? 'bg-cyan-500/12 text-cyan-300' : 'bg-white/[0.05] text-white/40',
              )}>
                {c.type === 'neu' ? <Sparkles className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
              </span>
              <span className={clsx('text-[12px] truncate min-w-0', c.type === 'entfernt' && 'text-white/45 line-through')}>
                {c.name}
              </span>
              <span className="text-[10px] text-white/25 truncate flex-shrink-0 hidden sm:inline">{c.server}</span>
              <span className="text-[10px] text-white/20 ml-auto flex-shrink-0 tabular-nums">{vorZeit(c.at)}</span>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
