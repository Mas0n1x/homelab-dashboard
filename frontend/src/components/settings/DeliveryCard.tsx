/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Moon } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import * as api from '@/lib/api';
import { SectionHeader, SettingRow, Toggle } from './ui';
import { EVENT_OPTIONS } from './events';

const ARTEN: { id: api.DeliveryMode; label: string }[] = [
  { id: 'dringend', label: 'Sofort, auch nachts' },
  { id: 'sofort', label: 'Sofort' },
  { id: 'gesammelt', label: 'Tagesübersicht' },
];

export function DeliveryCard() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['alertDelivery'], queryFn: api.getAlertDelivery });
  const [entwurf, setEntwurf] = useState<api.AlertDelivery | null>(null);
  const cfg = entwurf ?? data;

  const speichern = useMutation({
    mutationFn: () => api.setAlertDelivery(cfg!),
    onSuccess: (neu) => { queryClient.setQueryData(['alertDelivery'], neu); setEntwurf(null); },
  });

  if (!cfg) return null;
  const aendere = (teil: Partial<api.AlertDelivery>) => setEntwurf({ ...cfg, ...teil });

  return (
    <GlassCard>
      <div className="relative z-10">
        <SectionHeader
          icon={Moon}
          tint="bg-amber-500/10 border-amber-500/20 text-amber-400"
          title="Zustellung"
          desc="Was dich sofort erreicht und was bis zur Tagesübersicht wartet"
          action={
            <button onClick={() => speichern.mutate()} disabled={!entwurf || speichern.isPending} className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-40">
              {speichern.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Speichern
            </button>
          }
        />
        {speichern.isError && <p className="text-xs text-red-400 mb-2">Speichern fehlgeschlagen</p>}

        <SettingRow title="Ruhezeit" desc="„Sofort“-Meldungen warten bis zum Ende">
          <div className="flex items-center gap-2">
            <input type="time" aria-label="Ruhezeit von" className="glass-input w-28" value={cfg.quiet.from} disabled={!cfg.quiet.enabled} onChange={e => aendere({ quiet: { ...cfg.quiet, from: e.target.value } })} />
            <span className="text-white/50 text-xs">bis</span>
            <input type="time" aria-label="Ruhezeit bis" className="glass-input w-28" value={cfg.quiet.to} disabled={!cfg.quiet.enabled} onChange={e => aendere({ quiet: { ...cfg.quiet, to: e.target.value } })} />
            <Toggle on={cfg.quiet.enabled} onClick={() => aendere({ quiet: { ...cfg.quiet, enabled: !cfg.quiet.enabled } })} />
          </div>
        </SettingRow>
        <SettingRow title="Tagesübersicht" desc="Gesammelte Meldungen kommen als eine Nachricht">
          <input type="time" aria-label="Uhrzeit der Tagesübersicht" className="glass-input w-28" value={cfg.digestAt} onChange={e => aendere({ digestAt: e.target.value })} />
        </SettingRow>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 mt-4 xl:[&>*:last-child:nth-child(odd)]:col-span-2">
          {EVENT_OPTIONS.filter(o => o.id in cfg.modes).map(o => (
            <label key={o.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.015] px-3 py-2">
              <span className="text-xs text-white/70 min-w-0">{o.icon} {o.label}</span>
              <select className="glass-input text-xs py-1.5 w-40 flex-shrink-0" value={cfg.modes[o.id]} onChange={e => aendere({ modes: { ...cfg.modes, [o.id]: e.target.value as api.DeliveryMode } })}>
                {ARTEN.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </label>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
