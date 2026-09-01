/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Euro, Trash2, Building2 } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { formatMoney } from '@/hooks/useTimer';
import * as api from '@/lib/api';
import type { BillingProfile, BillingRate } from '@/lib/types';

const RUNDUNGEN = [
  { value: 0, label: 'sekundengenau' },
  { value: 5, label: '5 Minuten' },
  { value: 15, label: '15 Minuten' },
  { value: 30, label: '30 Minuten' },
  { value: 60, label: '60 Minuten' },
];

export function BillingRates() {
  const queryClient = useQueryClient();

  const { data: rates = [] } = useQuery<BillingRate[]>({ queryKey: ['billing-rates'], queryFn: api.getBillingRates });
  const { data: taskData } = useQuery({ queryKey: ['tasks'], queryFn: api.getTasks, staleTime: 30000 });
  const { data: profile } = useQuery<BillingProfile>({ queryKey: ['billing-profile'], queryFn: api.getBillingProfile });

  // Alle Projekte anzeigen, auch die ohne Satz — sonst übersieht man genau die,
  // bei denen später 0 € in der Abrechnung stehen.
  const projekte = useMemo(() => {
    const ausAufgaben = taskData?.projects ?? [];
    const ausSaetzen = rates.map(r => r.project);
    return Array.from(new Set([...ausAufgaben, ...ausSaetzen])).filter(Boolean).sort((a, b) => a.localeCompare(b, 'de'));
  }, [taskData, rates]);

  const speichern = useMutation({
    mutationFn: ({ project, data }: { project: string; data: Partial<BillingRate> }) => api.setBillingRate(project, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-rates'] });
      queryClient.invalidateQueries({ queryKey: ['time-summary'] });
    },
  });

  const entfernen = useMutation({
    mutationFn: api.deleteBillingRate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing-rates'] });
      queryClient.invalidateQueries({ queryKey: ['time-summary'] });
    },
  });

  return (
    <div className="space-y-4">
      <GlassCard>
        <h3 className="text-xs uppercase tracking-widest text-white/25 font-medium mb-3">Stundensätze je Projekt</h3>
        {projekte.length === 0 ? (
          <p className="text-sm text-white/30 py-6 text-center">
            Noch keine Projekte. Leg eine Aufgabe mit Projekt an, dann taucht es hier auf.
          </p>
        ) : (
          <div className="space-y-2">
            {projekte.map(p => (
              <RateZeile
                key={p}
                project={p}
                rate={rates.find(r => r.project === p) ?? null}
                onSpeichern={(data) => speichern.mutate({ project: p, data })}
                onEntfernen={() => entfernen.mutate(p)}
              />
            ))}
          </div>
        )}
      </GlassCard>

      {profile && <ProfilFormular profile={profile} />}
    </div>
  );
}

