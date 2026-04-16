'use client';

import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { useServerStore } from '@/stores/serverStore';
import TerminalPage from '@/app/terminal/page';

export default function ServerTerminalPage() {
  const params = useParams();
  const serverId = params.id as string;
  const { setActiveServer } = useServerStore();

  useEffect(() => {
    setActiveServer(serverId);
  }, [serverId, setActiveServer]);

  return <TerminalPage />;
}
