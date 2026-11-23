/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { Server, Thermometer, Box, WifiOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { zahl } from '@/lib/formatters';
import { LEVEL_HEX, LEVEL_TEXT, type Level } from '@/lib/health';
import type { ServerData } from '@/stores/fleetStore';
import type { Server as ServerType } from '@/lib/types';
import { useServerMetrics } from './useServerMetrics';
import { StatusBadges, kurzeLaufzeit, relativeTime, useCardNav, useFirstTime, useTunnel } from './serverCardShared';

function MetricRow({ label, percent, level, right, animate }: {
  label: string; percent: number | null; level: Level; right: string; animate: boolean;
}) {
  const color = LEVEL_HEX[level];
  return (
    <div className="grid grid-cols-[3.25rem_1fr_auto] items-center gap-2.5">
      <span className="text-[11px] uppercase tracking-wider text-white/55">{label}</span>
      <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
        {percent != null && (
          <motion.div
            className="h-full rounded-full"
            style={{ background: color }}
            initial={animate ? { width: 0 } : false}
            animate={{ width: `${Math.min(percent, 100)}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
      </div>
      <span className={clsx('text-[12px] font-medium tabular-nums w-[4.5rem] text-right', percent == null ? 'text-white/45' : LEVEL_TEXT[level])}>{right}</span>
    </div>
  );
}

/** Kompakte Server-Karte: drei Balken + drei Fakten, immer gleich hoch. */
export function ServerCompactCard({ server, data, index }: { server: ServerType; data: ServerData; index: number }) {
  const m = useServerMetrics(server, data);
  const tunnel = useTunnel(server);
  const nav = useCardNav(server);
  const erste = useFirstTime(`compact:${server.id}`);
  const lastContact = relativeTime(server.lastSeen);

  return (
    <motion.div
      initial={erste ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: erste ? index * 0.06 : 0, ease: [0.16, 1, 0.3, 1] }}
      {...nav}
      className="group cursor-pointer h-full rounded-2xl focus-visible:outline-none"
    >
      <div className={clsx(
        'relative overflow-hidden glass-card glass-card-hover h-full flex flex-col',
        !m.isOnline && 'opacity-75',
        m.alerts.length > 0 && !m.maintenance && 'ring-1 ring-red-500/40 shadow-[0_0_24px_-4px_rgba(239,68,68,0.3)]',
      )}>
        <div className={clsx('absolute top-0 left-0 right-0 h-[2px]', !m.isOnline || (m.alerts.length && !m.maintenance) ? 'bg-gradient-to-r from-red-500/0 via-red-400 to-red-500/0' : 'bg-gradient-to-r from-emerald-500/0 via-emerald-400/60 to-emerald-500/0')} />
        <div className="relative z-10 p-4 flex-1 flex flex-col gap-3.5">
          <div className="flex items-start gap-3">
            <div className="relative flex-shrink-0">
              <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center border', m.isOnline ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20')}>
                <Server className={clsx('w-4 h-4', m.isOnline ? 'text-emerald-400' : 'text-red-400')} />
              </div>
              <span className={clsx('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0a0a1a]', m.isOnline ? 'bg-emerald-400 status-pulse-healthy' : 'bg-red-400')} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold truncate">{server.name}</h3>
              <p className="text-[11px] text-white/50 truncate font-mono">{server.host}</p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0 min-h-[22px]">
              {/* Höchstens ein Zeichen: zwei untereinander machen den Kopf höher und die Balken darunter
                  säßen in jeder Karte auf anderer Höhe. */}
              <StatusBadges alerts={m.alerts} maintenance={m.maintenance} tunnel={m.alerts.length || m.maintenance ? undefined : tunnel} />
            </div>
          </div>

          {!m.hasData ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-1.5 py-5 min-h-[104px]">
              {m.isOnline ? <span className="text-white/45 text-xs">Verbinde…</span> : (
                <>
                  <WifiOff className="w-6 h-6 text-red-400/50" />
                  <span className="text-sm font-medium text-red-400/80">Offline</span>
                  {lastContact && <span className="text-[11px] text-white/50">Letzter Kontakt {lastContact}</span>}
                </>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-2.5">
                <MetricRow label="CPU" percent={m.cpu} level={m.levels.cpu} right={`${zahl(m.cpu, 0)} %`} animate={erste} />
                <MetricRow label="RAM" percent={m.memFehlt ? null : m.mem} level={m.levels.ram} right={m.memFehlt ? 'n. v.' : `${zahl(m.mem, 0)} %`} animate={erste} />
                <MetricRow label="Platte" percent={m.diskFehlt ? null : m.disk} level={m.levels.disk} right={m.disk == null || m.diskFehlt ? 'n. v.' : `${zahl(m.disk, 0)} %`} animate={erste} />
              </div>
              <div className="mt-auto pt-3 border-t border-white/[0.05] grid grid-cols-[auto_auto_1fr] gap-x-3 text-[12px] tabular-nums">
                <span className={clsx('flex items-center gap-1.5', m.temp != null ? LEVEL_TEXT[m.levels.temp] : 'text-white/45')} title="Temperatur">
                  <Thermometer className="w-3.5 h-3.5 flex-shrink-0" />{m.temp != null ? `${zahl(m.temp, 0)} °C` : 'n. v.'}
                </span>
                <span className="flex items-center gap-1.5 text-white/70" title="Container (laufend/gesamt)">
                  <Box className={clsx('w-3.5 h-3.5 flex-shrink-0', m.hasDocker ? 'text-cyan-400/80' : 'text-white/45')} />
                  {m.hasDocker ? <><span className="text-cyan-400 font-semibold">{m.running}</span><span className="text-white/50">/{m.totalCt}</span></> : <span className="text-white/45">–</span>}
                </span>
                <span className="text-right text-white/55 font-mono whitespace-nowrap" title={`Uptime ${data.system?.uptime ?? ""}`}>{kurzeLaufzeit(data.system?.uptime)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

