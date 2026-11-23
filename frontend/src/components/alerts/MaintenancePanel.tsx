/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Wrench, X, Play } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useServerStore } from '@/stores/serverStore';
import * as api from '@/lib/api';
import type { MaintenanceWindow } from '@/lib/types';

const DAUER = [
  { min: 30, label: '30 Minuten' }, { min: 60, label: '1 Stunde' }, { min: 120, label: '2 Stunden' },
  { min: 240, label: '4 Stunden' }, { min: 480, label: '8 Stunden' }, { min: 1440, label: '24 Stunden' },
];

const FELD = 'bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[13px] text-white/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60';

function rest(until: string): string {
  const min = Math.max(0, Math.round((new Date(until).getTime() - Date.now()) / 60000));
  if (min < 60) return `noch ${min} Min`;
  const h = Math.floor(min / 60);
  return `noch ${h} Std ${min % 60} Min`;
}

/**
 * Wartungsfenster: für geplante Neustarts, Updates oder Umbauten.
 * Die Messung läuft weiter, es gehen aber keine Benachrichtigungen raus.
 */
export function MaintenancePanel() {
  const qc = useQueryClient();
  const { servers } = useServerStore();
  const [serverId, setServerId] = useState('*');
  const [minutes, setMinutes] = useState(60);
  const [reason, setReason] = useState('');

  const { data: windows = [] } = useQuery<MaintenanceWindow[]>({
    queryKey: ['maintenance'],
    queryFn: async () => (await api.getAlertOverview()).maintenance,
    refetchInterval: 30000,
  });
  const neu = () => { qc.invalidateQueries({ queryKey: ['maintenance'] }); qc.invalidateQueries({ queryKey: ['alert-overview'] }); qc.invalidateQueries({ queryKey: ['attention'] }); };
  const start = useMutation({ mutationFn: () => api.addMaintenanceWindow({ serverId, minutes, reason }), onSuccess: () => { setReason(''); neu(); } });
  const stop = useMutation({ mutationFn: (id: string) => api.removeMaintenanceWindow(id), onSuccess: neu });
  const nameOf = (id: string) => (id === '*' ? 'Alle Server' : servers.find(s => s.id === id)?.name ?? id);

  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-1">
        <Wrench className="w-4 h-4 text-sky-300" />
        <h2 className="text-sm font-semibold">Wartungsfenster</h2>
      </div>
      <p className="text-[12px] text-white/55 mb-4">Während eines Fensters laufen die Messungen weiter, es werden aber keine Alarme gesendet.</p>

      {windows.length > 0 && (
        <ul className="space-y-1.5 mb-4">
          {windows.map(w => (
            <li key={w.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-sky-500/[0.07] border border-sky-500/20">
              <Wrench className="w-3.5 h-3.5 text-sky-300 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium truncate">{nameOf(w.serverId)}</p>
                <p className="text-[12px] text-white/55 truncate">{w.reason || 'Ohne Grund'} · {rest(w.until)}</p>
              </div>
              <button onClick={() => stop.mutate(w.id)} aria-label={`Wartungsfenster für ${nameOf(w.serverId)} beenden`} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"><X className="w-4 h-4" /></button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-2 items-end">
        <label className="flex flex-col gap-1 text-[12px] text-white/55">Server
          <select className={FELD} value={serverId} onChange={e => setServerId(e.target.value)}>
            <option value="*" className="bg-[#0f0f23]">Alle Server</option>
            {servers.map(s => <option key={s.id} value={s.id} className="bg-[#0f0f23]">{s.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-white/55">Dauer
          <select className={FELD} value={minutes} onChange={e => setMinutes(Number(e.target.value))}>
            {DAUER.map(d => <option key={d.min} value={d.min} className="bg-[#0f0f23]">{d.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-white/55 col-span-2">Grund (optional)
          <input className={FELD} value={reason} maxLength={120} placeholder="z. B. Kernel-Update" onChange={e => setReason(e.target.value)} />
        </label>
        <button onClick={() => start.mutate()} disabled={start.isPending}
          className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent/20 border border-accent/30 text-accent-light text-[13px] font-medium hover:bg-accent/30 transition-colors disabled:opacity-50 col-span-2">
          <Play className="w-3.5 h-3.5" /> Starten
        </button>
      </div>
    </GlassCard>
  );
}
