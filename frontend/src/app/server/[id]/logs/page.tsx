/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { useServerStore } from '@/stores/serverStore';
import LogsPage from '@/app/logs/page';

export default function ServerLogsPage() {
  const params = useParams();
  const serverId = params.id as string;
  const { setActiveServer } = useServerStore();

  useEffect(() => {
    setActiveServer(serverId);
  }, [serverId, setActiveServer]);

  return <LogsPage />;
}
