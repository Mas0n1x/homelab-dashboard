/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, LogOut, Monitor, Smartphone, MonitorSmartphone } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import * as api from '@/lib/api';
import { SectionHeader } from './ui';

// Grobe Einordnung reicht, um ein fremdes Gerät zu erkennen.
function geraeteName(ua: string | null) {
  if (!ua) return { name: 'Unbekanntes Gerät', mobil: false };
  const browser = /OPR\//.test(ua) ? 'Opera' : /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : ua.split('/')[0].slice(0, 30);
  const system = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '';
  return { name: system ? `${browser} · ${system}` : browser, mobil: /iPhone|Android|iPad/.test(ua) };
}

const zeit = (iso: string | null) => {
  if (!iso) return 'unbekannt';
  const d = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export function SessionsCard() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['sessions'], queryFn: api.getSessions });
  const neu = () => queryClient.invalidateQueries({ queryKey: ['sessions'] });
  const eine = useMutation({ mutationFn: (id: string) => api.endSession(id), onSuccess: neu });
  const andere = useMutation({ mutationFn: () => api.endOtherSessions(), onSuccess: neu });

  const liste = data ?? [];
  const fremde = liste.filter(s => !s.aktuell).length;

  return (
    <GlassCard>
      <div className="relative z-10">
        <SectionHeader
          icon={MonitorSmartphone}
          tint="bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
          title="Angemeldete Geräte"
          desc={isLoading ? 'Lade …' : `${liste.length} aktive ${liste.length === 1 ? 'Anmeldung' : 'Anmeldungen'}`}
          action={fremde > 0 ? (
            <button onClick={() => andere.mutate()} disabled={andere.isPending} className="btn-glass text-xs flex items-center gap-1.5 disabled:opacity-40">
              {andere.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
              Alle anderen abmelden
            </button>
          ) : undefined}
        />
        {(error || eine.isError || andere.isError) && <p className="text-xs text-red-400 mb-2">Das hat nicht geklappt. Lade die Seite neu und versuche es noch einmal.</p>}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {liste.map(s => {
            const g = geraeteName(s.geraet);
            const Icon = g.mobil ? Smartphone : Monitor;
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.015] px-3 py-2.5">
                <Icon className="w-4 h-4 text-white/55 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{g.name}</p>
                  <p className="text-[12px] text-white/50 truncate">Zuletzt {zeit(s.zuletzt)}{s.ip ? ` · ${s.ip}` : ''}</p>
                </div>
                {s.aktuell ? (
                  <span className="text-[11px] text-emerald-400 flex-shrink-0">dieses Gerät</span>
                ) : (
                  <button onClick={() => eine.mutate(s.id)} disabled={eine.isPending} className="p-1.5 rounded-lg text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0 disabled:opacity-40" title="Abmelden" aria-label={`${g.name} abmelden`}>
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}
