/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { useServerStore } from '@/stores/serverStore';
import DockerPage from '@/app/docker/page';

export default function ServerDockerPage() {
  const params = useParams();
  const serverId = params.id as string;
  const { setActiveServer } = useServerStore();

  useEffect(() => {
    setActiveServer(serverId);
  }, [serverId, setActiveServer]);

  // Reuse the existing Docker page - it reads from activeServerId
  return <DockerPage />;
}