function RateZeile({ project, rate, onSpeichern, onEntfernen }: {
  project: string;
  rate: BillingRate | null;
  onSpeichern: (data: Partial<BillingRate>) => void;
  onEntfernen: () => void;
}) {
  const [kunde, setKunde] = useState(rate?.customer ?? '');
  const [satz, setSatz] = useState(String(rate?.hourlyRate ?? ''));
  const [rundung, setRundung] = useState(rate?.roundingMinutes ?? 0);

  const geaendert =
    kunde !== (rate?.customer ?? '') ||
    Number(satz || 0) !== (rate?.hourlyRate ?? 0) ||
    rundung !== (rate?.roundingMinutes ?? 0);

  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] p-3">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[13px] font-medium truncate flex-1">{project}</span>
        {rate && rate.hourlyRate > 0 && (
          <span className="text-[11px] text-emerald-300/70 tabular-nums flex-shrink-0">
            {formatMoney(rate.hourlyRate, rate.currency)}/Std.
          </span>
        )}
        {rate && (
          <button
            onClick={() => { if (confirm(`Stundensatz für „${project}" entfernen?`)) onEntfernen(); }}
            className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
            title="Satz entfernen"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <label className="block sm:col-span-2">
          <span className="block text-[10px] uppercase tracking-widest text-white/25 mb-1">Kunde</span>
          <input className="glass-input py-2 w-full" value={kunde} onChange={e => setKunde(e.target.value)} placeholder="z. B. Mert" />
        </label>
        <label className="block">
          <span className="block text-[10px] uppercase tracking-widest text-white/25 mb-1">Satz (€/Std.)</span>
          <input
            type="number"
            min={0}
            step="0.5"
            className="glass-input py-2 w-full"
            value={satz}
            onChange={e => setSatz(e.target.value)}
            placeholder="0"
          />
        </label>
        <label className="block">
          <span className="block text-[10px] uppercase tracking-widest text-white/25 mb-1">Rundung</span>
          <select className="glass-input py-2 w-full" value={rundung} onChange={e => setRundung(Number(e.target.value))}>
            {RUNDUNGEN.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
      </div>

      {geaendert && (
        <button
          onClick={() => onSpeichern({ customer: kunde, hourlyRate: Number(satz || 0), roundingMinutes: rundung, currency: 'EUR' })}
          className="btn-primary mt-2.5 px-3 py-1.5 text-[13px] flex items-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5" /> Speichern
        </button>
      )}
    </div>
  );
}

function ProfilFormular({ profile }: { profile: BillingProfile }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(profile);

  const speichern = useMutation({
    mutationFn: () => api.setBillingProfile(form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['billing-profile'] }),
  });

  const setzen = <K extends keyof BillingProfile>(key: K, value: BillingProfile[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="w-3.5 h-3.5 text-white/40" />
        <h3 className="text-xs uppercase tracking-widest text-white/25 font-medium">Rechnungssteller</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block">
          <span className="block text-[10px] uppercase tracking-widest text-white/25 mb-1">Name</span>
          <input className="glass-input py-2 w-full" value={form.issuerName} onChange={e => setzen('issuerName', e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-[10px] uppercase tracking-widest text-white/25 mb-1">E-Mail</span>
          <input className="glass-input py-2 w-full" value={form.issuerEmail} onChange={e => setzen('issuerEmail', e.target.value)} />
        </label>
        <label className="block sm:col-span-2">
          <span className="block text-[10px] uppercase tracking-widest text-white/25 mb-1">Anschrift</span>
          <textarea
            className="glass-input py-2 w-full min-h-[64px] resize-y"
            value={form.issuerAddress}
            onChange={e => setzen('issuerAddress', e.target.value)}
          />
        </label>
        <label className="block">
          <span className="block text-[10px] uppercase tracking-widest text-white/25 mb-1">Steuernummer / USt-IdNr.</span>
          <input className="glass-input py-2 w-full" value={form.taxId} onChange={e => setzen('taxId', e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-[10px] uppercase tracking-widest text-white/25 mb-1">Zahlungsziel (Tage)</span>
          <input
            type="number"
            min={0}
            className="glass-input py-2 w-full"
            value={form.paymentTermsDays}
            onChange={e => setzen('paymentTermsDays', Number(e.target.value))}
          />
        </label>
        <label className="block">
          <span className="block text-[10px] uppercase tracking-widest text-white/25 mb-1">Nummernkreis</span>
          <input className="glass-input py-2 w-full" value={form.invoicePrefix} onChange={e => setzen('invoicePrefix', e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-[10px] uppercase tracking-widest text-white/25 mb-1">Nächste Nummer</span>
          <input
            type="number"
            min={1}
            className="glass-input py-2 w-full"
            value={form.nextInvoiceNumber}
            onChange={e => setzen('nextInvoiceNumber', Number(e.target.value))}
          />
        </label>
      </div>

      {/* Umsatzsteuer: bei Kleinunternehmerregelung wird keine ausgewiesen —
          der Satz wäre dann irreführend, also blendet er sich aus. */}
      <div className="mt-3 flex flex-col sm:flex-row sm:items-end gap-2">
        <label className="flex items-center gap-2.5 py-2 cursor-pointer flex-1">
          <input
            type="checkbox"
            className="w-4 h-4 accent-[rgb(var(--accent-rgb))]"
            checked={form.smallBusiness}
            onChange={e => setzen('smallBusiness', e.target.checked)}
          />
          <span className="text-[13px]">Kleinunternehmerregelung (§ 19 UStG) — keine Umsatzsteuer ausweisen</span>
        </label>
        {!form.smallBusiness && (
          <label className="block sm:w-40 flex-shrink-0">
            <span className="block text-[10px] uppercase tracking-widest text-white/25 mb-1">Steuersatz (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              className="glass-input py-2 w-full"
              value={form.vatRate}
              onChange={e => setzen('vatRate', Number(e.target.value))}
            />
          </label>
        )}
      </div>

      <button
        onClick={() => speichern.mutate()}
        disabled={speichern.isPending}
        className="btn-primary mt-3 px-4 py-2 text-[13px] flex items-center gap-1.5 disabled:opacity-40"
      >
        <Euro className="w-3.5 h-3.5" />
        {speichern.isPending ? 'Speichert …' : 'Rechnungsdaten speichern'}
      </button>
    </GlassCard>
  );
}
