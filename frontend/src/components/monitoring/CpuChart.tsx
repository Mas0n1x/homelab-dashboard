'use client';

import { useRef, useEffect, useState } from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { GlassCard } from '@/components/ui/GlassCard';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';

interface CpuChartProps {
  cpuTotal: number;
}

const MAX_POINTS = 60;

export function CpuChart({ cpuTotal }: CpuChartProps) {
  const [data, setData] = useState<{ value: number; time: number }[]>([]);
  const prevValue = useRef(cpuTotal);

  useEffect(() => {
    if (cpuTotal !== prevValue.current || data.length === 0) {
      setData(prev => {
        const next = [...prev, { value: cpuTotal, time: Date.now() }];
        return next.slice(-MAX_POINTS);
      });
      prevValue.current = cpuTotal;
    }
  }, [cpuTotal, data.length]);

  return (
    <GlassCard delay={0.3}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="stat-label mb-1">CPU Auslastung</p>
          <p className="text-2xl font-bold">
            <AnimatedNumber value={cpuTotal} decimals={1} suffix="%" />
          </p>
        </div>
        <div className="w-3 h-3 rounded-full bg-indigo-400 animate-pulse-dot" />
      </div>
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(99,102,241,0.3)" />
                <stop offset="100%" stopColor="rgba(99,102,241,0)" />
              </linearGradient>
            </defs>
            <YAxis domain={[0, 100]} hide />
            <Tooltip
              contentStyle={{
                background: 'rgba(15,15,35,0.9)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px',
              }}
              formatter={(v: number) => [`${v.toFixed(1)}%`, 'CPU']}
              labelFormatter={() => ''}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="rgb(99,102,241)"
              fill="url(#cpuGrad)"
              strokeWidth={2}
              animationDuration={300}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
