/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { motion } from 'framer-motion';
import { HardDrive } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useServerStore } from '@/stores/serverStore';
import { useFleetStore } from '@/stores/fleetStore';

function fmt(bytes: number): string {
  const tb = bytes / 1024 ** 4;
  if (tb >= 1) return `${tb.toFixed(1)} TB`;
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(0)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
}

export function StorageWidget() {
  const { servers } = useServerStore();
  const { serverData } = useFleetStore();

  let total = 0;
  let used = 0;
  for (const s of servers) {
    const disks = serverData[s.id]?.system?.disk ?? [];
    for (const d of disks) {
      total += d.total || 0;
      used += d.used || 0;
    }
  }

  const percent = total > 0 ? (used / total) * 100 : 0;
  const color = percent >= 90 ? '#ef4444' : percent >= 75 ? '#f59e0b' : '#06b6d4';

  return (
    <GlassCard delay={0.24} hover className="h-full">
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <HardDrive className="w-3.5 h-3.5 text-white/40" />
          <span className="stat-label">Speicher</span>
        </div>
        {total === 0 ? (
          <div>
            <p className="text-lg font-semibold text-white/40">–</p>
            <p className="text-[11px] text-white/30 mt-1">Keine Speicherdaten verfügbar</p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-1">
              <span className="stat-value" style={{ color }}>{percent.toFixed(0)}</span>
              <span className="text-white/40 text-sm">%</span>
            </div>
            <p className="text-[11px] text-white/30 mt-1">{fmt(used)} / {fmt(total)} belegt · fleetweit</p>
            <div className="mt-2 pt-2 border-t border-white/[0.06]">
              <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${color}99, ${color})`, boxShadow: `0 0 6px ${color}55` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, percent)}%` }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <p className="text-[10px] text-white/25 mt-1.5">{fmt(total - used)} frei</p>
            </div>
          </>
        )}
      </div>
    </GlassCard>
  );
}
