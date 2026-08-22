/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { motion } from 'framer-motion';
import { Activity, Eye } from 'lucide-react';
import { useServerStore } from '@/stores/serverStore';
import { useFleetStore } from '@/stores/fleetStore';
import { GlassCard } from '@/components/ui/GlassCard';
import { UptimeWidget } from '@/components/dashboard/UptimeWidget';
import { FleetHealthWidget } from '@/components/dashboard/FleetHealthWidget';
import { CostWidget } from '@/components/dashboard/CostWidget';
import { StorageWidget } from '@/components/dashboard/StorageWidget';
import { EventsWidget } from '@/components/dashboard/EventsWidget';

function ContainerOverview() {
  const { servers } = useServerStore();
  const { serverData } = useFleetStore();

  return (
    <GlassCard delay={0.35}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
        </div>
        <span className="text-xs font-medium text-white/60">Container pro Server</span>
      </div>
      <div className="space-y-2.5">
        {servers.map(server => {
          const hasDocker = !!(server.is_local || server.docker_socket || server.docker_host || server.ssh_host);
          const data = serverData[server.id];
          const containers = data?.containers || [];
          const running = containers.filter(c => c.state === 'running').length;
          const total = containers.length;
          const percent = total > 0 ? (running / total) * 100 : 0;

          return (
            <div key={server.id} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white/40 truncate">{server.name}</span>
                {hasDocker ? (
                  <span className="text-[11px] text-white/50 tabular-nums">
                    <span className="text-cyan-400">{running}</span>/{total}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-white/25">
                    <Eye className="w-2.5 h-2.5" /> Nur Monitoring
                  </span>
                )}
              </div>
              {hasDocker && (
                <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500/60 to-cyan-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    style={{ boxShadow: '0 0 6px rgba(6,182,212,0.3)' }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

export function FleetBentoGrid() {
  // Anordnung: kurze Widgets in eine Reihe, hohe in die nächste, plus
  // [&>*]:h-full, damit alle Karten ihre Rasterzelle füllen (keine Lücken).
  return (
    <div className="bento-grid">
      {/* Reihe 1: Kennzahlen (4 Spalten, symmetrisch) */}
      <div className="bento-1x1 [&>*]:h-full">
        <FleetHealthWidget />
      </div>
      <div className="bento-1x1 [&>*]:h-full">
        <UptimeWidget />
      </div>
      <div className="bento-1x1 [&>*]:h-full">
        <CostWidget />
      </div>
      <div className="bento-1x1 [&>*]:h-full">
        <StorageWidget />
      </div>

      {/* Reihe 2: Listen */}
      <div className="bento-2x1 [&>*]:h-full">
        <ContainerOverview />
      </div>
      <div className="bento-2x1 [&>*]:h-full">
        <EventsWidget />
      </div>
    </div>
  );
}
