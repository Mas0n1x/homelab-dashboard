/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { motion } from 'framer-motion';
import { HeartPulse } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useServerStore } from '@/stores/serverStore';
import { useFleetStore } from '@/stores/fleetStore';

export function FleetHealthWidget() {
  const { servers } = useServerStore();
  const { serverData } = useFleetStore();

  let score = 100;
  let onlineCount = 0;
  for (const s of servers) {
    if (s.status !== 'connected') { score -= 25; continue; }
    onlineCount++;
    const sys = serverData[s.id]?.system;
    if (!sys) continue;
    const cpu = sys.cpu?.total ?? 0;
    const mem = sys.memory?.percent ?? 0;
    const disks = sys.disk ?? [];
    const cap = disks.reduce((a, d) => a + (d.total || 0), 0);
    const used = disks.reduce((a, d) => a + (d.used || 0), 0);
    const disk = cap ? (used / cap) * 100 : 0;
    const temp = sys.temperature?.[0]?.value ?? 0;
    if (cpu > 90) score -= 8; else if (cpu > 75) score -= 3;
    if (mem > 90) score -= 8; else if (mem > 75) score -= 3;
    if (disk > 90) score -= 10; else if (disk > 80) score -= 4;
    if (temp > 75) score -= 6;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  const meta = score >= 90 ? { label: 'Ausgezeichnet', color: '#10b981' }
    : score >= 75 ? { label: 'Gut', color: '#10b981' }
    : score >= 50 ? { label: 'Achtung', color: '#f59e0b' }
    : { label: 'Kritisch', color: '#ef4444' };

  const size = 92, sw = 7, r = (size - sw) / 2, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <GlassCard delay={0.2} hover className="h-full">
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="flex items-center gap-2 self-start mb-1">
          <HeartPulse className="w-3.5 h-3.5 text-white/40" />
          <span className="stat-label">Fleet Health</span>
        </div>
        <div className="relative my-1" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
            <motion.circle
              cx={size / 2} cy={size / 2} r={r} fill="none" stroke={meta.color} strokeWidth={sw} strokeLinecap="round"
              strokeDasharray={circ} initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} style={{ filter: `drop-shadow(0 0 6px ${meta.color}66)` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold tabular-nums" style={{ color: meta.color }}>{score}</span>
          </div>
        </div>
        <span className="text-xs font-medium" style={{ color: meta.color }}>{meta.label}</span>
        <span className="text-[11px] text-white/30 mt-0.5">{onlineCount}/{servers.length} Server online</span>
      </div>
    </GlassCard>
  );
}
