/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useEffect, useState } from 'react';
import { Inbox, ShoppingCart, Mail, Briefcase } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuthStore } from '@/stores/authStore';

const API_BASE = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:${window.location.port}/api`
  : '';

async function api(endpoint: string) {
  const { accessToken } = useAuthStore.getState();
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });
    return res.json();
  } catch { return null; }
}

interface Item {
  source: 'SaleNet' | 'Portfolio';
  kind: 'order' | 'contact' | 'request';
  title: string;
  sub: string;
  status: string;
  time: string;
  isNew: boolean;
}

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

export function RequestsWidget() {
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [recent, portfolio] = await Promise.all([api('/salenet/recent'), api('/portfolio/requests')]);
      const list: Item[] = [];
      if (recent?.orders) for (const o of recent.orders) list.push({ source: 'SaleNet', kind: 'order', title: o.package_name || 'Bestellung', sub: o.customer_name || o.customer_email || '', status: o.status, time: o.created_at, isNew: o.status === 'pending' });
      if (recent?.contacts) for (const c of recent.contacts) list.push({ source: 'SaleNet', kind: 'contact', title: c.subject || 'Kontaktanfrage', sub: c.name || c.email || '', status: c.status, time: c.created_at, isNew: c.status === 'new' });
      if (Array.isArray(portfolio)) for (const p of portfolio) list.push({ source: 'Portfolio', kind: 'request', title: p.subject || p.projectType || p.title || p.name || 'Anfrage', sub: p.name || p.email || p.company || '', status: p.status || 'new', time: p.created_at || p.createdAt || p.date || '', isNew: ['new', 'pending', 'open', 'neu'].includes((p.status || 'new').toLowerCase()) });
      list.sort((a, b) => new Date((b.time || '').replace(' ', 'T')).getTime() - new Date((a.time || '').replace(' ', 'T')).getTime());
      setItems(list);
      setLoaded(true);
    };
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const newCount = items.filter(i => i.isNew).length;
  const KindIcon = { order: ShoppingCart, contact: Mail, request: Briefcase };

  return (
    <GlassCard delay={0.2}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center"><Inbox className="w-3.5 h-3.5 text-orange-400" /></div>
          <span className="text-xs font-medium text-white/60">Neue Anfragen</span>
        </div>
        {newCount > 0 && <span className="text-[11px] font-semibold text-orange-300 bg-orange-500/15 border border-orange-500/25 rounded-full px-2 py-0.5">{newCount} neu</span>}
      </div>
      <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
        {!loaded && <p className="text-[12px] text-white/25 py-4 text-center">Lade…</p>}
        {loaded && items.length === 0 && <p className="text-[12px] text-white/25 py-4 text-center">Keine Anfragen</p>}
        {items.slice(0, 8).map((it, i) => {
          const Icon = KindIcon[it.kind];
          return (
            <div key={i} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/[0.02] transition">
              {it.isNew && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" style={{ boxShadow: '0 0 6px rgba(251,146,60,0.6)' }} />}
              {!it.isNew && <span className="w-1.5 h-1.5 flex-shrink-0" />}
              <Icon className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className={`text-[12px] truncate ${it.isNew ? 'text-white/85' : 'text-white/55'}`}>{it.title}</p>
                {it.sub && <p className="text-[10px] text-white/30 truncate">{it.sub}</p>}
              </div>
              <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 ${it.source === 'SaleNet' ? 'text-amber-300/70 bg-amber-500/10' : 'text-violet-300/70 bg-violet-500/10'}`}>{it.source}</span>
              <span className="text-[10px] text-white/25 tabular-nums flex-shrink-0 w-14 text-right">{relTime(it.time)}</span>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
