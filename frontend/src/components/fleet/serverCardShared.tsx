/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Cloud, Eye, Wrench } from 'lucide-react';
import { clsx } from 'clsx';
import * as api from '@/lib/api';
import { zahl } from '@/lib/formatters';
import type { Server as ServerType, TunnelInfo, ServerAlertState } from '@/lib/types';
import type { ActiveAlert } from '@/lib/types';

export function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${zahl(gb, 1)} GB`;
  return `${zahl(bytes / (1024 * 1024), 0)} MB`;
}

export function formatRate(bytes: number): string {
  if (!bytes || bytes < 1) return '0 B/s';
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${zahl(bytes / Math.pow(1024, i), 1)} ${units[i]}`;
}

/** „12 days, 3:11:02" → „12 T 3 Std" — kurz genug für schmale Kartenspalten. */
export function kurzeLaufzeit(uptime: string | null | undefined): string {
  if (!uptime) return 'n. v.';
  const tage = uptime.match(/(\d+) days?/);
  const hm = uptime.match(/(\d+):(\d+)(?::\d+)?\s*$/);
  const h = hm ? Number(hm[1]) : 0;
  const m = hm ? Number(hm[2]) : 0;
  if (tage) return `${tage[1]} T ${h} Std`;
  return h > 0 ? `${h} Std ${m} Min` : `${m} Min`;
}

export function relativeTime(iso?: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (isNaN(then)) return null;
  const sec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (sec < 60) return `vor ${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `vor ${min} min`;
  const std = Math.round(min / 60);
  if (std < 24) return `vor ${std} h`;
  return `vor ${Math.round(std / 24)} d`;
}

export function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / (1000 * 60 * 60 * 24));
}

// Einlauf-Animationen nur beim ersten Erscheinen einer Karte. Wer von einer
// Unterseite zurücknavigiert, soll die Flotte sofort sehen und nicht noch einmal
// zusehen, wie sich Ringe und Balken füllen.
const gesehen = new Set<string>();
export function useFirstTime(key: string): boolean {
  const [erste] = useState(() => {
    const neu = !gesehen.has(key);
    gesehen.add(key);
    return neu;
  });
  return erste;
}

/** Klickbare Karte, die auch per Tastatur (Tab, Enter, Leertaste) bedienbar ist. */
export function useCardNav(server: ServerType) {
  const router = useRouter();
  const go = () => router.push(`/server/${server.id}`);
  return {
    role: 'link' as const,
    tabIndex: 0,
    'aria-label': `${server.name} öffnen`,
    onClick: go,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    },
  };
}

export function useTunnel(server: ServerType): TunnelInfo | undefined {
  const { data: tunnels } = useQuery<TunnelInfo[]>({
    queryKey: ['tunnels'],
    queryFn: () => api.getTunnels() as Promise<TunnelInfo[]>,
    refetchInterval: 60000,
  });
  // Zuordnung über tunnel_name (Betriebs-Metadaten) oder Namensgleichheit mit der Server-ID
  const key = (server.tunnel_name || server.name || '').toLowerCase();
  return (tunnels ?? []).find(t =>
    server.tunnel_name ? t.name.toLowerCase() === key : t.name.toLowerCase() === (server.id || '').toLowerCase());
}

const BADGE = 'flex items-center gap-1 text-[11px] uppercase tracking-wider px-1.5 py-0.5 rounded-md border';

/** Statuszeichen oben rechts: Alarm, Wartung, Tunnel, „nur Monitoring". */
export function StatusBadges({ alerts, maintenance, tunnel, monitorOnly }: {
  alerts: ActiveAlert[];
  maintenance: ServerAlertState['maintenance'];
  tunnel?: TunnelInfo;
  monitorOnly?: boolean;
}) {
  const tunnelColor = !tunnel ? '' : tunnel.status === 'healthy' ? 'text-emerald-400' : tunnel.status === 'degraded' ? 'text-amber-400' : 'text-red-400';
  return (
    <>
      {maintenance ? (
        <span className={clsx(BADGE, 'bg-sky-500/10 border-sky-500/25 text-sky-300')} title={`Wartung bis ${new Date(maintenance.until).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}${maintenance.reason ? ` · ${maintenance.reason}` : ''}`}>
          <Wrench className="w-2.5 h-2.5" /> Wartung
        </span>
      ) : alerts.length > 0 && (
        <span className={clsx(BADGE, 'bg-red-500/15 border-red-500/30 text-red-400')} title={alerts.map(a => `${a.label} ${zahl(a.value, 0)} (Schwelle ${a.limit})`).join(' · ')}>
          <AlertTriangle className="w-2.5 h-2.5" /> {alerts.length} {alerts.length > 1 ? 'Alarme' : 'Alarm'}
        </span>
      )}
      {tunnel && (
        <span className={clsx(BADGE, 'bg-white/[0.03] border-white/[0.06]', tunnelColor)} title={`Cloudflare-Tunnel: ${tunnel.status} (${tunnel.connections} Verbindungen)`}>
          <Cloud className="w-2.5 h-2.5" /> {tunnel.status === 'healthy' ? 'Tunnel' : tunnel.status}
        </span>
      )}
      {monitorOnly && (
        <span className={clsx(BADGE, 'text-white/50 bg-white/[0.03] border-white/[0.06]')}>
          <Eye className="w-2.5 h-2.5" /> Monitor
        </span>
      )}
    </>
  );
}
