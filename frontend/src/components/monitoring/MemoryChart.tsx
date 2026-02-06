'use client';

import { useRef, useEffect, useState } from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { GlassCard } from '@/components/ui/GlassCard';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';

interface MemoryChartProps {
  memPercent: number;
}

const MAX_POINTS = 60;

export function MemoryChart({ memPercent }: MemoryChartProps) {
  const [data, setData] = useState<{ value: number; time: number }[]>([]);
  const prevValue = useRef(memPercent);

  useEffect(() => {
    if (memPercent !== prevValue.current || data.length === 0) {
      setData(prev => {
        const next = [...prev, { value: memPercent, time: Date.now() }];
        return next.slice(-MAX_POINTS);
      });
      prevValue.current = memPercent;
    }
  }, [memPercent, data.length]);

  return (
    <GlassCard delay={0.35}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="stat-label mb-1">RAM Auslastung</p>
          <p className="text-2xl font-bold">
            <AnimatedNumber value={memPercent} decimals={1} suffix="%" />
          </p>
        </div>
        <div className="w-3 h-3 rounded-full bg-purple-400 animate-pulse-dot" />
      </div>
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(139,92,246,0.3)" />
                <stop offset="100%" stopColor="rgba(139,92,246,0)" />
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
              formatter={(v: number) => [`${v.toFixed(1)}%`, 'RAM']}
              labelFormatter={() => ''}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="rgb(139,92,246)"
              fill="url(#memGrad)"
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
