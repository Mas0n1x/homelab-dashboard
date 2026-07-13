/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Inbox, ShoppingCart, Mail, Briefcase, Check, RotateCcw } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import * as api from '@/lib/api';
import type { BusinessItem } from '@/lib/api';

function relTime(t: string): string {
  if (!t) return '';
  const d = new Date(t.includes('T') ? t : t.replace(' ', 'T') + 'Z');
  const diff = (Date.now() - d.getTime()) / 1000;
  if (isNaN(diff)) return '';
  if (diff < 3600) return `vor ${Math.max(1, Math.floor(diff / 60))} Min`;
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std`;
  if (diff < 604800) return `vor ${Math.floor(diff / 86400)} Tg`;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

const KindIcon = { order: ShoppingCart, contact: Mail, request: Briefcase };

export function RequestsWidget() {
  const qc = useQueryClient();
  const [pending, setPending] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['business-requests'],
    queryFn: () => api.getBusinessRequests(),
    refetchInterval: 30000,
  });

  const dismiss = useMutation({
    mutationFn: (ref: string) => api.dismissBusinessRequest(ref),
    onMutate: (ref) => setPending(p => new Set(p).add(ref)),
    onSettled: () => { setPending(new Set()); qc.invalidateQueries({ queryKey: ['business-requests'] }); },
  });
  const restoreAll = useMutation({
    mutationFn: () => api.restoreBusinessRequests(),
    onSettled: () => qc.invalidateQueries({ queryKey: ['business-requests'] }),
  });

  const items: BusinessItem[] = (data?.items ?? []).filter(i => !pending.has(i.ref));
  const newCount = items.filter(i => i.isNew).length;
  const dismissedCount = data?.dismissedCount ?? 0;

  return (
    <GlassCard delay={0.2}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center"><Inbox className="w-3.5 h-3.5 text-orange-400" /></div>
          <span className="text-xs font-medium text-white/60">Neue Anfragen</span>
        </div>
        <div className="flex items-center gap-2">
          {dismissedCount > 0 && (
            <button
              onClick={() => restoreAll.mutate()}
              title={`${dismissedCount} erledigte wieder einblenden`}
              className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> {dismissedCount}
            </button>
          )}
          {newCount > 0 && <span className="text-[11px] font-semibold text-orange-300 bg-orange-500/15 border border-orange-500/25 rounded-full px-2 py-0.5">{newCount} neu</span>}
        </div>
      </div>

      <div className="space-y-1 max-h-[260px] overflow-y-auto pr-0.5">
        {isLoading && <p className="text-[12px] text-white/25 py-6 text-center">Lade…</p>}
        {!isLoading && items.length === 0 && (
          <div className="py-8 text-center">
            <Check className="w-5 h-5 text-emerald-400/50 mx-auto mb-1.5" />
            <p className="text-[12px] text-white/30">Alles erledigt — keine offenen Anfragen</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {items.slice(0, 12).map((it) => {
            const Icon = KindIcon[it.kind];
            return (
              <motion.div
                key={it.ref}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, x: 24, height: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="group flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-white/[0.03] transition-colors"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${it.isNew ? 'bg-orange-500/10' : 'bg-white/[0.04]'}`}>
                  <Icon className={`w-4 h-4 ${it.isNew ? 'text-orange-400' : 'text-white/40'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-[13px] truncate ${it.isNew ? 'text-white/90 font-medium' : 'text-white/60'}`}>{it.title}</p>
                    {it.amount && <span className="text-[10px] text-emerald-300/80 bg-emerald-500/10 rounded px-1.5 py-0.5 flex-shrink-0 tabular-nums">{it.amount}</span>}
                  </div>
                  {it.sub && <p className="text-[11px] text-white/35 truncate">{it.sub}</p>}
                </div>
                <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 ${it.source === 'SaleNet' ? 'text-amber-300/70 bg-amber-500/10' : 'text-violet-300/70 bg-violet-500/10'}`}>{it.source}</span>
                <span className="text-[10px] text-white/25 tabular-nums flex-shrink-0 hidden sm:block w-14 text-right">{relTime(it.time)}</span>
                <button
                  onClick={() => dismiss.mutate(it.ref)}
                  title="Als erledigt markieren"
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-white/25 hover:text-emerald-400 hover:bg-emerald-500/10 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                >
                  <Check className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </GlassCard>
  );
}
