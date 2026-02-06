'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useServerStore } from '@/stores/serverStore';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { Background } from '@/components/layout/Background';
import * as api from '@/lib/api';

function WebSocketManager({ children }: { children: React.ReactNode }) {
  const { connected } = useWebSocket();
  const { setServers } = useServerStore();

  // Fetch servers on mount
  useEffect(() => {
    api.getServers()
      .then((servers: any) => setServers(Array.isArray(servers) ? servers : []))
      .catch(() => setServers([{ id: 'local', name: 'Raspberry Pi 5', host: '192.168.2.103', is_local: 1, glances_url: null, docker_socket: null, docker_host: null, status: 'connected', lastSeen: null }]));
  }, [setServers]);

  return (
    <>
      <Background />
      <Header connected={connected} />
      <main className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6 pb-24 md:pb-6">
        {children}
      </main>
      <MobileNav />
    </>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 2000,
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketManager>{children}</WebSocketManager>
    </QueryClientProvider>
  );
}
