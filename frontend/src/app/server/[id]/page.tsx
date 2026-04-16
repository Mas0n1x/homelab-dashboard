'use client';

import { useParams } from 'next/navigation';
import { useFleetStore } from '@/stores/fleetStore';
import { SystemGauges } from '@/components/server/SystemGauges';
import { ContainerQuickList } from '@/components/server/ContainerQuickList';
import { CpuChart } from '@/components/monitoring/CpuChart';
import { MemoryChart } from '@/components/monitoring/MemoryChart';
import { NetworkChart } from '@/components/monitoring/NetworkChart';
import { DiskWidget } from '@/components/dashboard/DiskWidget';
import { motion } from 'framer-motion';

export default function ServerOverviewPage() {
  const params = useParams();
  const serverId = params.id as string;
  const { serverData } = useFleetStore();
  const data = serverData[serverId] || { system: null, containers: [], docker: null, lastUpdated: 0 };
  const { system, containers } = data;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* System Gauges */}
      <SystemGauges stats={system} />

      {/* Container List + Disk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ContainerQuickList containers={containers} serverId={serverId} />
        {system?.disk && system.disk.length > 0 && (
          <DiskWidget disks={system.disk} />
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CpuChart cpuTotal={system?.cpu.total || 0} />
        <MemoryChart memPercent={system?.memory.percent || 0} />
      </div>

      <NetworkChart network={system?.network || null} />
    </motion.div>
  );
}
