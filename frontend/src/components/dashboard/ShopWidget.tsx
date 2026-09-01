/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Package, Euro, ExternalLink, PlugZap, AlertTriangle } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { formatMoney } from '@/hooks/useTimer';
import * as api from '@/lib/api';
import type { EtsyOrders, EtsyStatus } from '@/lib/types';

function vorZeit(iso: string | null) {
  if (!iso) return '';
  const diff = Date.now() - Date.parse(iso);
  if (Number.isNaN(diff)) return '';
  const std = Math.round(diff / 3600000);
  if (std < 1) return 'vor wenigen Minuten';
  if (std < 24) return `vor ${std} Std.`;
  const tage = Math.round(std / 24);
  return tage === 1 ? 'vor 1 Tag' : `vor ${tage} Tagen`;
}

/**
 * PrintOasis3D auf einen Blick: was ist bezahlt und noch nicht raus?
 *
 * Das zweite Standbein lief bisher komplett außerhalb des Control Centers —
 * offene Bestellungen sah man nur in der Etsy-App.
 */
export function ShopWidget() {
  const { data: status } = useQuery<EtsyStatus>({
    queryKey: ['etsy-status'],
    queryFn: api.getEtsyStatus,
    staleTime: 300000,
    retry: false,
  });

  const { data } = useQuery<EtsyOrders>({
    queryKey: ['etsy-orders'],
    queryFn: () => api.getEtsyOrders(),
    // Nur abfragen, wenn wirklich verbunden — sonst läuft die Kachel dauerhaft
    // gegen einen Endpunkt, der nichts liefern kann.
    enabled: !!status?.connected,
    refetchInterval: 600000,
    staleTime: 300000,
    retry: false,
  });

  // Nicht eingerichtet: Kachel gar nicht anzeigen, statt dauerhaft einen
  // Einrichtungshinweis auf der Startseite stehen zu lassen.
  if (status && !status.configured) return null;

  if (status && !status.connected) {
    return (
      <GlassCard>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
            <Package className="w-3.5 h-3.5 text-orange-400" />
          </div>
          <span className="text-xs font-medium text-white/60">PrintOasis3D</span>
        </div>
        <p className="text-[12px] text-white/35 mb-3">
          Etsy ist eingerichtet, aber noch nicht verbunden.
        </p>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[12px] text-white/60 hover:text-white/90 transition-colors"
        >
          <PlugZap className="w-3.5 h-3.5" />
          Mit Etsy verbinden
        </Link>
      </GlassCard>
    );
  }

  const offen = data?.orders ?? [];
  const anzahl = data?.openCount ?? 0;

  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-3">
        <div className={clsx(
          'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
          anzahl > 0 ? 'bg-orange-500/15' : 'bg-white/[0.04]',
        )}>
          <Package className={clsx('w-3.5 h-3.5', anzahl > 0 ? 'text-orange-400' : 'text-white/40')} />
        </div>
        <span className="text-xs font-medium text-white/60 truncate">
          {data?.shopName || 'PrintOasis3D'}
        </span>
        <a
          href="https://www.etsy.com/your/shops/me/orders"
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-white/20 hover:text-white/60 transition-colors flex-shrink-0"
          title="Bei Etsy öffnen"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {data?.error ? (
        <div className="flex items-start gap-2 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-200/70">{data.error}</p>
        </div>
      ) : (
        <>
          {/* Zwei Zahlen: was noch raus muss, und was in 30 Tagen reinkam. */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-2.5">
              <p className="text-lg font-semibold tabular-nums leading-none">{anzahl}</p>
              <p className="text-[10px] text-white/30 mt-1">zu verschicken</p>
            </div>
            <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-2.5">
              <p className="text-lg font-semibold tabular-nums leading-none text-emerald-300">
                {formatMoney(data?.revenue30d ?? 0, data?.currency || 'EUR')}
              </p>
              <p className="text-[10px] text-white/30 mt-1">
                30 Tage · {data?.orders30d ?? 0} Bestellungen
              </p>
            </div>
          </div>

          {offen.length === 0 ? (
            <p className="text-[12px] text-white/25 py-2 text-center">
              Nichts offen — alles verschickt.
            </p>
          ) : (
            <div className="space-y-1.5">
              {offen.slice(0, 5).map(o => (
                <div key={o.receiptId} className="flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                  <span className="text-[12px] truncate min-w-0">{o.buyer}</span>
                  {o.itemCount > 1 && (
                    <span className="text-[10px] text-white/25 flex-shrink-0">{o.itemCount}×</span>
                  )}
                  <span className="text-[10px] text-white/20 flex-shrink-0 hidden sm:inline">
                    {vorZeit(o.createdAt)}
                  </span>
                  <span className="ml-auto text-[11px] tabular-nums text-white/50 flex-shrink-0">
                    {formatMoney(o.total, o.currency)}
                  </span>
                </div>
              ))}
              {offen.length > 5 && (
                <p className="text-[10px] text-white/25 pl-4">und {offen.length - 5} weitere</p>
              )}
            </div>
          )}
        </>
      )}
    </GlassCard>
  );
}
