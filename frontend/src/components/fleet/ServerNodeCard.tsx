/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Server, Thermometer, Box, HardDrive, ArrowDown, ArrowUp, Eye, Cloud, MapPin, Wallet, CalendarClock, WifiOff, MemoryStick, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import * as api from '@/lib/api';
import { Sparkline } from '@/components/ui/Sparkline';
import type { ServerData } from '@/stores/fleetStore';
import type { Server as ServerType, MetricSample, TunnelInfo } from '@/lib/types';

interface ServerNodeCardProps {
  server: ServerType;
  data: ServerData;
  index: number;
}

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

function formatRate(bytes: number): string {
  if (!bytes || bytes < 1) return '0 B/s';
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function relativeTime(iso?: string | null): string | null {
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

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / (1000 * 60 * 60 * 24));
}

function CpuRingGauge({ percent, size = 60 }: { percent: number; size?: number }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const color = percent > 90 ? '#ef4444' : percent > 70 ? '#f59e0b' : '#10b981';

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 5px ${color}55)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold tabular-nums leading-none" style={{ color }}>{Math.round(percent)}%</span>
        <span className="text-[8px] uppercase tracking-wider text-white/30 mt-0.5">CPU</span>
      </div>
    </div>
  );
}

function StatBar({ label, percent, right, color, icon }: { label: string; percent: number; right: string; color: string; icon: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px]">
        <span className="flex items-center gap-1 text-white/40">{icon}{label}</span>
        <span className="text-white/50 tabular-nums">{right}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}80, ${color})`, boxShadow: `0 0 8px ${color}40` }}
          initial={{ width: 0 }}
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
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] uppercase tracking-wider text-white/30">{label}</span>
        <span className="text-[10px] font-medium tabular-nums" style={{ color }}>{value}<span className="text-white/25">{unit}</span></span>
      </div>
      <Sparkline data={series} color={color} height={24} min={min} max={max} />
    </div>
  );
}

export function ServerNodeCard({ server, data, index }: ServerNodeCardProps) {
  const router = useRouter();
  const { system, containers } = data;

  const isOnline = server.status === 'connected';
  const hasData = system !== null;

  // Metrik-Verlauf für Sparklines (react-query dedupt je Server)
  const { data: metrics } = useQuery<MetricSample[]>({
    queryKey: ['metrics', server.id],
    queryFn: () => api.getMetrics(server.id, 60) as Promise<MetricSample[]>,
    refetchInterval: 30000,
    enabled: isOnline,
  });

  // Tunnel-Status (ein geteilter Fetch für alle Karten)
  const { data: tunnels } = useQuery<TunnelInfo[]>({
    queryKey: ['tunnels'],
    queryFn: () => api.getTunnels() as Promise<TunnelInfo[]>,
    refetchInterval: 60000,
  });

  // Konfigurierbare Alert-Schwellen (geteilter Fetch)
  const { data: thresholds } = useQuery<{ cpu: number; ram: number; disk: number; temp: number }>({
    queryKey: ['alertThresholds'],
    queryFn: () => api.getAlertThresholds() as Promise<any>,
    staleTime: 60000,
  });
  const TH = thresholds ?? { cpu: 90, ram: 90, disk: 90, temp: 75 };

  const cpuPercent = system?.cpu.total ?? 0;
  const memPercent = system?.memory.percent ?? 0;
  const memUsed = system?.memory.used ?? 0;
  const memTotal = system?.memory.total ?? 0;
  const temp = system?.temperature?.[0]?.value ?? null;

  const hasDocker = !!(server.is_local || server.docker_socket || server.docker_host || server.ssh_host);
  const running = containers?.filter(c => c.state === 'running').length ?? 0;
  const totalCt = containers?.length ?? 0;

  const disks = system?.disk ?? [];
  const net = system?.network ?? [];
  const rxRate = net.reduce((s, n) => s + (n.rxRate || 0), 0);
  const txRate = net.reduce((s, n) => s + (n.txRate || 0), 0);

  const memColor = memPercent > 90 ? '#ef4444' : memPercent > 70 ? '#f59e0b' : '#8b5cf6';
  const tempColor = temp !== null
    ? temp >= 75 ? 'text-red-400' : temp >= 60 ? 'text-amber-400' : 'text-emerald-400'
    : 'text-white/30';

  // Sparkline-Serien
  const cpuSeries = (metrics ?? []).map(m => m.cpu ?? 0);
  const memSeries = (metrics ?? []).map(m => m.mem ?? 0);
  const netSeries = (metrics ?? []).map(m => (m.rx ?? 0) + (m.tx ?? 0));

  // Tunnel diesem Server zuordnen (via tunnel_name-Metadaten oder Namensgleichheit)
  const tunnelKey = (server.tunnel_name || server.name || '').toLowerCase();
  const tunnel = (tunnels ?? []).find(t =>
    server.tunnel_name ? t.name.toLowerCase() === tunnelKey : (t.name.toLowerCase() === (server.id || '').toLowerCase())
  );
  const tunnelColor = !tunnel ? '' : tunnel.status === 'healthy' ? 'text-emerald-400' : tunnel.status === 'degraded' ? 'text-amber-400' : 'text-red-400';

  // Betriebs-Metadaten
  const cost = server.monthly_cost != null ? `${server.monthly_cost}${server.currency === 'USD' ? ' $' : ' €'}/mtl.` : null;
  const expDays = daysUntil(server.expires_at);
  const lastContact = relativeTime(server.lastSeen);

  // Aktive Alerts aus den Live-Stats ableiten (gleiche Schwellen wie die Alert-Konfig)
  const diskAgg = (() => {
    const cap = disks.reduce((s, d) => s + (d.total || 0), 0);
    const used = disks.reduce((s, d) => s + (d.used || 0), 0);
    return cap ? (used / cap) * 100 : 0;
  })();
  const activeAlerts: string[] = [];
  if (hasData) {
    if (cpuPercent > TH.cpu) activeAlerts.push(`CPU > ${TH.cpu}%`);
    if (memPercent > TH.ram) activeAlerts.push(`RAM > ${TH.ram}%`);
    if (diskAgg > TH.disk) activeAlerts.push(`Speicher > ${TH.disk}%`);
    if (temp !== null && temp > TH.temp) activeAlerts.push(`Temperatur ${temp.toFixed(0)}°C`);
  }
  const hasAlert = activeAlerts.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => router.push(`/server/${server.id}`)}
      className="group cursor-pointer h-full"
    >
      <div className={clsx('relative rounded-2xl overflow-hidden transition-all duration-300 glass-card glass-card-hover h-full flex flex-col', !isOnline && 'opacity-70', hasAlert && 'ring-1 ring-red-500/40 shadow-[0_0_24px_-4px_rgba(239,68,68,0.35)]')}>
        {/* Statusstreifen oben */}
        <div className={clsx('absolute top-0 left-0 right-0 h-[2px]', hasAlert ? 'bg-gradient-to-r from-red-500/0 via-red-400 to-red-500/0' : isOnline ? 'bg-gradient-to-r from-emerald-500/0 via-emerald-400/70 to-emerald-500/0' : 'bg-gradient-to-r from-red-500/0 via-red-400/70 to-red-500/0')} />

        <div className="relative z-10 p-4 sm:p-5 flex-1">
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
              <p className="text-[11px] text-white/30 truncate font-mono">{server.host}</p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              {hasAlert && (
                <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-red-500/15 border border-red-500/30 text-red-400 animate-pulse" title={activeAlerts.join(' · ')}>
                  <AlertTriangle className="w-2.5 h-2.5" /> {activeAlerts.length} Alert{activeAlerts.length > 1 ? 's' : ''}
                </span>
              )}
              {tunnel && (
                <span className={clsx('flex items-center gap-1 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.06]', tunnelColor)} title={`Cloudflare-Tunnel: ${tunnel.status} (${tunnel.connections} Verbindungen)`}>
                  <Cloud className="w-2.5 h-2.5" /> {tunnel.status === 'healthy' ? 'Tunnel' : tunnel.status}
                </span>
              )}
              {!hasDocker && hasData && (
                <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-white/25 bg-white/[0.03] border border-white/[0.06] rounded-md px-1.5 py-0.5">
                  <Eye className="w-2.5 h-2.5" /> Monitor
                </span>
              )}
            </div>
          </div>

          {/* Betriebs-Metadaten-Chips (nur wenn gesetzt) */}
          {(server.provider || server.location || cost || expDays != null) && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {server.provider && <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-white/50"><Cloud className="w-2.5 h-2.5" />{server.provider}</span>}
              {server.location && <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-white/50"><MapPin className="w-2.5 h-2.5" />{server.location}</span>}
              {cost && <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-white/50"><Wallet className="w-2.5 h-2.5" />{cost}</span>}
              {expDays != null && (
                <span className={clsx('flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border', expDays <= 14 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-white/[0.03] border-white/[0.06] text-white/50')}>
                  <CalendarClock className="w-2.5 h-2.5" />{expDays <= 0 ? 'abgelaufen' : `${expDays} T`}
                </span>
              )}
            </div>
          )}

          {!hasData ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              {isOnline ? (
                <span className="text-white/20 text-xs">Verbinde...</span>
              ) : (
                <>
                  <WifiOff className="w-8 h-8 text-red-400/40" />
                  <span className="text-sm font-medium text-red-400/70">Offline</span>
                  {lastContact && <span className="text-[11px] text-white/30">Letzter Kontakt {lastContact}</span>}
                </>
              )}
            </div>
          ) : (
            <>
              {/* CPU Gauge + Stat-Spalte */}
              <div className="flex items-center gap-4 mb-4">
                <CpuRingGauge percent={cpuPercent} />
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Thermometer className={clsx('w-3.5 h-3.5', tempColor)} />
                    <span className={clsx('text-sm font-semibold tabular-nums', tempColor)}>
                      {temp !== null ? `${temp.toFixed(1)}°C` : 'n/a'}
                    </span>
                  </div>
                  {hasDocker && (
                    <div className="flex items-center gap-1.5">
                      <Box className="w-3.5 h-3.5 text-cyan-400/60" />
                      <span className="text-sm text-white/70 tabular-nums">
                        <span className="text-cyan-400 font-semibold">{running}</span>
                        <span className="text-white/30">/{totalCt}</span>
                        <span className="text-[10px] text-white/30 ml-1">Container</span>
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-[11px] tabular-nums">
                    <span className="flex items-center gap-1 text-emerald-400/70"><ArrowDown className="w-3 h-3" />{formatRate(rxRate)}</span>
                    <span className="flex items-center gap-1 text-blue-400/70"><ArrowUp className="w-3 h-3" />{formatRate(txRate)}</span>
                  </div>
                </div>
              </div>

              {/* Sparklines (Verlauf 60 Min) — mobil aus: die Werte stehen
                  schon oben, der Verlauf gehört auf die Detailseite */}
              {cpuSeries.length >= 2 && (
                <div className="hidden sm:grid grid-cols-3 gap-2 mb-4">
                  <MiniSpark label="CPU" value={`${Math.round(cpuPercent)}`} unit="%" series={cpuSeries} color="#10b981" min={0} max={100} />
                  <MiniSpark label="RAM" value={`${Math.round(memPercent)}`} unit="%" series={memSeries} color="#8b5cf6" min={0} max={100} />
                  <MiniSpark label="Netz" value={formatRate(rxRate + txRate).split(' ')[0]} unit={` ${formatRate(rxRate + txRate).split(' ')[1]}`} series={netSeries} color="#06b6d4" />
                </div>
              )}

              {/* RAM + Disk */}
              <div className="space-y-3">
                <StatBar label="RAM" percent={memPercent} right={`${formatBytes(memUsed)} / ${formatBytes(memTotal)}`} color={memColor} icon={<MemoryStick className="w-2.5 h-2.5 text-violet-400/60" />} />
                {disks.length > 0 && (() => {
                  const totalCap = disks.reduce((s, d) => s + (d.total || 0), 0);
                  const totalUsed = disks.reduce((s, d) => s + (d.used || 0), 0);
                  const aggPct = totalCap ? Math.round((totalUsed / totalCap) * 100) : 0;
                  const aggColor = aggPct > 90 ? '#ef4444' : aggPct > 75 ? '#f59e0b' : '#06b6d4';
                  const barColor = (p: number) => p > 90 ? '#ef4444' : p > 75 ? '#f59e0b' : '#06b6d4';
                  return (
                    <>
                      <StatBar label="Speicher" percent={aggPct} right={`${formatBytes(totalUsed)} / ${formatBytes(totalCap)}`} color={aggColor} icon={<HardDrive className="w-2.5 h-2.5 text-cyan-400/60" />} />
                      {/* Einzelne Laufwerke mobil aus — der Summenbalken genügt */}
                      {disks.length >= 1 && (
                        <div className="hidden sm:block space-y-1 pl-4">
                          {disks.map(d => (
                            <div key={d.device} className="flex items-center gap-2 text-[10px] text-white/35">
                              <span className="font-mono text-white/50 w-14 truncate" title={`${d.mountPoint} (${d.device})`}>{d.mountPoint}</span>
                              <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${Math.min(d.percent || 0, 100)}%`, background: barColor(d.percent || 0) }} />
                              </div>
                              <span className="tabular-nums text-right whitespace-nowrap">{formatBytes(d.used)} / {formatBytes(d.total)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Footer: Uptime + Cloudflare-Verbindungen */}
              {system?.uptime && (
                <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center justify-between">
                  <span className="text-[10px] text-white/25">Uptime</span>
                  <span className="text-[11px] text-white/40 font-mono">{system.uptime}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{ background: `radial-gradient(circle at 50% 0%, ${isOnline ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)'}, transparent 70%)` }} />
      </div>
    </motion.div>
  );
}
