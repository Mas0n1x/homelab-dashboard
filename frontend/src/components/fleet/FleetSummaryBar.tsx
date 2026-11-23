/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import type React from 'react';
import { Cpu, MemoryStick, Box, Wifi } from 'lucide-react';
import { motion } from 'framer-motion';
import { useFleetStore } from '@/stores/fleetStore';
import { useServerStore } from '@/stores/serverStore';

import { istErreichbar, zahl } from '@/lib/formatters';
import { DEFAULT_LIMITS, LEVEL_TEXT, level } from '@/lib/health';
function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${zahl(gb, 1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${zahl(mb, 0)} MB`;
}

export function FleetSummaryBar() {
  const { servers } = useServerStore();
  const { serverData } = useFleetStore();

  let totalContainers = 0;
  let runningContainers = 0;
  let avgCpu = 0;
  let totalMem = 0;
  let usedMem = 0;
  let onlineCount = 0;
  let cpuCount = 0;

  servers.forEach(server => {
    const data = serverData[server.id];
    if (!data) return;

    const { system, containers } = data;
    if (containers) {
      totalContainers += containers.length;
      runningContainers += containers.filter(c => c.state === 'running').length;
    }
    if (system) {
      avgCpu += system.cpu.total;
      cpuCount++;
      totalMem += system.memory.total;
      usedMem += system.memory.used;
    }
    if (istErreichbar(server.status)) onlineCount++;
  });

  if (cpuCount > 0) avgCpu = avgCpu / cpuCount;

  const stats = [
    {
      icon: <Wifi className="w-4 h-4" />,
      label: 'Server online',
      value: `${onlineCount}/${servers.length}`,
      color: onlineCount === servers.length ? 'text-emerald-400' : 'text-amber-400',
      bg: onlineCount === servers.length ? 'bg-emerald-500/15' : 'bg-amber-500/15',
      tone: onlineCount === servers.length ? '16,185,129' : '245,158,11',
      pct: servers.length ? (onlineCount / servers.length) * 100 : 0,
    },
    {
      icon: <Cpu className="w-4 h-4" />,
      label: 'Ø CPU',
      value: `${zahl(avgCpu, 1)} %`,
      // gleiche Stufen wie Karten und Alarme (Schwelle − 15 Punkte = Warnung)
      color: LEVEL_TEXT[level(avgCpu, DEFAULT_LIMITS.cpu)],
      bg: { ok: 'bg-emerald-500/15', warn: 'bg-amber-500/15', crit: 'bg-red-500/15' }[level(avgCpu, DEFAULT_LIMITS.cpu)],
      tone: { ok: '16,185,129', warn: '245,158,11', crit: '239,68,68' }[level(avgCpu, DEFAULT_LIMITS.cpu)],
      pct: avgCpu,
    },
    {
      icon: <MemoryStick className="w-4 h-4" />,
      label: 'RAM gesamt',
      // Einheit nur einmal — „9.4 GB / 19.8 GB" wurde in der Mobil-Kachel abgeschnitten.
      value: totalMem > 0
        ? `${zahl(usedMem / 1024 ** 3, 1)} / ${zahl(totalMem / 1024 ** 3, 1)} GB`
        : 'n. v.',
      color: 'text-purple-400',
      bg: 'bg-purple-500/15',
      tone: '139,92,246',
      pct: totalMem > 0 ? (usedMem / totalMem) * 100 : 0,
    },
    {
      icon: <Box className="w-4 h-4" />,
      label: 'Container',
      value: `${runningContainers}/${totalContainers}`,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/15',
      tone: '6,182,212',
      pct: totalContainers > 0 ? (runningContainers / totalContainers) * 100 : 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
          style={{ '--tone': stat.tone } as React.CSSProperties}
          className="glass-card-elevated stat-tile p-4 min-w-0"
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`} style={{ boxShadow: `0 0 18px -4px rgba(${stat.tone},0.6)` }}>
              <span className={stat.color}>{stat.icon}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-white/55 truncate">{stat.label}</p>
              <p className={`text-lg leading-tight font-semibold tabular-nums truncate ${stat.color}`}>{stat.value}</p>
            </div>
          </div>
          <div className="mt-3 h-1 rounded-full bg-white/[0.07] overflow-hidden">
            <motion.div
              className={`h-full rounded-full bar-glow ${stat.color}`}
              style={{ background: `linear-gradient(90deg, rgba(${stat.tone},0.55), rgb(${stat.tone}))` }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(Math.max(stat.pct, 0), 100)}%` }}
              transition={{ duration: 0.9, delay: 0.2 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
