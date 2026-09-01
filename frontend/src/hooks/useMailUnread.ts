/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import * as api from '@/lib/api';

/**
 * Ungelesene Mails über ALLE Postfächer — für die Zeichen an Navigation und
 * Bottom-Bar. Der Endpunkt ist server-seitig 20 Sekunden zwischengespeichert,
 * die Abfrage kostet also auch bei mehreren Konten kaum etwas.
 */
export function useMailUnread() {
  const { data } = useQuery({
    queryKey: ['mail-unread'],
    queryFn: api.getMailUnread,
    refetchInterval: 60000,
    staleTime: 30000,
    // Ein Mailserver-Ausfall darf keine Fehlermeldung durchs ganze Layout
    // schieben — dann steht eben kein Zähler da.
    retry: false,
  });

  return {
    total: data?.total ?? 0,
    perAccount: data?.accounts ?? [],
  };
}
