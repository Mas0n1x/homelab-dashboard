/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Server, Play, Power, RotateCw, Loader2, ArrowUpRight, Boxes, Monitor } from 'lucide-react';
import * as api from '@/lib/api';
import { zahl } from '@/lib/formatters';
import { LEVEL_HEX, level } from '@/lib/health';
import { formatBytes } from './serverCardShared';
import type { ProxmoxGast, ProxmoxStatus } from '@/lib/api';

function dauer(sekunden: number): string {
  if (!sekunden) return '–';
  const t = Math.floor(sekunden / 86400);
  const h = Math.floor((sekunden % 86400) / 3600);
  const m = Math.floor((sekunden % 3600) / 60);
  if (t > 0) return `${t} T ${h} Std`;
  if (h > 0) return `${h} Std ${m} Min`;
  return `${m} Min`;
}

const GRID = 'grid items-center gap-x-4 grid-cols-[minmax(0,1fr)_5rem_5rem] md:grid-cols-[minmax(0,1.5fr)_4rem_5rem_8rem_6rem_6rem]';

function Anteil({ wert, text, limit = 90 }: { wert: number; text: string; limit?: number }) {
  const l = level(wert, limit);
  return (
    <div className="space-y-1">
      <div className="text-[12px] tabular-nums text-white/75">{text}</div>
      <div className="h-1 rounded-full bg-white/[0.07] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, wert)}%`, background: LEVEL_HEX[l] }} />
      </div>
    </div>
  );
}

function GastZeile({ g, beschaeftigt, onAktion }: {
  g: ProxmoxGast; beschaeftigt: boolean; onAktion: (g: ProxmoxGast, aktion: string, text: string, frage?: string) => void;
}) {
  const laeuft = g.status === 'running';
  const cpuPct = (g.cpu || 0) * 100;
  const memPct = g.maxmem ? (g.mem / g.maxmem) * 100 : 0;
  const knopf = 'p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-accent/60 transition-colors disabled:opacity-40';

  return (
    <div className={clsx(GRID, 'px-4 py-2.5 border-b border-white/[0.04] last:border-b-0')}>
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={clsx('w-2.5 h-2.5 rounded-full flex-shrink-0', laeuft ? 'bg-emerald-400' : 'bg-white/30')} />
        <div className="min-w-0">
          <div className="text-[13px] font-medium truncate">{g.name}</div>
          <div className="text-[11px] text-white/50 flex items-center gap-1.5">
            {g.typ === 'qemu' ? <Monitor className="w-3 h-3" /> : <Boxes className="w-3 h-3" />}
            {g.typ === 'qemu' ? 'VM' : 'Container'} {g.vmid}
            {!laeuft && <span className="text-white/45">· {g.status === 'stopped' ? 'gestoppt' : g.status}</span>}
          </div>
        </div>
      </div>
      <span className="hidden md:block text-[11px] text-white/50 tabular-nums">{g.maxcpu} Kerne</span>
      {laeuft ? (
        <>
          <div className="hidden md:block"><Anteil wert={cpuPct} text={`${zahl(cpuPct, 0)} %`} /></div>
          <div className="hidden md:block"><Anteil wert={memPct} text={`${formatBytes(g.mem)} / ${formatBytes(g.maxmem)}`} /></div>
          <span className="hidden md:block text-[12px] text-white/55 font-mono">{dauer(g.uptime)}</span>
        </>
      ) : (
        <span className="hidden md:block md:col-span-3 text-[12px] text-white/45">–</span>
      )}
      <div className="flex items-center justify-end gap-0.5 col-start-3 md:col-start-auto">
        {beschaeftigt ? <Loader2 className="w-4 h-4 animate-spin text-white/55" /> : laeuft ? (
          <>
            <button className={knopf} aria-label={`${g.name} neu starten`} title="Neu starten"
              onClick={() => onAktion(g, 'reboot', 'wird neu gestartet', `${g.name} neu starten?`)}><RotateCw className="w-3.5 h-3.5" /></button>
            <button className={clsx(knopf, 'hover:!text-red-300')} aria-label={`${g.name} herunterfahren`} title="Herunterfahren"
              onClick={() => onAktion(g, 'shutdown', 'fährt herunter', `${g.name} herunterfahren?`)}><Power className="w-3.5 h-3.5" /></button>
          </>
        ) : (
          <button className={knopf} aria-label={`${g.name} starten`} title="Starten"
            onClick={() => onAktion(g, 'start', 'startet')}><Play className="w-3.5 h-3.5" /></button>
        )}
      </div>
    </div>
  );
}

