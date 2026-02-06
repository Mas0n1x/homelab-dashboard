'use client';

import { useEffect, useState } from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip, Legend } from 'recharts';
import { GlassCard } from '@/components/ui/GlassCard';
import { formatBytesPerSec } from '@/lib/formatters';
import type { NetworkInterface } from '@/lib/types';

interface NetworkChartProps {
  network: NetworkInterface[] | null;
}

const MAX_POINTS = 60;

export function NetworkChart({ network }: NetworkChartProps) {
  const [data, setData] = useState<{ rx: number; tx: number; time: number }[]>([]);

  useEffect(() => {
    if (!network || network.length === 0) return;
    const main = network[0];
    setData(prev => {
      const next = [...prev, { rx: main.rxRate, tx: main.txRate, time: Date.now() }];
      return next.slice(-MAX_POINTS);
    });
  }, [network]);

  const mainNet = network?.[0];

  return (
    <GlassCard delay={0.4} className="lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="stat-label mb-1">Netzwerk</p>
          <div className="flex gap-6">
            <div>
              <span className="text-xs text-cyan-400 mr-1.5">Download</span>
              <span className="text-lg font-semibold">{formatBytesPerSec(mainNet?.rxRate || 0)}</span>
            </div>
            <div>
              <span className="text-xs text-purple-400 mr-1.5">Upload</span>
              <span className="text-lg font-semibold">{formatBytesPerSec(mainNet?.txRate || 0)}</span>
            </div>
          </div>
        </div>
        <span className="text-xs text-white/30 font-mono">{mainNet?.interface || 'N/A'}</span>
      </div>
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="rxGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(6,182,212,0.3)" />
                <stop offset="100%" stopColor="rgba(6,182,212,0)" />
              </linearGradient>
              <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(139,92,246,0.2)" />
                <stop offset="100%" stopColor="rgba(139,92,246,0)" />
              </linearGradient>
            </defs>
            <YAxis hide />
            <Tooltip
              contentStyle={{
                background: 'rgba(15,15,35,0.9)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px',
              }}
              formatter={(v: number, name: string) => [formatBytesPerSec(v), name === 'rx' ? 'Download' : 'Upload']}
              labelFormatter={() => ''}
            />
            <Area type="monotone" dataKey="rx" stroke="rgb(6,182,212)" fill="url(#rxGrad)" strokeWidth={2} dot={false} animationDuration={300} />
            <Area type="monotone" dataKey="tx" stroke="rgb(139,92,246)" fill="url(#txGrad)" strokeWidth={1.5} dot={false} animationDuration={300} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
