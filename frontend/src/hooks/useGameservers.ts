/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import * as api from '@/lib/api';

/** Alle Pelican-Spielserver samt Zustand; Sidebar, Übersicht und Server-Seiten teilen sich diese Abfrage. */
export function useGameservers() {
  return useQuery({
    queryKey: ['gameservers'],
    queryFn: () => api.getGameservers(),
    refetchInterval: 10000,
    staleTime: 5000,
  });
}
