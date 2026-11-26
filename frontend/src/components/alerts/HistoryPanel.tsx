/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import * as api from '@/lib/api';

interface Eintrag { id: number; event_type: string; message: string; sent_at: string; channel_name: string | null; channel_type: string | null }

const LABEL: Record<string, string> = {
  cpu_high: 'CPU', ram_high: 'RAM', disk_high: 'Speicher', temp_high: 'Temperatur', reboot: 'Neustart',
  container_crash: 'Container gestoppt', container_restart: 'Container aktiv', service_offline: 'Dienst offline', server_offline: 'Server nicht erreichbar',
  status_report: 'Statusbericht', backup_completed: 'Backup ok', backup_failed: 'Backup fehlgeschlagen',
  disk_forecast: 'Speicher-Prognose', image_updates: 'Image-Updates', ram_trend: 'RAM-Trend', test: 'Test',
  new_portfolio_request: 'Neue Anfrage', new_portfolio_customer: 'Neuer Kunde',
};

function titel(ev: string) {
  const [basis, , rest] = ev.split('::');
  const ok = ev.endsWith('::ok');
  const l = LABEL[basis] ?? basis;
  return { text: ok ? `${l} wieder normal` : l, ok, sub: rest && rest !== 'ok' ? rest : null };
}

function zeit(sqlUtc: string) {
  const d = new Date(sqlUtc.replace(' ', 'T') + 'Z');
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Was wurde wann gemeldet — mit Entwarnungen. */
export function HistoryPanel() {
  const [alle, setAlle] = useState(false);
  const { data = [] } = useQuery<Eintrag[]>({ queryKey: ['alert-history-page'], queryFn: () => api.getAlertHistory(100) as Promise<Eintrag[]>, refetchInterval: 60000 });
  const liste = alle ? data : data.slice(0, 12);

  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-white/65" />
        <h2 className="text-sm font-semibold">Verlauf</h2>
        <span className="ml-auto text-[12px] text-white/50">{data.length} Meldungen</span>
      </div>
      {data.length === 0 ? <p className="text-[13px] text-white/55 py-4 text-center">Noch keine Meldungen.</p> : (
        <ol className="relative border-l border-white/[0.08] ml-1.5 space-y-3">
          {liste.map(e => {
            const t = titel(e.event_type);
            return (
              <li key={e.id} className="pl-4 relative">
                <span className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ${t.ok ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] font-medium">{t.text}</span>
                  {t.sub && <span className="text-[12px] text-white/50 truncate">{t.sub}</span>}
                  <span className="ml-auto text-[11px] text-white/50 tabular-nums flex-shrink-0">{zeit(e.sent_at)}</span>
                </div>
                <p className="text-[12px] text-white/55 line-clamp-2">{e.message.replace(/\*\*/g, '').replace(/\n+/g, ' · ')}</p>
              </li>
            );
          })}
        </ol>
      )}
      {data.length > 12 && (
        <button onClick={() => setAlle(v => !v)} className="mt-3 w-full text-center text-[12px] text-white/55 hover:text-white/85 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors">
          {alle ? 'Weniger anzeigen' : `Alle ${data.length} anzeigen`}
        </button>
      )}
    </GlassCard>
  );
}
