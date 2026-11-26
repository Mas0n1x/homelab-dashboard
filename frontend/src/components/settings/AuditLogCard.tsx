/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { clsx } from 'clsx';
import { GlassCard } from '@/components/ui/GlassCard';
import * as api from '@/lib/api';
import { formatAudit } from '@/lib/audit';
import { SectionHeader } from './ui';

export function AuditLogCard() {
  const { data: auditLog } = useQuery<any[]>({
    queryKey: ['audit-log'],
    queryFn: () => api.getAuditLog(50) as Promise<any[]>,
  });

  return (
    <GlassCard>
          <div className="relative z-10">
            <SectionHeader icon={ScrollText} tint="bg-cyan-500/10 border-cyan-500/20 text-cyan-400" title="Audit Log" desc="Sicherheitsrelevante Aktionen" />
            {(!auditLog || auditLog.length === 0) ? (
              <p className="text-sm text-white/50 text-center py-8">Noch keine Audit-Einträge</p>
            ) : (
              <div className="space-y-4 max-h-[440px] overflow-y-auto pr-1">
                {(() => {
                  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
                  const fmtDay = (iso: string) => {
                    const d = new Date(iso + 'Z');
                    const today = new Date();
                    const yest = new Date(); yest.setDate(today.getDate() - 1);
                    if (same(d, today)) return 'Heute';
                    if (same(d, yest)) return 'Gestern';
                    return d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' });
                  };
                  const groups: { day: string; items: any[] }[] = [];
                  for (const entry of auditLog) {
                    const day = fmtDay(entry.created_at);
                    let g = groups[groups.length - 1];
                    if (!g || g.day !== day) { g = { day, items: [] }; groups.push(g); }
                    g.items.push(entry);
                  }
                  return groups.map(g => (
                    <div key={g.day}>
                      <p className="text-[11px] uppercase tracking-widest text-white/50 font-medium mb-1.5 px-1">{g.day}</p>
                      <div className="space-y-0.5">
                        {g.items.map((entry: any) => {
                          const f = formatAudit(entry.action, entry.target, entry.details);
                          const Icon = f.Icon;
                          return (
                            <div key={entry.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-white/[0.02] transition">
                              <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                                <Icon className={clsx('w-3.5 h-3.5', f.tint)} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-white/80 truncate">{f.label}</p>
                                {f.detail && <p className="text-[11px] text-white/50 truncate">{f.detail}</p>}
                              </div>
                              <span className="text-[11px] text-white/50 tabular-nums flex-shrink-0" title={new Date(entry.created_at + 'Z').toLocaleString('de-DE')}>
                                {new Date(entry.created_at + 'Z').toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </GlassCard>
  );
}
