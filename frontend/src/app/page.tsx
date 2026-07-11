/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { FleetTopology } from '@/components/fleet/FleetTopology';
import { FleetSummaryBar } from '@/components/fleet/FleetSummaryBar';
import { FleetBentoGrid } from '@/components/fleet/FleetBentoGrid';
import { RequestsWidget } from '@/components/dashboard/RequestsWidget';
import { useFleetWebSocket } from '@/hooks/useFleetWebSocket';
import { PageTransition } from '@/components/ui/PageTransition';

export default function FleetOverviewPage() {
  useFleetWebSocket();
  const router = useRouter();

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-2xl font-bold"
          >
            Fleet <span className="text-gradient">Overview</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-sm text-white/40 mt-1"
          >
            Alle Server auf einen Blick
          </motion.p>
        </div>

        {/* Summary Stats Bar */}
        <FleetSummaryBar />

        {/* Server Topology / Grid */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs uppercase tracking-widest text-white/25 font-medium">Server</h2>
            <button
              onClick={() => router.push('/settings')}
              className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/70 transition-colors"
            >
              <Plus className="w-3 h-3" /> Server hinzufügen
            </button>
          </div>
          <FleetTopology />
        </div>

        {/* Business — Neue Anfragen (SaleNet + Portfolio) */}
        <div>
          <h2 className="text-xs uppercase tracking-widest text-white/25 font-medium mb-3">Business</h2>
          <RequestsWidget />
        </div>

        {/* Bento Grid Widgets */}
        <div>
          <h2 className="text-xs uppercase tracking-widest text-white/25 font-medium mb-3">Dashboard</h2>
          <FleetBentoGrid />
        </div>
      </div>
    </PageTransition>
  );
}
