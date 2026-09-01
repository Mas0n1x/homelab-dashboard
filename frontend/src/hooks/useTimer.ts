/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import type { TimeEntry } from '@/lib/types';

/**
 * Die laufende Uhr, sekundengenau.
 *
 * Wichtig: gezählt wird aus dem Startzeitpunkt vom Server, nicht durch
 * Hochzählen im Browser. Ein zwischendurch gesperrtes Handy drosselt die Timer
 * des Tabs — mitgezählte Sekunden wären danach zu wenig. So stimmt die Zeit
 * auch nach Stunden im Hintergrund, und sie stimmt auf allen Geräten überein.
 */
export function useTimer() {
  const queryClient = useQueryClient();
  const [jetzt, setJetzt] = useState(() => Date.now());

  const { data: running } = useQuery<TimeEntry | null>({
    queryKey: ['time-running'],
    queryFn: api.getRunningTimer,
    // Regelmäßig gegenprüfen: gestoppt wird die Uhr eventuell auf einem
    // anderen Gerät.
    refetchInterval: 30000,
    staleTime: 10000,
  });

  // Der Sekundentakt läuft nur, solange wirklich eine Uhr läuft.
  useEffect(() => {
    if (!running) return;
    setJetzt(Date.now());
    const id = setInterval(() => setJetzt(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running?.id]);

  // Nach der Rückkehr aus dem Hintergrund sofort neu rechnen statt bis zum
  // nächsten Tick eine veraltete Zahl zu zeigen.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setJetzt(Date.now());
        queryClient.invalidateQueries({ queryKey: ['time-running'] });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [queryClient]);

  const elapsed = running
    ? Math.max(0, Math.round((jetzt - Date.parse(running.startedAt)) / 1000))
    : 0;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['time-running'] });
    queryClient.invalidateQueries({ queryKey: ['time-entries'] });
    queryClient.invalidateQueries({ queryKey: ['time-summary'] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  const start = useMutation({
    mutationFn: (data: { taskId?: string; project?: string; description?: string }) => api.startTimer(data),
    onSuccess: invalidate,
  });

  const stop = useMutation({
    mutationFn: () => api.stopTimer(),
    onSuccess: invalidate,
  });

  return {
    running: running ?? null,
    elapsed,
    start: start.mutate,
    stop: stop.mutate,
    isBusy: start.isPending || stop.isPending,
  };
}

/** 4275 -> „1:11:15", 315 -> „5:15". */
export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
}

/** Kompakt für Karten und Auswertungen: „2,5 h" bzw. „35 Min.". */
export function formatHours(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)} Sek.`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} Min.`;
  return `${(seconds / 3600).toFixed(seconds % 3600 === 0 ? 0 : 1).replace('.', ',')} h`;
}

export function formatMoney(amount: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amount);
}
