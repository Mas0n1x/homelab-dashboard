/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import Link from 'next/link';
import { clsx } from 'clsx';
import { CheckCircle2, AlertOctagon, AlertTriangle, Info, ChevronRight } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAttention } from '@/hooks/useAttention';
import type { AttentionSeverity } from '@/lib/types';

const ICON: Record<AttentionSeverity, { cls: string; el: React.ReactNode }> = {
  critical: { cls: 'text-red-400', el: <AlertOctagon className="w-4 h-4" /> },
  warning: { cls: 'text-amber-400', el: <AlertTriangle className="w-4 h-4" /> },
  info: { cls: 'text-sky-300', el: <Info className="w-4 h-4" /> },
};

/** Alles, was jetzt Aufmerksamkeit braucht — dieselbe Liste wie auf der Startseite, ungekürzt. */
export function ActivePanel() {
  const { data, isLoading } = useAttention();
  const items = data?.items ?? [];

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Aktuell</h2>
        {data && <span className="text-[12px] text-white/55">{data.counts.critical} kritisch · {data.counts.warning} Warnungen · {data.counts.info} Hinweise</span>}
      </div>
      {isLoading ? (
        <div className="h-16 animate-pulse rounded-xl bg-white/[0.03]" />
      ) : items.length === 0 ? (
        <div className="flex items-center gap-3 py-4 text-emerald-300 text-sm"><CheckCircle2 className="w-5 h-5" /> Nichts offen — alle Server und Dienste sind in Ordnung.</div>
      ) : (
        <div className="-mx-2">
          {items.map(item => (
            <Link key={item.id} href={item.href} className="group flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/[0.05] focus-visible:bg-white/[0.06] transition-colors">
              <span className={clsx('flex-shrink-0', ICON[item.severity].cls)}>{ICON[item.severity].el}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium truncate">{item.title}</p>
                <p className="text-[12px] text-white/55 truncate">{item.detail}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/35 group-hover:text-white/70 flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
