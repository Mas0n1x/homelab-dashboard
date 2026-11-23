/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { clsx } from 'clsx';
import { zahl } from '@/lib/formatters';
import { LEVEL_HEX, LEVEL_TEXT, type Level } from '@/lib/health';
import type { ServerData } from '@/stores/fleetStore';
import type { Server as ServerType } from '@/lib/types';
import { useServerMetrics } from './useServerMetrics';
import { StatusBadges, kurzeLaufzeit, useCardNav, useTunnel } from './serverCardShared';

/** Gemeinsames Spaltenraster für Kopf- und Datenzeilen — nur so bleiben sie bündig. */
export const LIST_GRID = 'grid items-center gap-x-4 grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_4.5rem] md:grid-cols-[minmax(0,1.6fr)_5rem_5rem_5rem_4.5rem_4.5rem_6.5rem]';

function Cell({ value, percent, level }: { value: string; percent: number | null; level: Level }) {
  return (
    <div className="space-y-1">
      <div className={clsx('text-[12px] font-medium tabular-nums', percent == null ? 'text-white/45' : LEVEL_TEXT[level])}>{value}</div>
      <div className="h-1 rounded-full bg-white/[0.07] overflow-hidden">
        {percent != null && <div className="h-full rounded-full" style={{ width: `${Math.min(percent, 100)}%`, background: LEVEL_HEX[level] }} />}
      </div>
    </div>
  );
}

export function ServerListHeader() {
  const th = 'text-[11px] uppercase tracking-wider text-white/50';
  return (
    <div className={clsx(LIST_GRID, 'px-4 py-2 border-b border-white/[0.06]')} aria-hidden="true">
      <span className={th}>Server</span>
      <span className={th}>CPU</span>
      <span className={th}>RAM</span>
      <span className={th}>Platte</span>
      <span className={clsx(th, 'hidden md:block')}>Temp</span>
      <span className={clsx(th, 'hidden md:block')}>Docker</span>
      <span className={clsx(th, 'hidden md:block text-right')}>Uptime</span>
    </div>
  );
}

export function ServerListRow({ server, data }: { server: ServerType; data: ServerData }) {
  const m = useServerMetrics(server, data);
  const tunnel = useTunnel(server);
  const nav = useCardNav(server);
  const alarm = m.alerts.length > 0 && !m.maintenance;

  return (
    <div
      {...nav}
      className={clsx(
        LIST_GRID, 'px-4 py-3 cursor-pointer border-b border-white/[0.04] last:border-b-0 transition-colors hover:bg-white/[0.04] focus-visible:bg-white/[0.06] focus-visible:outline-none',
        !m.isOnline && 'opacity-70', alarm && 'bg-red-500/[0.05]',
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={clsx('w-2.5 h-2.5 rounded-full flex-shrink-0', m.isOnline ? 'bg-emerald-400 status-pulse-healthy' : 'bg-red-400')} />
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{server.name}</div>
          <div className="text-[11px] text-white/50 font-mono truncate">{m.isOnline ? server.host : 'Offline'}</div>
        </div>
        <div className="hidden sm:flex items-center gap-1 ml-auto flex-shrink-0">
          <StatusBadges alerts={m.alerts} maintenance={m.maintenance} tunnel={tunnel} />
        </div>
      </div>
      {m.hasData ? (
        <>
          <Cell value={`${zahl(m.cpu, 0)} %`} percent={m.cpu} level={m.levels.cpu} />
          <Cell value={m.memFehlt ? 'n. v.' : `${zahl(m.mem, 0)} %`} percent={m.memFehlt ? null : m.mem} level={m.levels.ram} />
          <Cell value={m.disk == null || m.diskFehlt ? 'n. v.' : `${zahl(m.disk, 0)} %`} percent={m.diskFehlt ? null : m.disk} level={m.levels.disk} />
          <span className={clsx('hidden md:block text-[12px] tabular-nums', m.temp != null ? LEVEL_TEXT[m.levels.temp] : 'text-white/45')}>{m.temp != null ? `${zahl(m.temp, 0)} °C` : 'n. v.'}</span>
          <span className="hidden md:block text-[12px] tabular-nums text-white/70">
            {m.hasDocker ? <><span className="text-cyan-400 font-semibold">{m.running}</span><span className="text-white/50">/{m.totalCt}</span></> : <span className="text-white/45">–</span>}
          </span>
          <span className="hidden md:block text-right text-[12px] text-white/55 font-mono">{kurzeLaufzeit(data.system?.uptime)}</span>
        </>
      ) : (
        <span className="col-span-3 md:col-span-6 text-[12px] text-white/50">{m.isOnline ? 'Verbinde…' : 'Keine Messwerte'}</span>
      )}
    </div>
  );
}
