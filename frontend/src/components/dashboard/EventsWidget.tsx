/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { clsx } from 'clsx';
import { GlassCard } from '@/components/ui/GlassCard';
import * as api from '@/lib/api';

interface Event { ts: number; kind: 'alert' | 'audit'; text: string; sub?: string; }

function rel(ms: number): string {
  const sec = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export function EventsWidget() {
  const { data: alerts } = useQuery<any[]>({ queryKey: ['alert-history-widget'], queryFn: () => api.getAlertHistory(15) as Promise<any[]>, refetchInterval: 60000 });
  const { data: audit } = useQuery<any[]>({ queryKey: ['audit-widget'], queryFn: () => api.getAuditLog(15) as Promise<any[]>, refetchInterval: 60000 });

  const events: Event[] = [];
  for (const a of alerts ?? []) {
    events.push({ ts: new Date((a.sent_at || '') + 'Z').getTime(), kind: 'alert', text: a.message || a.event_type, sub: a.channel_name });
  }
  for (const e of audit ?? []) {
    events.push({ ts: new Date((e.created_at || '') + 'Z').getTime(), kind: 'audit', text: `${e.action}${e.target ? ' · ' + e.target : ''}`, sub: e.details || undefined });
  }
  const sorted = events.filter(e => !isNaN(e.ts)).sort((a, b) => b.ts - a.ts).slice(0, 8);

  return (
    <GlassCard delay={0.35} className="h-full">
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <History className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <span className="text-xs font-medium text-white/60">Ereignisse</span>
        </div>
        {sorted.length === 0 ? (
          <p className="text-sm text-white/25 text-center py-6">Noch keine Ereignisse</p>
        ) : (
          <div className="space-y-2">
            {sorted.map((e, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', e.kind === 'alert' ? 'bg-amber-400' : 'bg-cyan-400/70')} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/70 truncate">{e.text}</p>
                  {e.sub && <p className="text-[10px] text-white/25 truncate">{e.sub}</p>}
                </div>
                <span className="text-[10px] text-white/25 tabular-nums flex-shrink-0">{rel(e.ts)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
