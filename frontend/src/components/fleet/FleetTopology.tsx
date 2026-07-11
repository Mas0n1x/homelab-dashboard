/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { clsx } from 'clsx';
import { useServerStore } from '@/stores/serverStore';
import { useFleetStore } from '@/stores/fleetStore';
import { ServerNodeCard } from './ServerNodeCard';

export function FleetTopology() {
  const { servers } = useServerStore();
  const { serverData } = useFleetStore();

  const count = servers.length;
  const cols =
    count <= 1 ? 'xl:grid-cols-1'
    : count === 2 ? 'xl:grid-cols-2'
    : count === 3 ? 'xl:grid-cols-3'
    : 'xl:grid-cols-4';

  return (
    <div className={clsx('grid grid-cols-1 sm:grid-cols-2 gap-4', cols)}>
      {servers.map((server, index) => (
        <ServerNodeCard
          key={server.id}
          server={server}
          data={serverData[server.id] || { system: null, containers: [], docker: null, lastUpdated: 0 }}
          index={index}
        />
      ))}
    </div>
  );
}
