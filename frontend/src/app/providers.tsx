'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useServerStore } from '@/stores/serverStore';
import { AppShell } from '@/components/layout/AppShell';
import { ThemeCustomizer } from '@/components/dashboard/ThemeCustomizer';
import { CommandPalette } from '@/components/dashboard/CommandPalette';
import { AuthGuard } from '@/components/auth/AuthGuard';
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
      <AppShell connected={connected}>
        {children}
      </AppShell>
      <ThemeCustomizer />
      <CommandPalette />
    </>
  );
}

function AppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return <WebSocketManager>{children}</WebSocketManager>;
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
      <AuthGuard>
        <AppContent>{children}</AppContent>
      </AuthGuard>
    </QueryClientProvider>
  );
}
