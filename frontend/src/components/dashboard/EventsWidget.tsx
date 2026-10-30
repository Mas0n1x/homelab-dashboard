/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { formatAudit, alertMeta, cleanAuditValue } from '@/lib/audit';
import * as api from '@/lib/api';

interface Ev {
  ts: number;
  label: string;
  detail?: string;
  /** Voller Text für den Tooltip (nur bei Alarmen). */
  full?: string;
  Icon: ReturnType<typeof formatAudit>['Icon'];
  tint: string;
  count: number;
}

/**
 * Alarm-Texte lesbar machen. Sammelmeldungen der Form
 *   **Hermes (VPS)**: minecraft, wartung, … und 3 weitere
 *   **AMO (VPS)**: amo-cloudflared, …
 * werden zu „Titel + Zähler je Server“ verdichtet; Markdown-Sterne fliegen raus.
 */
function formatAlert(a: any): { label: string; detail?: string; full: string } {
  const raw = String(a.message ?? '');
  const full = raw.replace(/\*\*/g, '').replace(/\s*\n\s*/g, '\n').trim();
  const gruppen: { server: string; n: number }[] = [];
  const re = /\*\*([^*]+)\*\*:\s*([\s\S]*?)(?=\s*\*\*[^*]+\*\*:|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    // Die Liste endet bei langen Servern auf „… h und 3 weitere“ (ohne Komma).
    let liste = m[2].trim();
    let n = 0;
    const mehr = liste.match(/\s+und (\d+) weitere$/);
    if (mehr) { n += parseInt(mehr[1], 10); liste = liste.slice(0, mehr.index); }
    n += liste.split(',').map(t => t.trim()).filter(Boolean).length;
    gruppen.push({ server: m[1].replace(/\s*\([^)]*\)\s*/g, '').trim(), n });
  }
  if (gruppen.length > 0) {
    const summe = gruppen.reduce((s, g) => s + g.n, 0);
    const label = a.event_type === 'image_updates'
      ? `${summe} Container mit veraltetem Image`
      : `${summe} Meldungen auf ${gruppen.length} Server${gruppen.length > 1 ? 'n' : ''}`;
    return { label, detail: gruppen.map(g => `${g.server} ${g.n}`).join(' · '), full };
  }
  const einzeilig = full.replace(/\n+/g, ' · ');
  return { label: einzeilig || a.event_type || 'Alarm', detail: cleanAuditValue(a.channel_name), full };
}

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
  const { data: audit } = useQuery<any[]>({ queryKey: ['audit-widget'], queryFn: () => api.getAuditLog(25) as Promise<any[]>, refetchInterval: 60000 });

  const raw: Ev[] = [];
  for (const a of alerts ?? []) {
    const ts = new Date((a.sent_at || '') + 'Z').getTime();
    const f = formatAlert(a);
    raw.push({ ts, label: f.label, detail: f.detail, full: f.full, ...alertMeta(), count: 1 });
  }
  for (const e of audit ?? []) {
    const ts = new Date((e.created_at || '') + 'Z').getTime();
    const f = formatAudit(e.action, e.target, e.details);
    raw.push({ ts, label: f.label, detail: f.detail, Icon: f.Icon, tint: f.tint, count: 1 });
  }

  // Aufeinanderfolgende identische Ereignisse bündeln (z. B. mehrere Anmeldungen).
  const sorted = raw.filter(e => !isNaN(e.ts)).sort((a, b) => b.ts - a.ts);
  const merged: Ev[] = [];
  for (const e of sorted) {
    const prev = merged[merged.length - 1];
    if (prev && prev.label === e.label && prev.detail === e.detail) {
      prev.count++;
    } else {
      merged.push({ ...e });
    }
  }
  const events = merged.slice(0, 8);

  return (
    <GlassCard delay={0.35} className="h-full">
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <History className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <span className="text-xs font-medium text-white/60">Ereignisse</span>
        </div>
        {events.length === 0 ? (
          <p className="text-sm text-white/25 text-center py-6">Noch keine Ereignisse</p>
        ) : (
          <div className="space-y-0.5">
            {events.map((e, i) => {
              const Icon = e.Icon;
              return (
                <div key={i} title={e.full} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-white/[0.02] transition">
                  <div className="w-6 h-6 rounded-md bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                    <Icon className={`w-3.5 h-3.5 ${e.tint}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/75 truncate">
                      {e.label}
                      {e.count > 1 && <span className="ml-1.5 text-[10px] text-white/40">×{e.count}</span>}
                    </p>
                    {e.detail && <p className="text-[10px] text-white/30 truncate">{e.detail}</p>}
                  </div>
                  <span className="text-[10px] text-white/25 tabular-nums flex-shrink-0">{rel(e.ts)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
