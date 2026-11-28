/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Brush, ChevronDown, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { GlassCard } from '@/components/ui/GlassCard';
import { Modal } from '@/components/ui/Modal';
import { useServerStore } from '@/stores/serverStore';
import { zahl } from '@/lib/formatters';
import * as api from '@/lib/api';
import { AutoCleanup } from './AutoCleanup';

const GRUPPEN: { key: api.CleanupKey; label: string; desc: string }[] = [
  { key: 'buildCache', label: 'Build-Cache', desc: 'Wird beim nächsten Build neu aufgebaut' },
  { key: 'danglingImages', label: 'Verwaiste Images', desc: 'Ohne Namen, Reste alter Builds' },
  { key: 'unusedImages', label: 'Unbenutzte Images', desc: 'Mit Namen, aber ohne Container — auch Stände zum Zurückrollen' },
  { key: 'containers', label: 'Gestoppte Container', desc: 'Samt ihren Logs und Änderungen im Container' },
];
const STANDARD = { buildCache: true, danglingImages: true, unusedImages: false, containers: false };

const groesse = (b: number) => (b >= 1024 ** 3 ? `${zahl(b / 1024 ** 3, 2)} GB` : `${zahl(b / 1024 ** 2, 1)} MB`);

export function CleanupCard() {
  const queryClient = useQueryClient();
  const { activeServerId, servers } = useServerStore();
  const serverName = servers.find(s => s.id === activeServerId)?.name || activeServerId;
  const [auswahl, setAuswahl] = useState<Record<api.CleanupKey, boolean>>(STANDARD);
  const [offen, setOffen] = useState<api.CleanupKey | null>(null);
  const [bestaetigen, setBestaetigen] = useState(false);

  // Erst auf Klick: die Abfrage geht auf vollen Platten über viele Sekunden.
  const vorschau = useQuery({
    queryKey: ['cleanup-preview', activeServerId],
    queryFn: () => api.getCleanupPreview(activeServerId),
    enabled: false,
    retry: false,
  });
  const lauf = useMutation({
    mutationFn: () => api.runCleanup(auswahl, activeServerId),
    onSettled: () => {
      setBestaetigen(false);
      queryClient.invalidateQueries({ queryKey: ['disk-usage', activeServerId] });
      vorschau.refetch();
    },
  });
  useEffect(() => { setAuswahl(STANDARD); setOffen(null); lauf.reset(); }, [activeServerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const daten = vorschau.data;
  const gewaehlt = daten ? GRUPPEN.filter(g => auswahl[g.key] && daten[g.key].count > 0) : [];
  const summe = gewaehlt.reduce((s, g) => s + daten![g.key].size, 0);
  const fehler = Object.values(lauf.data?.ergebnis || {}).filter(e => !e.ok);

  return (
    <>
    <GlassCard delay={0.1}>
      <div className="relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Brush className="w-4 h-4 text-white/55" />
            <span className="text-sm font-medium">Aufräumen — {serverName}</span>
          </div>
          <button onClick={() => vorschau.refetch()} disabled={vorschau.isFetching} className="btn-glass text-xs flex items-center justify-center gap-1.5">
            {vorschau.isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {daten ? 'Neu prüfen' : 'Vorschau laden'}
          </button>
        </div>

        {vorschau.error && <p className="text-xs text-red-400 mb-2">Vorschau fehlgeschlagen — ist Docker auf diesem Server erreichbar?</p>}
        {lauf.data && <p className="text-xs text-emerald-400 mb-2">Freigegeben: {groesse(lauf.data.freigegeben)}</p>}
        {fehler.map((e, i) => <p key={i} className="text-xs text-red-400 mb-2">{e.error}</p>)}
        {lauf.error && <p className="text-xs text-red-400 mb-2">Aufräumen fehlgeschlagen</p>}

        {!daten ? (
          <p className="text-xs text-white/50">Zeigt erst, was gelöscht würde. Volumes werden hier nie angefasst.</p>
        ) : (
          <>
            <div className="space-y-2">
              {GRUPPEN.map(g => {
                const d = daten[g.key];
                const auf = offen === g.key;
                return (
                  <div key={g.key} className="rounded-xl border border-white/[0.05] bg-white/[0.015] px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" className="accent-indigo-500 w-4 h-4" checked={auswahl[g.key]} disabled={d.count === 0}
                        onChange={e => setAuswahl(a => ({ ...a, [g.key]: e.target.checked }))} />
                      <button onClick={() => setOffen(auf ? null : g.key)} disabled={d.count === 0} className="flex-1 min-w-0 flex items-center gap-2 text-left disabled:opacity-50">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">{g.label} <span className="text-white/50">({d.count})</span></p>
                          <p className="text-[12px] text-white/50">{g.desc}</p>
                        </div>
                        <span className="text-xs font-mono text-white/65">{groesse(d.size)}</span>
                        {auf ? <ChevronDown className="w-3.5 h-3.5 text-white/50" /> : <ChevronRight className="w-3.5 h-3.5 text-white/50" />}
                      </button>
                    </div>
                    {auf && (
                      <div className="mt-2 pl-7 space-y-1 max-h-48 overflow-y-auto">
                        {d.items.map((it, i) => (
                          <div key={i} className="flex justify-between gap-3 text-[12px] text-white/60">
                            <span className="truncate">{it.name}</span>
                            <span className="font-mono flex-shrink-0">{groesse(it.size)}</span>
                          </div>
                        ))}
                        {d.count > d.items.length && <p className="text-[12px] text-white/50">… und {d.count - d.items.length} weitere</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setBestaetigen(true)} disabled={gewaehlt.length === 0 || lauf.isPending || vorschau.isFetching} className={clsx('btn-primary text-xs mt-3 w-full flex items-center justify-center gap-2 disabled:opacity-40')}>
              <Brush className="w-3.5 h-3.5" /> Gewähltes löschen (bis zu {groesse(summe)})
            </button>
          </>
        )}
        <AutoCleanup />
      </div>
    </GlassCard>

      <Modal isOpen={bestaetigen} onClose={() => setBestaetigen(false)} title="Wirklich aufräumen?" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-white/70">Auf <span className="text-white/90">{serverName}</span> wird endgültig gelöscht: {gewaehlt.map(g => g.label).join(', ')}.</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setBestaetigen(false)} className="btn-glass">Abbrechen</button>
            <button onClick={() => lauf.mutate()} disabled={lauf.isPending} className="py-2 rounded-xl text-sm font-medium bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
              {lauf.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Löschen
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
