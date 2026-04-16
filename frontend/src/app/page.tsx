'use client';

import { motion } from 'framer-motion';
import { FleetTopology } from '@/components/fleet/FleetTopology';
import { FleetSummaryBar } from '@/components/fleet/FleetSummaryBar';
import { FleetBentoGrid } from '@/components/fleet/FleetBentoGrid';
import { useFleetWebSocket } from '@/hooks/useFleetWebSocket';
import { PageTransition } from '@/components/ui/PageTransition';

export default function FleetOverviewPage() {
  // Subscribe to all servers for real-time data
  useFleetWebSocket();

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
          <h2 className="text-xs uppercase tracking-widest text-white/25 font-medium mb-3">Server</h2>
          <FleetTopology />
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
