'use client';

import { useEffect } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Cpu, Box, Terminal, FileText, Wrench } from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { useServerStore } from '@/stores/serverStore';
import { useFleetStore } from '@/stores/fleetStore';
import { useFleetWebSocket } from '@/hooks/useFleetWebSocket';
import { ServerHeader } from '@/components/server/ServerHeader';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Cpu, path: '' },
  { id: 'docker', label: 'Docker', icon: Box, path: '/docker' },
  { id: 'terminal', label: 'Terminal', icon: Terminal, path: '/terminal' },
  { id: 'logs', label: 'Logs', icon: FileText, path: '/logs' },
  { id: 'maintenance', label: 'Wartung', icon: Wrench, path: '/maintenance' },
];

export default function ServerLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const serverId = params.id as string;
  const { servers, setActiveServer } = useServerStore();
  const { serverData } = useFleetStore();

  // Subscribe to fleet WebSocket for real-time data
  useFleetWebSocket();

  // Set active server based on URL
  useEffect(() => {
    setActiveServer(serverId);
  }, [serverId, setActiveServer]);

  const server = servers.find(s => s.id === serverId);
  const data = serverData[serverId] || { system: null, containers: [], docker: null, lastUpdated: 0 };

  if (!server) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-white/40 text-sm">Server nicht gefunden</p>
          <Link href="/" className="text-accent-light text-sm mt-2 inline-block hover:underline">
            Zurueck zur Fleet-Uebersicht
          </Link>
        </div>
      </div>
    );
  }

  const basePath = `/server/${serverId}`;
  const getActiveTab = () => {
    const sub = pathname.replace(basePath, '');
    return TABS.find(t => t.path === sub)?.id || 'overview';
  };
  const activeTab = getActiveTab();

  return (
    <div className="space-y-5">
      {/* Server Header */}
      <ServerHeader server={server} data={data} />

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-white/[0.04] overflow-x-auto scrollbar-hide">
        {TABS.map(tab => {
          const isActive = tab.id === activeTab;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              href={`${basePath}${tab.path}`}
              className={clsx(
                'relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
                isActive ? 'text-white' : 'text-white/40 hover:text-white/70'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="server-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent-light rounded-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </div>

      {/* Page Content */}
      {children}
    </div>
  );
}
