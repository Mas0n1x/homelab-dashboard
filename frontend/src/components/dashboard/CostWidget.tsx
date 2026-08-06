/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import Link from 'next/link';
import { Wallet, CalendarClock } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useServerStore } from '@/stores/serverStore';

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / (1000 * 60 * 60 * 24));
}

export function CostWidget() {
  const { servers } = useServerStore();

  const withCost = servers.filter(s => s.monthly_cost != null && s.monthly_cost > 0);
  const totalEur = withCost.reduce((a, s) => a + (s.currency === 'USD' ? (s.monthly_cost || 0) * 0.92 : (s.monthly_cost || 0)), 0);

  // Nächste Verlängerung
  const next = servers
    .map(s => ({ name: s.name, days: daysUntil(s.expires_at) }))
    .filter(x => x.days != null)
    .sort((a, b) => (a.days! - b.days!))[0];

  return (
    <Link href="/settings" className="block group h-full">
      <GlassCard delay={0.22} hover className="h-full">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-3.5 h-3.5 text-white/40" />
            <span className="stat-label">Kosten / Monat</span>
          </div>
          {withCost.length === 0 ? (
            <div>
              <p className="text-lg font-semibold text-white/40">–</p>
              <p className="text-[11px] text-white/30 mt-1">Kosten je Server in den Einstellungen hinterlegen</p>
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-1">
                <span className="stat-value">{totalEur.toFixed(2)}</span>
                <span className="text-white/40 text-sm">€</span>
              </div>
              <p className="text-[11px] text-white/30 mt-1">{withCost.length} von {servers.length} Servern erfasst · {(totalEur * 12).toFixed(0)} €/Jahr</p>
              {/* In der schmalen Mobil-Kachel klebten Label und Wert aneinander */}
              {next && next.days != null && (
                <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-[11px] text-white/40 min-w-0"><CalendarClock className="w-3 h-3 flex-shrink-0" /> <span className="truncate">Nächste Verlängerung</span></span>
                  <span className={`text-[11px] font-medium flex-shrink-0 ${next.days <= 14 ? 'text-amber-400' : 'text-white/50'}`}>{next.days <= 0 ? 'fällig' : `${next.days} T`}</span>
                </div>
              )}
            </>
          )}
        </div>
      </GlassCard>
    </Link>
  );
}
