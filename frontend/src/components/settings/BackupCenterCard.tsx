/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Loader2, FlaskConical } from 'lucide-react';
import { clsx } from 'clsx';
import { GlassCard } from '@/components/ui/GlassCard';
import { zahl } from '@/lib/formatters';
import * as api from '@/lib/api';
import { SectionHeader } from './ui';

const STAND: Record<api.BackupStand, { label: string; farbe: string }> = {
  ok: { label: 'Aktuell', farbe: 'bg-emerald-500/10 text-emerald-400' },
  ueberfaellig: { label: 'Überfällig', farbe: 'bg-amber-500/10 text-amber-400' },
  'ohne-zeitplan': { label: 'Ohne Zeitplan', farbe: 'bg-amber-500/10 text-amber-400' },
  fehlt: { label: 'Fehlt', farbe: 'bg-red-500/10 text-red-400' },
  ungesichert: { label: 'Ungesichert', farbe: 'bg-red-500/10 text-red-400' },
  fehler: { label: 'Fehler', farbe: 'bg-red-500/10 text-red-400' },
};

const zeit = (iso: string) => new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const groesse = (b: number) => (b >= 1024 ** 3 ? `${zahl(b / 1024 ** 3, 1)} GB` : `${zahl(b / 1024 ** 2, 0)} MB`);

function Zeile({ name, status, zeilen, aktion, breit }: { breit?: string; name: string; status: api.BackupStand; zeilen: React.ReactNode[]; aktion?: React.ReactNode }) {
  return (
    <div className={clsx('flex flex-col h-full rounded-xl border border-white/[0.05] bg-white/[0.015] px-3 py-2.5', breit)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium truncate">{name}</p>
        <span className={clsx('px-2 py-0.5 rounded text-[11px] flex-shrink-0', STAND[status].farbe)}>{STAND[status].label}</span>
      </div>
      <div className="mt-1 space-y-0.5 flex-1">
        {zeilen.filter(Boolean).map((z, i) => <p key={i} className="text-[12px] text-white/55 break-words">{z}</p>)}
      </div>
      {aktion}
    </div>
  );
}

export function BackupCenterCard() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['backup-zentrale'], queryFn: api.getBackupZentrale, refetchInterval: 60000 });
  const test = useMutation({
    mutationFn: (id: number) => api.testBackup(id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['backup-zentrale'] });
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });
  const d = data?.dashboard;
  const px = data?.proxmox;

  return (
    <GlassCard>
      <div className="relative z-10">
        <SectionHeader icon={ShieldCheck} tint="bg-emerald-500/10 border-emerald-500/20 text-emerald-400" title="Backup-Zentrale" desc="Alle Sicherungen auf einen Blick, mit Restore-Test" />
        {isLoading && <p className="text-xs text-white/50 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Wird geladen…</p>}
        {error && <p className="text-xs text-red-400">Übersicht nicht ladbar</p>}
        {d && px && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Zeile
              name="Dashboard & Bots"
              breit="sm:col-span-2"
              status={d.status}
              zeilen={[
                d.letzte ? `Letzte: ${zeit(d.letzte)}${d.groesse ? ` · ${groesse(d.groesse)}` : ''} · Bot-Datenbanken: ${d.botDatenbanken}` : 'Noch keine Sicherung',
                d.test ? <span className={d.test.ok ? 'text-emerald-400' : 'text-red-400'}>Restore-Test {d.test.ok ? 'bestanden' : 'gescheitert'} (Stand {zeit(d.test.stand)}): {d.test.detail}</span> : 'Restore-Test: noch keiner',
                !d.offsite.aktiv ? 'Off-Site-Kopie ist aus' : d.offsite.letzte
                  ? (d.offsite.letzte.ok ? `Off-Site: ${zeit(d.offsite.letzte.am)}` : <span className="text-red-400">Off-Site gescheitert: {d.offsite.letzte.error}</span>)
                  : 'Off-Site: noch kein Lauf',
                d.hinweis && <span className="text-amber-400">{d.hinweis}</span>,
              ]}
              aktion={d.letzteId ? (
                <button onClick={() => test.mutate(d.letzteId!)} disabled={test.isPending} className="btn-glass text-xs mt-2 w-full flex items-center justify-center gap-1.5">
                  {test.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />} Jetzt testen
                </button>
              ) : undefined}
            />
            {px.gaeste.map(g => (
              <Zeile
                key={g.vmid}
                // Ein einzelner Rest in der letzten Reihe füllt die ganze Breite.
                breit="sm:[&:last-child:nth-child(even)]:col-span-2"
                name={`${g.name} (${g.vmid})`}
                status={g.status}
                zeilen={[
                  g.letzte ? `Letzte: ${zeit(g.letzte)}${g.groesse ? ` · ${groesse(g.groesse)}` : ''}` : 'Keine Sicherung gefunden',
                  `${g.anzahl} Stände${g.ziel ? ` auf ${g.ziel}` : ''}`,
                  g.zeitplan ? `Zeitplan: ${g.zeitplan}` : 'In keinem Proxmox-Backup-Job',
                ]}
              />
            ))}
          </div>
        )}
        {px?.fehler && <p className="text-xs text-red-400 mt-2">Proxmox nicht abfragbar: {px.fehler}</p>}
      </div>
    </GlassCard>
  );
}
