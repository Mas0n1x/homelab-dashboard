/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useParams } from 'next/navigation';
import { GameServerView } from '@/components/gameserver/GameServerView';

export default function GameServerPage() {
  const params = useParams();
  return <GameServerView id={params.id as string} />;
}
