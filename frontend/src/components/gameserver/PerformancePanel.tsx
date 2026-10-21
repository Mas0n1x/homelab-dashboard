/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useEffect, useState } from 'react';
import { Activity, ArrowDownUp, Clock, Cpu, HardDrive, MemoryStick } from 'lucide-react';
import { Sparkline } from '@/components/ui/Sparkline';
import { zahl } from '@/lib/formatters';
import { type Api, type GameServer, StatCard, fmtSize, fmtUptime } from './shared';

interface Verlauf { t: number; cpu: number; memory: number; rx: number; tx: number }

export function PerformancePanel({ api, server }: { api: Api; server: GameServer }) {
  const [data, setData] = useState<{ state: any; stats: any; history: Verlauf[] } | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => { const r = await api('/stats'); if (alive && !r.error) setData(r); };
    load();
    const t = setInterval(load, 3000);
    return () => { alive = false; clearInterval(t); };
  }, [api]);

  const s = data?.stats || data?.state;
  const running = data?.state?.running;
  const memLimit = (s?.memoryLimit as number) || server.limits.memory * 1024 * 1024;
  const cpuMax = server.limits.cpu || 100; // Pelican zählt 100 % je Kern
  const hist = data?.history || [];
  const memP = memLimit ? ((s?.memory || 0) / memLimit) * 100 : 0;
  const cpuP = cpuMax ? ((s?.cpu || 0) / cpuMax) * 100 : 0;
  const diskLimit = server.limits.disk * 1024 * 1024;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Cpu} label="CPU-Auslastung" value={running ? `${zahl(s?.cpu || 0, 1)} %` : '—'} sub={cpuMax ? `von ${cpuMax} %` : ''} percent={running ? cpuP : 0} color={cpuP > 85 ? '#ef4444' : cpuP > 60 ? '#f59e0b' : '#06b6d4'} />
        <StatCard icon={MemoryStick} label="Arbeitsspeicher" value={running ? fmtSize(s?.memory || 0) : '—'} sub={memLimit ? `von ${fmtSize(memLimit)}` : 'unbegrenzt'} percent={running ? memP : 0} color={memP > 90 ? '#ef4444' : memP > 75 ? '#f59e0b' : '#8b5cf6'} />
        <StatCard icon={HardDrive} label="Speicherplatz" value={fmtSize(s?.disk || 0)} sub={diskLimit ? `von ${fmtSize(diskLimit)}` : 'unbegrenzt'} percent={diskLimit ? ((s?.disk || 0) / diskLimit) * 100 : undefined} color="#10b981" />
        <StatCard icon={Clock} label="Laufzeit" value={running ? fmtUptime(s?.uptime) : '—'} sub={running ? 'seit dem Start' : 'gestoppt'} color="#f59e0b" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3 text-xs text-white/50"><Activity className="w-4 h-4 text-cyan-400" /> CPU-Verlauf</div>
          <Sparkline data={hist.map(h => h.cpu)} color="#06b6d4" height={90} min={0} max={Math.max(cpuMax, ...hist.map(h => h.cpu))} />
          {hist.length < 2 && <p className="text-[11px] text-white/25 mt-2">Der Verlauf füllt sich, solange diese Seite offen ist.</p>}
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3 text-xs text-white/50"><MemoryStick className="w-4 h-4 text-violet-400" /> Speicher-Verlauf</div>
          <Sparkline data={hist.map(h => h.memory)} color="#8b5cf6" height={90} min={0} max={memLimit || undefined} />
        </div>
      </div>

      <div className="glass-card rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div className="flex items-center gap-2"><ArrowDownUp className="w-4 h-4 text-white/40" /><span className="text-white/50">Netzwerk</span><span className="text-white/70 tabular-nums ml-auto sm:ml-2">↓ {fmtSize(s?.rx || 0)} · ↑ {fmtSize(s?.tx || 0)}</span></div>
        <div className="flex items-center gap-2"><span className="text-white/50">Adresse</span><span className="font-mono text-white/70">{server.host || '–'}</span></div>
        <div className="flex items-center gap-2"><span className="text-white/50">Limits</span><span className="text-white/70">{server.limits.memory ? `${zahl(server.limits.memory / 1024, 1)} GB RAM` : '∞ RAM'} · {server.limits.cpu ? `${server.limits.cpu} % CPU` : '∞ CPU'}</span></div>
      </div>
    </div>
  );
}
