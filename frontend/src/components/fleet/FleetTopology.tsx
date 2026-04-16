'use client';

import { useServerStore } from '@/stores/serverStore';
import { useFleetStore } from '@/stores/fleetStore';
import { ServerNodeCard } from './ServerNodeCard';

export function FleetTopology() {
  const { servers } = useServerStore();
  const { serverData } = useFleetStore();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {servers.map((server, index) => (
        <ServerNodeCard
          key={server.id}
          server={server}
          data={serverData[server.id] || { system: null, containers: [], docker: null, lastUpdated: 0 }}
          index={index}
        />
      ))}

      {/* Placeholder cards if less than 4 servers */}
      {servers.length < 4 && Array.from({ length: 4 - servers.length }).map((_, i) => (
        <PlaceholderNode key={`placeholder-${i}`} index={servers.length + i} />
      ))}
    </div>
  );
}

function PlaceholderNode({ index }: { index: number }) {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-dashed border-white/[0.06] bg-white/[0.01]">
      <div className="p-5 flex flex-col items-center justify-center min-h-[200px] text-center">
        <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-3">
          <span className="text-white/15 text-lg">+</span>
        </div>
        <p className="text-xs text-white/20">Server hinzufuegen</p>
        <p className="text-[10px] text-white/10 mt-1">Settings &rarr; Fleet</p>
      </div>
    </div>
  );
}
