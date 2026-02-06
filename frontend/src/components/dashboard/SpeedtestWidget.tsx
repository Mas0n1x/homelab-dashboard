'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Gauge, ArrowDown, ArrowUp, Activity, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { GlassCard } from '@/components/ui/GlassCard';
import * as api from '@/lib/api';
import type { SpeedtestResult } from '@/lib/types';

export function SpeedtestWidget() {
  const queryClient = useQueryClient();

  const { data: latest } = useQuery<SpeedtestResult | null>({
    queryKey: ['speedtest-latest'],
    queryFn: () => api.getSpeedtestLatest() as Promise<SpeedtestResult | null>,
    staleTime: 60000,
  });

  const { data: history } = useQuery<SpeedtestResult[]>({
    queryKey: ['speedtest-history'],
    queryFn: () => api.getSpeedtestHistory(20) as Promise<SpeedtestResult[]>,
    staleTime: 60000,
  });

  const runMutation = useMutation({
    mutationFn: () => api.runSpeedtest(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['speedtest-latest'] });
      queryClient.invalidateQueries({ queryKey: ['speedtest-history'] });
    },
  });

  const chartData = (history || []).reverse().map(r => ({
    time: r.tested_at ? new Date(r.tested_at + 'Z').toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '',
    download: parseFloat(r.download.toFixed(1)),
    upload: parseFloat(r.upload.toFixed(1)),
  }));

  return (
    <GlassCard delay={0.35} hover>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium">Speedtest</span>
          </div>
          <button
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
            className="btn-glass text-xs px-3 py-1.5 disabled:opacity-40 flex items-center gap-1.5"
          >
            {runMutation.isPending ? (
              <><Loader2 className="w-3 h-3 animate-spin" /> Läuft...</>
            ) : (
              'Test starten'
            )}
          </button>
        </div>

        {latest ? (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <ArrowDown className="w-3 h-3 text-emerald-400" />
                <span className="text-xs text-white/40">Download</span>
              </div>
              <span className="text-lg font-bold text-emerald-400 font-mono">{latest.download.toFixed(1)}</span>
              <span className="text-xs text-white/30 ml-1">Mbps</span>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <ArrowUp className="w-3 h-3 text-blue-400" />
                <span className="text-xs text-white/40">Upload</span>
              </div>
              <span className="text-lg font-bold text-blue-400 font-mono">{latest.upload.toFixed(1)}</span>
              <span className="text-xs text-white/30 ml-1">Mbps</span>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Activity className="w-3 h-3 text-amber-400" />
                <span className="text-xs text-white/40">Ping</span>
              </div>
              <span className="text-lg font-bold text-amber-400 font-mono">{latest.ping.toFixed(0)}</span>
              <span className="text-xs text-white/30 ml-1">ms</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-white/30 text-center mb-4">Noch kein Test durchgeführt</p>
        )}

        {chartData.length > 1 && (
          <div className="h-24 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="dlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ulGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: 'rgba(10,10,26,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                  labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                />
                <Area type="monotone" dataKey="download" stroke="#34d399" fill="url(#dlGrad)" strokeWidth={1.5} dot={false} name="Download (Mbps)" />
                <Area type="monotone" dataKey="upload" stroke="#60a5fa" fill="url(#ulGrad)" strokeWidth={1.5} dot={false} name="Upload (Mbps)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
