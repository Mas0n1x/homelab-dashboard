/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Cpu, MemoryStick, Network, HardDrive, TrendingUp } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { HistoryChart } from '@/components/monitoring/HistoryChart';
import * as api from '@/lib/api';
import type { MetricSample } from '@/lib/types';

const RANGES = [{ label: '1 h', min: 60 }, { label: '6 h', min: 360 }, { label: '24 h', min: 1440 }];

function fmtRate(bytes: number) {
  if (!bytes || bytes < 1) return '0 B/s';
  const u = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${u[i]}`;
}

// Lineare Regression über die Disk-Samples -> geschätzte Zeit bis 100 %.
function diskForecast(samples: MetricSample[]): { text: string; warn: boolean } | null {
  const pts = samples.filter(s => s.disk != null).map(s => ({ t: new Date(s.ts).getTime(), v: s.disk as number }));
  if (pts.length < 6) return null;
  const n = pts.length;
  const t0 = pts[0].t;
  const xs = pts.map(p => p.t - t0);
  const ys = pts.map(p => p.v);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  const slope = den ? num / den : 0; // % pro ms
  const current = ys[n - 1];
  if (slope <= 1e-11) return { text: 'stabil', warn: false };
  const days = ((100 - current) / slope) / (1000 * 60 * 60 * 24);
  if (days > 3650) return { text: 'stabil', warn: false };
  if (days < 1) return { text: 'unter 1 Tag', warn: true };
  return { text: `~${Math.round(days)} Tage`, warn: days < 30 };
}

export function MetricsHistoryPanel({ serverId }: { serverId: string }) {
  const [minutes, setMinutes] = useState(360);

  const { data: metrics } = useQuery<MetricSample[]>({
    queryKey: ['metrics-panel', serverId, minutes],
    queryFn: () => api.getMetrics(serverId, minutes) as Promise<MetricSample[]>,
    refetchInterval: 30000,
  });
  // Prognose über ein langes Fenster (48h), unabhängig vom gewählten Zoom.
  const { data: forecastData } = useQuery<MetricSample[]>({
    queryKey: ['metrics-forecast', serverId],
    queryFn: () => api.getMetrics(serverId, 2880) as Promise<MetricSample[]>,
    refetchInterval: 300000,
  });

  const m = metrics ?? [];
  const cpu = m.map(x => x.cpu ?? 0);
  const mem = m.map(x => x.mem ?? 0);
  const rx = m.map(x => x.rx ?? 0);
  const tx = m.map(x => x.tx ?? 0);
  const curRx = rx[rx.length - 1] ?? 0;
  const curTx = tx[tx.length - 1] ?? 0;
  const curDisk = (m[m.length - 1]?.disk ?? 0);

  const forecast = diskForecast(forecastData ?? []);

  return (
    <GlassCard>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-white/40" />
            <h3 className="text-sm font-semibold">Verlauf</h3>
          </div>
          <div className="flex gap-1">
            {RANGES.map(r => (
              <button key={r.min} onClick={() => setMinutes(r.min)}
                className={clsx('px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all', minutes === r.min ? 'bg-accent/20 border border-accent/30 text-accent-light' : 'bg-white/[0.03] border border-white/10 text-white/40 hover:text-white/70')}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div>
            <div className="flex items-center gap-3 mb-1.5 text-[11px]">
              <span className="flex items-center gap-1 text-emerald-400"><Cpu className="w-3 h-3" /> CPU {Math.round(cpu[cpu.length - 1] ?? 0)}%</span>
              <span className="flex items-center gap-1 text-violet-400"><MemoryStick className="w-3 h-3" /> RAM {Math.round(mem[mem.length - 1] ?? 0)}%</span>
            </div>
            <HistoryChart gridPercent max={100} series={[{ label: 'CPU', color: '#10b981', data: cpu }, { label: 'RAM', color: '#8b5cf6', data: mem }]} />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1.5 text-[11px]">
              <span className="flex items-center gap-1 text-emerald-400/80"><Network className="w-3 h-3" /> ↓ {fmtRate(curRx)}</span>
              <span className="flex items-center gap-1 text-blue-400/80">↑ {fmtRate(curTx)}</span>
            </div>
            <HistoryChart series={[{ label: 'RX', color: '#10b981', data: rx }, { label: 'TX', color: '#3b82f6', data: tx }]} />
          </div>
        </div>

        {/* Speicher-Prognose */}
        <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs text-white/50"><HardDrive className="w-3.5 h-3.5" /> Speicher-Prognose ({Math.round(curDisk)}% belegt)</span>
          {forecast ? (
            <span className={clsx('text-xs font-medium', forecast.warn ? 'text-amber-400' : 'text-white/60')}>
              {forecast.text === 'stabil' ? 'Trend stabil' : `voll in ${forecast.text}`}
            </span>
          ) : (
            <span className="text-xs text-white/30">Sammle Daten…</span>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
