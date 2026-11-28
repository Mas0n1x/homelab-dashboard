/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Toggle } from '@/components/settings/ui';
import { zahl } from '@/lib/formatters';
import * as api from '@/lib/api';

const TAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

// Zeitplan für das wöchentliche Aufräumen auf allen Servern.
export function AutoCleanup() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['cleanup-schedule'], queryFn: api.getCleanupSchedule });
  const speichern = useMutation({
    mutationFn: (p: Partial<api.CleanupSchedule>) => api.setCleanupSchedule(p),
    onSuccess: (neu) => queryClient.setQueryData(['cleanup-schedule'], neu),
  });
  if (!data) return null;

  const letzter = data.letzter;
  const summe = letzter?.server.reduce((s, e) => s + e.freigegeben, 0) ?? 0;
  const fehler = letzter?.server.filter(s => !s.ok) ?? [];

  return (
    <div className="mt-4 pt-4 border-t border-white/[0.05]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Wöchentlich auf allen Servern</p>
          <p className="text-[12px] text-white/50">Nur Build-Cache und Images ohne Namen</p>
        </div>
        <div className="flex items-center gap-2">
          <select aria-label="Wochentag" className="glass-input text-xs py-1.5 w-32" value={data.weekday} disabled={!data.enabled} onChange={e => speichern.mutate({ weekday: Number(e.target.value) })}>
            {TAGE.map((t, i) => <option key={t} value={i}>{t}</option>)}
          </select>
          <input type="time" aria-label="Uhrzeit" className="glass-input text-xs py-1.5 w-28" value={data.time} disabled={!data.enabled} onChange={e => e.target.value && speichern.mutate({ time: e.target.value })} />
          <Toggle on={data.enabled} onClick={() => speichern.mutate({ enabled: !data.enabled })} />
        </div>
      </div>
      {speichern.isError && <p className="text-xs text-red-400 mt-2">Speichern fehlgeschlagen</p>}
      {letzter && (
        <p className="text-[12px] text-white/50 mt-2">
          Zuletzt {new Date(letzter.lauf).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}: {zahl(summe / 1024 ** 3, 2)} GB auf {letzter.server.length} Servern freigegeben
          {fehler.length > 0 && <span className="text-amber-400"> · Fehler bei {fehler.map(f => f.name).join(', ')}</span>}
        </p>
      )}
    </div>
  );
}
