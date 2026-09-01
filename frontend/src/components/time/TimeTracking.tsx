/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Clock, Euro, FileText, Receipt, TrendingUp } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { formatHours, formatMoney } from '@/hooks/useTimer';
import * as api from '@/lib/api';
import { TimeEntryList } from './TimeEntryList';
import { BillingRates } from './BillingRates';
import { InvoiceBuilder } from './InvoiceBuilder';
import type { TimeSummary } from '@/lib/types';

type Zeitraum = 'woche' | 'monat' | 'quartal' | 'jahr';

const ZEITRAEUME: { id: Zeitraum; label: string }[] = [
  { id: 'woche', label: 'Diese Woche' },
  { id: 'monat', label: 'Dieser Monat' },
  { id: 'quartal', label: 'Quartal' },
  { id: 'jahr', label: 'Jahr' },
];

/** Beginn des Zeitraums. Die Woche startet montags — deutsche Zählweise. */
export function zeitraumStart(z: Zeitraum): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (z === 'woche') {
    const tag = (d.getDay() + 6) % 7; // Montag = 0
    d.setDate(d.getDate() - tag);
  } else if (z === 'monat') {
    d.setDate(1);
  } else if (z === 'quartal') {
    d.setMonth(Math.floor(d.getMonth() / 3) * 3, 1);
  } else {
    d.setMonth(0, 1);
  }
  return d;
}

const UNTERBEREICHE = [
  { id: 'uebersicht', label: 'Übersicht', icon: TrendingUp },
  { id: 'eintraege', label: 'Einträge', icon: Clock },
  { id: 'saetze', label: 'Stundensätze', icon: Euro },
  { id: 'rechnung', label: 'Rechnung', icon: Receipt },
] as const;

type Unterbereich = typeof UNTERBEREICHE[number]['id'];

