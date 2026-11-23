/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Server, Thermometer, Box, HardDrive, ArrowDown, ArrowUp, Cloud, MapPin, Wallet, CalendarClock, WifiOff, MemoryStick } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import * as api from '@/lib/api';
import { Sparkline } from '@/components/ui/Sparkline';
import type { ServerData } from '@/stores/fleetStore';
import type { Server as ServerType, MetricSample } from '@/lib/types';

import { zahl, formatUptime, formatPreis } from '@/lib/formatters';
import { LEVEL_HEX, LEVEL_TEXT } from '@/lib/health';
import { useServerMetrics } from './useServerMetrics';
import { StatusBadges, formatBytes, formatRate, relativeTime, daysUntil, useCardNav, useFirstTime, useTunnel } from './serverCardShared';

interface ServerNodeCardProps {
  server: ServerType;
  data: ServerData;
  index: number;
}

function CpuRingGauge({ percent, color, size = 60, animate }: { percent: number; color: string; size?: number; animate: boolean }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }} role="img" aria-label={`CPU ${Math.round(percent)} Prozent`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference}
          initial={animate ? { strokeDashoffset: circumference } : false}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 5px ${color}55)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold tabular-nums leading-none" style={{ color }}>{Math.round(percent)}%</span>
        <span className="text-[10px] uppercase tracking-wider text-white/50 mt-0.5">CPU</span>
      </div>
    </div>
  );
}

