/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ProcessManager } from '@/components/maintenance/ProcessManager';
import { NetworkInfo } from '@/components/maintenance/NetworkInfo';
import { DiskHealth } from '@/components/maintenance/DiskHealth';
import { UpdateStatus } from '@/components/maintenance/UpdateStatus';
import { SystemdServices } from '@/components/maintenance/SystemdServices';

export default function ServerMaintenancePage() {
  const params = useParams();
  const serverId = params.id as string;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* Process Manager - Full Width */}
      <ProcessManager serverId={serverId} />

      {/* Updates + Services + Network + Disk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <UpdateStatus serverId={serverId} />
        <SystemdServices serverId={serverId} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <NetworkInfo serverId={serverId} />
        <DiskHealth serverId={serverId} />
      </div>
    </motion.div>
  );
}
