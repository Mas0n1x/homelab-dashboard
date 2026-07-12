/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Server, Thermometer, Box, HardDrive, ArrowDown, ArrowUp, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import type { ServerData } from '@/stores/fleetStore';
import type { Server as ServerType } from '@/lib/types';

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

function CpuRingGauge({ percent, size = 56 }: { percent: number; size?: number }) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const color = percent > 90 ? '#ef4444' : percent > 70 ? '#f59e0b' : '#10b981';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 4px ${color}40)` }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold tabular-nums" style={{ color }}>{Math.round(percent)}%</span>
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

export function ServerNodeCard({ server, data, index }: ServerNodeCardProps) {
  const router = useRouter();
  const { system, containers } = data;

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

  const isOnline = server.status === 'connected';
  const hasData = system !== null;
  const memColor = memPercent > 90 ? '#ef4444' : memPercent > 70 ? '#f59e0b' : '#8b5cf6';

  const tempColor = temp !== null
    ? temp >= 75 ? 'text-red-400' : temp >= 60 ? 'text-amber-400' : 'text-emerald-400'
    : 'text-white/30';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
      onClick={() => router.push(`/server/${server.id}`)}
      className="group cursor-pointer"
    >
      <div className={clsx('relative rounded-2xl overflow-hidden transition-all duration-300', 'glass-card glass-card-hover', !isOnline && 'opacity-50')}>
        <div className="relative z-10 p-5">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', isOnline ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20')}>
                <Server className={clsx('w-5 h-5', isOnline ? 'text-emerald-400' : 'text-red-400')} />
              </div>
              <span className={clsx('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0a0a1a]', isOnline ? 'bg-emerald-400 status-pulse-healthy' : 'bg-red-400')} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold truncate group-hover:text-white transition-colors">{server.name}</h3>
              <p className="text-[11px] text-white/30 truncate">{server.host}</p>
            </div>
            {!hasDocker && hasData && (
              <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-white/25 bg-white/[0.03] border border-white/[0.06] rounded-md px-1.5 py-0.5">
                <Eye className="w-2.5 h-2.5" /> Monitor
              </span>
            )}
          </div>

          {!hasData ? (
            <div className="flex items-center justify-center py-6 text-white/20 text-xs">
              {isOnline ? 'Verbinde...' : 'Offline'}
            </div>
          ) : (
            <>
              {/* CPU Gauge + rechte Stat-Spalte */}
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

              {/* RAM + Disk */}
              <div className="space-y-3">
                <StatBar label="RAM" percent={memPercent} right={`${formatBytes(memUsed)} / ${formatBytes(memTotal)}`} color={memColor} icon={<span className="w-2.5 h-2.5 rounded-sm bg-violet-400/60" />} />
                {disks.length > 0 && (() => {
                  const totalCap = disks.reduce((s, d) => s + (d.total || 0), 0);
                  const totalUsed = disks.reduce((s, d) => s + (d.used || 0), 0);
                  const aggPct = totalCap ? Math.round((totalUsed / totalCap) * 100) : 0;
                  const aggColor = aggPct > 90 ? '#ef4444' : aggPct > 75 ? '#f59e0b' : '#06b6d4';
                  const barColor = (p: number) => p > 90 ? '#ef4444' : p > 75 ? '#f59e0b' : '#06b6d4';
                  return (
                    <>
                      <StatBar label="Speicher" percent={aggPct} right={`${formatBytes(totalUsed)} / ${formatBytes(totalCap)}`} color={aggColor} icon={<HardDrive className="w-2.5 h-2.5 text-cyan-400/60" />} />
                      {disks.length >= 1 && (
                        <div className="space-y-1 pl-4">
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

              {/* Uptime */}
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
          style={{ background: `radial-gradient(circle at 50% 50%, ${isOnline ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)'}, transparent 70%)` }} />
      </div>
    </motion.div>
  );
}