function StatBar({ label, percent, right, color, icon, animate }: { label: string; percent: number; right: string; color: string; icon: ReactNode; animate: boolean }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1 text-white/55">{icon}{label}</span>
        <span className="text-white/65 tabular-nums">{right}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}99, ${color})`, boxShadow: `0 0 8px ${color}40` }}
          initial={animate ? { width: 0 } : false}
          animate={{ width: `${Math.min(percent, 100)}%` }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

function MiniSpark({ label, value, series, color, unit, min, max }: { label: string; value: string; series: number[]; color: string; unit?: string; min?: number; max?: number }) {
  return (
    <div className="rounded-lg bg-white/[0.02] border border-white/[0.05] px-2 pt-1.5 pb-1 overflow-hidden">
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <span className="text-[10px] uppercase tracking-wider text-white/50">{label}</span>
        <span className="text-[11px] font-medium tabular-nums whitespace-nowrap" style={{ color }}>{value}<span className="text-white/45">{unit}</span></span>
      </div>
      <Sparkline data={series} color={color} height={24} min={min} max={max} />
    </div>
  );
}

/** Detailkarte: Ring, Sparklines, Balken, Laufwerke, Betriebs-Metadaten. */
export function ServerNodeCard({ server, data, index }: ServerNodeCardProps) {
  const { system } = data;
  const m = useServerMetrics(server, data);
  const tunnel = useTunnel(server);
  const nav = useCardNav(server);
  const erste = useFirstTime(`detail:${server.id}`);

  // Metrik-Verlauf für Sparklines (react-query dedupt je Server)
  const { data: metrics } = useQuery<MetricSample[]>({
    queryKey: ['metrics', server.id],
    queryFn: () => api.getMetrics(server.id, 60) as Promise<MetricSample[]>,
    refetchInterval: 30000,
    enabled: m.isOnline,
  });

  const { isOnline, hasData, cpu: cpuPercent, mem: memPercent, temp, hasDocker, running, totalCt, disks, rx: rxRate, tx: txRate, memFehlt, diskFehlt } = m;
  const memUsed = system?.memory.used ?? 0;
  const memTotal = system?.memory.total ?? 0;

  const cpuSeries = (metrics ?? []).map(x => x.cpu ?? 0);
  const memSeries = (metrics ?? []).map(x => x.mem ?? 0);
  const netSeries = (metrics ?? []).map(x => (x.rx ?? 0) + (x.tx ?? 0));

  // Betriebs-Metadaten
  const cost = server.monthly_cost != null ? `${formatPreis(server.monthly_cost, server.currency)}/mtl.` : null;
  const expDays = daysUntil(server.expires_at);
  const lastContact = relativeTime(server.lastSeen);

  const hasAlert = m.alerts.length > 0 && !m.maintenance;
  const aggPct = m.disk ?? 0;
  const barFarbe = (p: number) => (p > m.limits.disk! ? LEVEL_HEX.crit : p > (m.limits.disk ?? 90) - 15 ? LEVEL_HEX.warn : '#06b6d4');

  return (
    <motion.div
      initial={erste ? { opacity: 0, y: 20, scale: 0.97 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: erste ? index * 0.1 : 0, ease: [0.16, 1, 0.3, 1] }}
      {...nav}
      className="group cursor-pointer h-full rounded-2xl focus-visible:outline-none"
    >
      <div className={clsx('relative rounded-2xl overflow-hidden transition-all duration-300 glass-card glass-card-hover h-full flex flex-col', !isOnline && 'opacity-70', hasAlert && 'ring-1 ring-red-500/40 shadow-[0_0_24px_-4px_rgba(239,68,68,0.35)]')}>
        {/* Statusstreifen oben */}
        <div className={clsx('absolute top-0 left-0 right-0 h-[2px]', hasAlert ? 'bg-gradient-to-r from-red-500/0 via-red-400 to-red-500/0' : isOnline ? 'bg-gradient-to-r from-emerald-500/0 via-emerald-400/70 to-emerald-500/0' : 'bg-gradient-to-r from-red-500/0 via-red-400/70 to-red-500/0')} />

        <div className="relative z-10 p-4 sm:p-5 flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-start gap-3 mb-3 sm:mb-4">
            <div className="relative">
              <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', isOnline ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20')}>
                <Server className={clsx('w-5 h-5', isOnline ? 'text-emerald-400' : 'text-red-400')} />
              </div>
              <span className={clsx('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0a0a1a]', isOnline ? 'bg-emerald-400 status-pulse-healthy' : 'bg-red-400')} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold truncate group-hover:text-white transition-colors">{server.name}</h3>
              <p className="text-[12px] text-white/50 truncate font-mono">{server.host}</p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <StatusBadges alerts={m.alerts} maintenance={m.maintenance} tunnel={tunnel} monitorOnly={!hasDocker && hasData} />
            </div>
          </div>

          {/* Betriebs-Metadaten-Chips (nur wenn gesetzt) */}
          {(server.provider || server.location || cost || expDays != null) && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {server.provider && <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-white/60"><Cloud className="w-2.5 h-2.5" />{server.provider}</span>}
              {server.location && <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-white/60"><MapPin className="w-2.5 h-2.5" />{server.location}</span>}
              {cost && <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-white/60"><Wallet className="w-2.5 h-2.5" />{cost}</span>}
              {expDays != null && (
                <span className={clsx('flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border', expDays <= 14 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-white/[0.03] border-white/[0.06] text-white/60')}>
                  <CalendarClock className="w-2.5 h-2.5" />{expDays <= 0 ? 'abgelaufen' : `${expDays} T`}
                </span>
              )}
            </div>
          )}

          {!hasData ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              {isOnline ? (
                <span className="text-white/45 text-xs">Verbinde…</span>
              ) : (
                <>
                  <WifiOff className="w-8 h-8 text-red-400/50" />
                  <span className="text-sm font-medium text-red-400/80">Offline</span>
                  {lastContact && <span className="text-[12px] text-white/50">Letzter Kontakt {lastContact}</span>}
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              {/* CPU-Ring + Stat-Spalte — feste Höhe und immer drei Zeilen, damit die
                  Karten im Raster auf gleicher Höhe beginnen (auch ohne Docker/Sensor) */}
              <div className="flex items-center gap-4 mb-4 min-h-[76px]">
                <CpuRingGauge percent={cpuPercent} color={LEVEL_HEX[m.levels.cpu]} animate={erste} />
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Thermometer className={clsx('w-3.5 h-3.5', temp !== null ? LEVEL_TEXT[m.levels.temp] : 'text-white/45')} />
                    <span className={clsx('text-sm font-semibold tabular-nums', temp !== null ? LEVEL_TEXT[m.levels.temp] : 'text-white/50')}>
                      {temp !== null ? `${zahl(temp, 1)}°C` : 'n. v.'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Box className={clsx('w-3.5 h-3.5', hasDocker ? 'text-cyan-400/70' : 'text-white/45')} />
                    {hasDocker ? (
                      <span className="text-sm text-white/70 tabular-nums">
                        <span className="text-cyan-400 font-semibold">{running}</span>
                        <span className="text-white/50">/{totalCt}</span>
                        <span className="text-[11px] text-white/50 ml-1">Container</span>
                      </span>
                    ) : (
                      <span className="text-sm text-white/50">Kein Docker</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[12px] tabular-nums">
                    <span className="flex items-center gap-1 text-emerald-400/80"><ArrowDown className="w-3 h-3" />{formatRate(rxRate)}</span>
                    <span className="flex items-center gap-1 text-blue-400/80"><ArrowUp className="w-3 h-3" />{formatRate(txRate)}</span>
                  </div>
                </div>
              </div>

              {/* Sparklines (Verlauf 60 Min) — mobil aus: die Werte stehen
                  schon oben, der Verlauf gehört auf die Detailseite */}
              <div className="hidden sm:grid grid-cols-3 gap-2 mb-4">
                <MiniSpark label="CPU" value={`${Math.round(cpuPercent)}`} unit="%" series={cpuSeries} color={LEVEL_HEX[m.levels.cpu]} min={0} max={100} />
                <MiniSpark label="RAM" value={`${Math.round(memPercent)}`} unit="%" series={memSeries} color="#8b5cf6" min={0} max={100} />
                <MiniSpark label="Netz" value={formatRate(rxRate + txRate).split(' ')[0].replace(/,\d+$/, '')} unit={` ${formatRate(rxRate + txRate).split(' ')[1]}`} series={netSeries} color="#06b6d4" />
              </div>

              {/* RAM + Platte */}
              <div className="space-y-3">
                <StatBar label="RAM" percent={memFehlt ? 0 : memPercent} animate={erste} right={memFehlt ? 'n. v. (Gast-Agent nicht erreichbar)' : `${formatBytes(memUsed)} / ${formatBytes(memTotal)}`} color={m.levels.ram === 'ok' ? '#8b5cf6' : LEVEL_HEX[m.levels.ram]} icon={<MemoryStick className="w-2.5 h-2.5 text-violet-400/70" />} />
                {disks.length === 0 ? (
                  <StatBar label="Speicher" percent={0} animate={erste} right={diskFehlt ? 'n. v. (Gast-Agent nicht erreichbar)' : 'n. v.'} color="#06b6d4" icon={<HardDrive className="w-2.5 h-2.5 text-cyan-400/70" />} />
                ) : (
                  <>
                    <StatBar label="Speicher" percent={aggPct} animate={erste} right={`${formatBytes(m.diskUsed)} / ${formatBytes(m.diskTotal)}`} color={m.levels.disk === 'ok' ? '#06b6d4' : LEVEL_HEX[m.levels.disk]} icon={<HardDrive className="w-2.5 h-2.5 text-cyan-400/70" />} />
                    {/* Einzelne Laufwerke nur bei mehreren — bei einem wiederholte die Zeile den
                        Summenbalken. Mobil aus: der Summenbalken genügt. */}
                    {disks.length > 1 && (
                      <div className="hidden sm:block space-y-1 pl-4">
                        {disks.map(d => (
                          <div key={d.device} className="flex items-center gap-2 text-[11px] text-white/50">
                            <span className="font-mono text-white/60 w-14 truncate" title={`${d.mountPoint} (${d.device})`}>{d.mountPoint}</span>
                            <div className="flex-1 h-1 rounded-full bg-white/[0.07] overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(d.percent || 0, 100)}%`, background: barFarbe(d.percent || 0) }} />
                            </div>
                            <span className="tabular-nums text-right whitespace-nowrap">{formatBytes(d.used)} / {formatBytes(d.total)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer: Uptime — immer am Kartenboden, egal wie viele Zeilen darüber stehen */}
              <div className="mt-auto pt-3">
                <div className="pt-3 border-t border-white/[0.05] flex items-center justify-between">
                  <span className="text-[11px] text-white/50">Uptime</span>
                  <span className="text-[12px] text-white/60 font-mono">{formatUptime(system?.uptime)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{ background: `radial-gradient(circle at 50% 0%, ${isOnline ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)'}, transparent 70%)` }} />
      </div>
    </motion.div>
  );
}
