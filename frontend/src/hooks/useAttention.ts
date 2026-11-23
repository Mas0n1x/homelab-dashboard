/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import * as api from '@/lib/api';
import type { AttentionBoard, AlertOverview } from '@/lib/types';

/** Gesamtliste „was braucht Aufmerksamkeit" — ein geteilter Abruf für Startseite und Sidebar. */
export function useAttention() {
  return useQuery<AttentionBoard>({
    queryKey: ['attention'],
    queryFn: api.getAttention,
    refetchInterval: 20000,
    staleTime: 10000,
  });
}

/** Aktive Alarme + wirksame Schwellen je Server (Quelle der Wahrheit ist das Backend). */
export function useAlertOverview() {
  return useQuery<AlertOverview>({
    queryKey: ['alert-overview'],
    queryFn: api.getAlertOverview,
    refetchInterval: 15000,
    staleTime: 8000,
  });
}
