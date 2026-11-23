/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { SlidersHorizontal, BellOff, Check } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useServerStore } from '@/stores/serverStore';
import * as api from '@/lib/api';
import type { AlertOverrides } from '@/lib/types';

const METRIKEN = [
  { key: 'cpu', label: 'CPU', unit: '%' },
  { key: 'ram', label: 'RAM', unit: '%' },
  { key: 'disk', label: 'Platte', unit: '%' },
  { key: 'temp', label: 'Temp', unit: '°C' },
] as const;
type Key = typeof METRIKEN[number]['key'];

function Zelle({ wert, standard, unit, label, onChange }: {
  wert: number | null | undefined; standard: number; unit: string; label: string; onChange: (v: number | null | undefined) => void;
}) {
  const aus = wert === null;
  return (
    <div className="flex items-center gap-1">
      <input
        type="number" min={1} max={200}
        value={typeof wert === 'number' ? wert : ''}
        disabled={aus}
        placeholder={aus ? 'aus' : String(standard)}
        aria-label={label}
        onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        className={clsx('w-16 bg-white/[0.04] border rounded-lg px-1.5 py-1 text-[12px] tabular-nums text-right focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 placeholder:text-white/45',
          typeof wert === 'number' ? 'border-accent/40 text-accent-light' : 'border-white/[0.08] text-white/80', aus && 'opacity-50')}
      />
      <span className="text-[11px] text-white/45 w-4">{unit}</span>
      <button
        type="button" onClick={() => onChange(aus ? undefined : null)}
        aria-label={aus ? `${label}-Alarm wieder einschalten` : `${label}-Alarm ausschalten`} aria-pressed={aus}
        title={aus ? 'Alarm ist aus — klicken zum Einschalten' : 'Alarm ausschalten'}
        className={clsx('p-1 rounded-md transition-colors', aus ? 'text-amber-300 bg-amber-500/15' : 'text-white/40 hover:text-white/75 hover:bg-white/[0.06]')}
      ><BellOff className="w-3.5 h-3.5" /></button>
    </div>
  );
}

/**
 * Schwellen je Server. Leer = es gilt der globale Wert (Platzhalter),
 * eine Zahl ersetzt ihn, die Glocke schaltet die Metrik für diesen Server ab —
 * gedacht für Server, die dauerhaft nahe der Schwelle laufen (z. B. die NAS-VM).
 */
export function OverridesPanel() {
  const qc = useQueryClient();
  const { servers } = useServerStore();
  const { data: global } = useQuery({ queryKey: ['alertThresholds'], queryFn: api.getAlertThresholds, staleTime: 60000 });
  const { data: saved } = useQuery<AlertOverrides>({ queryKey: ['alert-overrides'], queryFn: api.getAlertOverrides });
  const [draft, setDraft] = useState<AlertOverrides>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => { if (saved && !dirty) setDraft(saved); }, [saved, dirty]);

  const save = useMutation({
    mutationFn: () => api.setAlertOverrides(draft),
    onSuccess: () => { setDirty(false); qc.invalidateQueries({ queryKey: ['alert-overrides'] }); qc.invalidateQueries({ queryKey: ['alert-overview'] }); qc.invalidateQueries({ queryKey: ['attention'] }); },
  });

  const set = (serverId: string, key: Key, v: number | null | undefined) => {
    setDirty(true);
    setDraft(d => {
      const zeile = { ...(d[serverId] ?? {}) };
      if (v === undefined) delete zeile[key]; else zeile[key] = v;
      const neu = { ...d, [serverId]: zeile };
      if (Object.keys(zeile).length === 0) delete neu[serverId];
      return neu;
    });
  };

  const std = global ?? { cpu: 90, ram: 90, disk: 90, temp: 75 };

  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-1">
        <SlidersHorizontal className="w-4 h-4 text-accent-light" />
        <h2 className="text-sm font-semibold">Schwellen je Server</h2>
        <button
          onClick={() => save.mutate()} disabled={!dirty || save.isPending}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/20 border border-accent/30 text-accent-light text-[12px] font-medium hover:bg-accent/30 transition-colors disabled:opacity-40"
        ><Check className="w-3.5 h-3.5" /> {save.isPending ? 'Speichert…' : dirty ? 'Speichern' : 'Gespeichert'}</button>
      </div>
      <p className="text-[12px] text-white/55 mb-4">Leer = globaler Wert (CPU {std.cpu} %, RAM {std.ram} %, Platte {std.disk} %, Temp {std.temp} °C — änderbar in den Einstellungen). Die Glocke schaltet den Alarm für diesen Server ab.</p>
      <div className="space-y-2">
        {servers.map(s => (
          <div key={s.id} className="rounded-xl bg-white/[0.02] border border-white/[0.05] px-3 py-2.5">
            <p className="text-[13px] font-medium mb-2 truncate">{s.name}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2">
              {METRIKEN.map(m => (
                <div key={m.key} className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wider text-white/50">{m.label}</span>
                  <Zelle wert={draft[s.id]?.[m.key]} standard={std[m.key]} unit={m.unit} label={`${s.name} ${m.label}`} onChange={v => set(s.id, m.key, v)} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
