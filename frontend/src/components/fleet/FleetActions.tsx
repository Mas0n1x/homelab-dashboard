/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, Loader2, PackageCheck, Trash2, CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';
import { Modal } from '@/components/ui/Modal';
import { useServerStore } from '@/stores/serverStore';
import * as api from '@/lib/api';

function fmtMB(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

export function FleetActions() {
  const { servers } = useServerStore();
  const [confirmPrune, setConfirmPrune] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const pruneMutation = useMutation({
    mutationFn: async () => {
      return Promise.all(servers.map(async s => {
        try {
          const r: any = await api.systemPrune({ containers: true, images: true, networks: true, volumes: false }, s.id);
          const res = r?.results || {};
          const freed = (res.containers?.SpaceReclaimed || 0) + (res.images?.SpaceReclaimed || 0) + (res.networks?.SpaceReclaimed || 0);
          return { name: s.name, freed, ok: true };
        } catch { return { name: s.name, freed: 0, ok: false }; }
      }));
    },
    onSuccess: (results) => {
      const total = results.reduce((a, r) => a + r.freed, 0);
      const okCount = results.filter(r => r.ok).length;
      setResult({ ok: true, text: `${fmtMB(total)} freigegeben über ${okCount} Server` });
      setConfirmPrune(false);
    },
    onError: () => { setResult({ ok: false, text: 'Aufräumen fehlgeschlagen' }); setConfirmPrune(false); },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      return Promise.all(servers.map(async s => {
        try {
          const r: any = await api.getUpdateStatus(s.id);
          return { name: s.name, count: r?.count ?? r?.packages?.length ?? 0, ok: !r?.error };
        } catch { return { name: s.name, count: 0, ok: false }; }
      }));
    },
    onSuccess: (results) => {
      const total = results.reduce((a, r) => a + (r.count || 0), 0);
      const withUpd = results.filter(r => r.count > 0);
      setResult({
        ok: total === 0,
        text: total > 0
          ? `${total} Paket-Updates verfügbar (${withUpd.map(r => `${r.name}: ${r.count}`).join(', ')})`
          : 'Alle Server aktuell — keine Paket-Updates',
      });
    },
  });

  const busy = pruneMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {result && (
        <span className={clsx('flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border', result.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400')}>
          <CheckCircle2 className="w-3 h-3" /> {result.text}
        </span>
      )}
      <button
        onClick={() => updateMutation.mutate()}
        disabled={busy || servers.length === 0}
        className="flex items-center gap-1.5 text-[11px] text-white/50 hover:text-white/90 disabled:opacity-40 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/[0.04]"
      >
        {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PackageCheck className="w-3.5 h-3.5" />}
        Updates prüfen
      </button>
      <button
        onClick={() => setConfirmPrune(true)}
        disabled={busy || servers.length === 0}
        className="flex items-center gap-1.5 text-[11px] text-white/50 hover:text-white/90 disabled:opacity-40 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/[0.04]"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Docker aufräumen
      </button>

      <Modal isOpen={confirmPrune} onClose={() => setConfirmPrune(false)} title="Docker aufräumen?" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-white/60">
            Entfernt auf <span className="text-white/90 font-medium">allen {servers.length} Servern</span>: gestoppte Container, ungenutzte Images und ungenutzte Netzwerke.
          </p>
          <p className="text-xs text-emerald-400/80">Volumes (Daten) bleiben unberührt.</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmPrune(false)} className="btn-glass flex-1">Abbrechen</button>
            <button
              onClick={() => pruneMutation.mutate()}
              disabled={pruneMutation.isPending}
              className="flex-1 py-2 rounded-xl text-sm font-medium bg-accent/20 border border-accent/30 text-accent-light hover:bg-accent/30 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {pruneMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Aufräumen
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
