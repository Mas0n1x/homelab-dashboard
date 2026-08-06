/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { Cpu, MemoryStick, Box, Wifi } from 'lucide-react';
import { motion } from 'framer-motion';
import { useFleetStore } from '@/stores/fleetStore';
import { useServerStore } from '@/stores/serverStore';

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
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
    if (server.status === 'connected') onlineCount++;
  });

  if (cpuCount > 0) avgCpu = avgCpu / cpuCount;

  const stats = [
    {
      icon: <Wifi className="w-4 h-4" />,
      label: 'Server Online',
      value: `${onlineCount}/${servers.length}`,
      color: onlineCount === servers.length ? 'text-emerald-400' : 'text-amber-400',
      bg: onlineCount === servers.length ? 'bg-emerald-500/10' : 'bg-amber-500/10',
    },
    {
      icon: <Cpu className="w-4 h-4" />,
      label: 'Avg CPU',
      value: `${avgCpu.toFixed(1)}%`,
      color: avgCpu > 80 ? 'text-red-400' : avgCpu > 50 ? 'text-amber-400' : 'text-emerald-400',
      bg: avgCpu > 80 ? 'bg-red-500/10' : avgCpu > 50 ? 'bg-amber-500/10' : 'bg-emerald-500/10',
    },
    {
      icon: <MemoryStick className="w-4 h-4" />,
      label: 'Gesamt RAM',
      // Einheit nur einmal — „9.4 GB / 19.8 GB" wurde in der Mobil-Kachel abgeschnitten.
      value: totalMem > 0
        ? `${(usedMem / 1024 ** 3).toFixed(1)} / ${(totalMem / 1024 ** 3).toFixed(1)} GB`
        : 'N/A',
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
    },
    {
      icon: <Box className="w-4 h-4" />,
      label: 'Container',
      value: `${runningContainers}/${totalContainers}`,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
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
          className="glass-card-elevated p-3.5 flex items-center gap-3 min-w-0"
        >
          <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
            <span className={stat.color}>{stat.icon}</span>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-white/30 truncate">{stat.label}</p>
            <p className={`text-sm font-semibold tabular-nums truncate ${stat.color}`}>{stat.value}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