/**
 * Proxmox-Host und seine Gäste direkt auf der Startseite — mit Start, Neustart
 * und Herunterfahren. Snapshots und Aufgabenprotokoll bleiben auf der
 * Proxmox-Seite. Ist Proxmox nicht konfiguriert oder nicht erreichbar,
 * erscheint hier nichts.
 */
export function ProxmoxFleetPanel() {
  const qc = useQueryClient();
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const [aktiv, setAktiv] = useState<string | null>(null);

  const { data } = useQuery<ProxmoxStatus>({
    queryKey: ['proxmox-status'],
    queryFn: api.getProxmoxStatus,
    refetchInterval: 10000,
    staleTime: 5000,
    retry: false,
  });

  const mut = useMutation({
    mutationFn: ({ g, aktion }: { g: ProxmoxGast; aktion: string; text: string }) => api.proxmoxGastAktion(g.typ, g.vmid, aktion),
    onSuccess: (_r, v) => {
      setMeldung({ ok: true, text: `${v.g.name} ${v.text}` });
      setTimeout(() => qc.invalidateQueries({ queryKey: ['proxmox-status'] }), 1500);
    },
    onError: (e: Error) => setMeldung({ ok: false, text: e.message }),
    onSettled: () => { setAktiv(null); setTimeout(() => setMeldung(null), 6000); },
  });

  if (!data?.konfiguriert || !data.node) return null;

  const gaeste = (data.gaeste ?? []).filter(g => !g.vorlage);
  const laufend = gaeste.filter(g => g.status === 'running').length;
  const n = data.node;
  const cpuPct = n.cpu * 100;
  const memPct = n.maxmem ? (n.mem / n.maxmem) * 100 : 0;
  const diskPct = n.maxdisk ? (n.disk / n.maxdisk) * 100 : 0;

  const aktion = (g: ProxmoxGast, a: string, text: string, frage?: string) => {
    if (frage && !window.confirm(frage)) return;
    setAktiv(`${g.typ}${g.vmid}`);
    setMeldung(null);
    mut.mutate({ g, aktion: a, text });
  };

  return (
    <section aria-label="Proxmox">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-widest text-white/50 font-medium">Proxmox</h2>
        <Link href="/proxmox" className="flex items-center gap-1 text-[12px] text-white/55 hover:text-white/85 transition-colors">
          Snapshots &amp; Aufgaben <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="glass-card">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Server className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{n.name}</div>
                <div className="text-[11px] text-white/50">Proxmox {data.version} · {laufend}/{gaeste.length} Gäste laufen</div>
              </div>
            </div>
            <div className="flex items-center gap-4 ml-auto text-[12px] tabular-nums">
              {[['CPU', cpuPct, `${zahl(cpuPct, 0)} %`], ['RAM', memPct, `${zahl(memPct, 0)} %`], ['Platte', diskPct, `${zahl(diskPct, 0)} %`]].map(([l, w, t]) => (
                <div key={l as string} className="w-16 space-y-1">
                  <div className="flex justify-between text-white/55"><span className="text-[11px]">{l}</span><span className="text-white/80">{t}</span></div>
                  <div className="h-1 rounded-full bg-white/[0.07] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, w as number)}%`, background: LEVEL_HEX[level(w as number, 90)] }} /></div>
                </div>
              ))}
              <span className="hidden sm:block text-white/55 font-mono">{dauer(n.uptime)}</span>
            </div>
          </div>

          <div className={clsx(GRID, 'px-4 py-2 border-b border-white/[0.06]')} aria-hidden="true">
            {['Gast', 'Kerne', 'CPU', 'Arbeitsspeicher', 'Uptime', ''].map((t, i) => (
              <span key={i} className={clsx('text-[11px] uppercase tracking-wider text-white/50', i > 0 && i < 5 && 'hidden md:block')}>{t}</span>
            ))}
          </div>
          {gaeste.map(g => (
            <GastZeile key={`${g.typ}${g.vmid}`} g={g} beschaeftigt={aktiv === `${g.typ}${g.vmid}`} onAktion={aktion} />
          ))}
          {gaeste.length === 0 && <p className="px-4 py-6 text-center text-[12px] text-white/50">Keine Gäste gefunden.</p>}
          {meldung && (
            <div role="status" className={clsx('px-4 py-2 text-[12px] border-t border-white/[0.06]', meldung.ok ? 'text-emerald-300' : 'text-red-300')}>
              {meldung.ok ? '✓ ' : '⚠ '}{meldung.text}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