export function TimeTracking() {
  const [zeitraum, setZeitraum] = useState<Zeitraum>('monat');
  const [bereich, setBereich] = useState<Unterbereich>('uebersicht');

  const { von, bis } = useMemo(() => ({
    von: zeitraumStart(zeitraum).toISOString(),
    bis: new Date().toISOString(),
  }), [zeitraum]);

  const { data: summary, isLoading } = useQuery<TimeSummary>({
    queryKey: ['time-summary', von, bis],
    queryFn: () => api.getTimeSummary(von, bis),
    staleTime: 15000,
  });

  const offenerBetrag = useMemo(() => {
    if (!summary) return 0;
    return summary.projects.reduce((sum, p) => sum + (p.uninvoicedSeconds / 3600) * p.hourlyRate, 0);
  }, [summary]);

  const ohneSatz = summary?.projects.filter(p => p.hourlyRate === 0 && p.seconds > 0) ?? [];

  return (
    <div className="space-y-4">
      {/* Zeitraum + Unterbereich */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {UNTERBEREICHE.map(b => {
            const Icon = b.icon;
            const aktiv = bereich === b.id;
            return (
              <button
                key={b.id}
                onClick={() => setBereich(b.id)}
                className={clsx(
                  'flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[13px] transition-colors',
                  aktiv
                    ? 'bg-white/[0.08] border-white/[0.14] text-white'
                    : 'bg-white/[0.02] border-white/[0.06] text-white/45 hover:text-white/75',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {b.label}
              </button>
            );
          })}
        </div>

        {bereich !== 'rechnung' && (
          <select
            className="glass-input py-2 sm:w-40 flex-shrink-0"
            value={zeitraum}
            onChange={e => setZeitraum(e.target.value as Zeitraum)}
          >
            {ZEITRAEUME.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
          </select>
        )}
      </div>

      {bereich === 'uebersicht' && (
        <>
          {/* Kennzahlen */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 [&>*]:h-full">
            <Kennzahl
              label="Erfasst"
              wert={summary ? formatHours(summary.totalSeconds) : '–'}
              hinweis={ZEITRAEUME.find(z => z.id === zeitraum)?.label ?? ''}
              icon={<Clock className="w-3.5 h-3.5 text-cyan-400" />}
              tonung="bg-cyan-500/10"
            />
            <Kennzahl
              label="Abrechenbar"
              wert={summary ? formatMoney(summary.totalAmount) : '–'}
              hinweis="nach Stundensatz"
              icon={<Euro className="w-3.5 h-3.5 text-emerald-400" />}
              tonung="bg-emerald-500/10"
            />
            <Kennzahl
              label="Noch offen"
              wert={formatMoney(offenerBetrag)}
              hinweis="nicht in Rechnung"
              icon={<Receipt className="w-3.5 h-3.5 text-amber-400" />}
              tonung="bg-amber-500/10"
            />
            <Kennzahl
              label="Projekte"
              wert={String(summary?.projects.length ?? 0)}
              hinweis={`${summary?.projects.reduce((s, p) => s + p.entries, 0) ?? 0} Einträge`}
              icon={<FileText className="w-3.5 h-3.5 text-violet-400" />}
              tonung="bg-violet-500/10"
            />
          </div>

          {/* Ohne Stundensatz erfasste Zeit ist unsichtbares Geld — deshalb ein
              deutlicher Hinweis statt einer stillen 0 € in der Summe. */}
          {ohneSatz.length > 0 && (
            <div className="flex items-start gap-3 p-3.5 rounded-2xl border border-amber-400/20 bg-amber-500/[0.06]">
              <Euro className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[13px] text-amber-200 font-medium">
                  {ohneSatz.length} {ohneSatz.length === 1 ? 'Projekt hat' : 'Projekte haben'} keinen Stundensatz
                </p>
                <p className="text-[11px] text-amber-200/60 mt-0.5">
                  {ohneSatz.map(p => p.project || 'ohne Projekt').join(', ')} — die Zeit zählt, taucht aber mit 0 € in der Abrechnung auf.
                </p>
              </div>
              <button
                onClick={() => setBereich('saetze')}
                className="ml-auto flex-shrink-0 text-[11px] px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-400/25 text-amber-200 hover:bg-amber-500/25 transition-colors"
              >
                Setzen
              </button>
            </div>
          )}

          {/* Tagesverlauf */}
          {summary && summary.days.length > 0 && <Tagesverlauf days={summary.days} />}

          {/* Je Projekt */}
          <GlassCard>
            <h3 className="text-xs uppercase tracking-widest text-white/25 font-medium mb-3">Nach Projekt</h3>
            {isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map(i => <div key={i} className="h-12 rounded-xl bg-white/[0.03] animate-pulse" />)}
              </div>
            ) : (summary?.projects.length ?? 0) === 0 ? (
              <p className="text-sm text-white/30 py-6 text-center">
                In diesem Zeitraum wurde noch keine Zeit erfasst.
              </p>
            ) : (
              <div className="space-y-1.5">
                {summary!.projects.map(p => {
                  const anteil = summary!.totalSeconds > 0 ? (p.seconds / summary!.totalSeconds) * 100 : 0;
                  return (
                    <div key={p.project || '__ohne'} className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[13px] font-medium truncate">{p.project || 'Ohne Projekt'}</span>
                        {p.customer && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-white/45 truncate max-w-[9rem]">
                            {p.customer}
                          </span>
                        )}
                        <span className="ml-auto text-[13px] tabular-nums flex-shrink-0">
                          {formatHours(p.seconds)}
                        </span>
                        <span className="text-[13px] tabular-nums text-emerald-300 flex-shrink-0 w-20 text-right">
                          {formatMoney(p.amount, p.currency)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-accent/60 to-accent-light transition-all duration-500"
                          style={{ width: `${anteil}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-white/30">
                        <span>{p.entries} Einträge</span>
                        <span>{p.hourlyRate > 0 ? `${formatMoney(p.hourlyRate, p.currency)}/Std.` : 'kein Satz'}</span>
                        {p.roundingMinutes > 0 && <span>gerundet auf {p.roundingMinutes} Min.</span>}
                        {p.uninvoicedSeconds > 0 && (
                          <span className="text-amber-300/70">{formatHours(p.uninvoicedSeconds)} offen</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </>
      )}

      {bereich === 'eintraege' && <TimeEntryList von={von} bis={bis} />}
      {bereich === 'saetze' && <BillingRates />}
      {bereich === 'rechnung' && <InvoiceBuilder />}
    </div>
  );
}

function Kennzahl({ label, wert, hinweis, icon, tonung }: {
  label: string; wert: string; hinweis: string; icon: React.ReactNode; tonung: string;
}) {
  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-2">
        <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', tonung)}>
          {icon}
        </div>
        <span className="text-xs font-medium text-white/60 truncate">{label}</span>
      </div>
      <p className="text-xl font-semibold tabular-nums leading-none">{wert}</p>
      <p className="text-[10px] text-white/30 mt-1.5 truncate">{hinweis}</p>
    </GlassCard>
  );
}

/** Balken je Tag. Ohne Diagrammbibliothek — reicht für einen Verlauf völlig. */
function Tagesverlauf({ days }: { days: { date: string; seconds: number }[] }) {
  const max = Math.max(...days.map(d => d.seconds), 1);

  return (
    <GlassCard>
      <h3 className="text-xs uppercase tracking-widest text-white/25 font-medium mb-3">Verlauf</h3>
      <div className="flex items-end gap-[3px] h-24 overflow-x-auto scrollbar-hide">
        {days.map(d => {
          const hoehe = Math.max(4, (d.seconds / max) * 100);
          const datum = new Date(d.date);
          return (
            <div
              key={d.date}
              className="flex-1 min-w-[8px] flex flex-col justify-end h-full group relative"
              title={`${datum.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}: ${formatHours(d.seconds)}`}
            >
              <div
                className="w-full rounded-t-sm bg-gradient-to-t from-accent/40 to-accent-light/80 transition-all group-hover:from-accent/60"
                style={{ height: `${hoehe}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-white/25 mt-2">
        <span>{new Date(days[0].date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</span>
        <span>{new Date(days[days.length - 1].date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}</span>
      </div>
    </GlassCard>
  );
}
