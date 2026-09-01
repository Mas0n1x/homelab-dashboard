/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Receipt, Printer, Lock, AlertTriangle, Undo2, Copy, Check } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { formatMoney } from '@/hooks/useTimer';
import * as api from '@/lib/api';
import type { BillingRate, InvoiceDraft } from '@/lib/types';

/** YYYY-MM-DD für die Datumsfelder. */
const asDate = (d: Date) => {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
};

function monatsStart(versatz = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + versatz, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function InvoiceBuilder() {
  const queryClient = useQueryClient();

  const { data: rates = [] } = useQuery<BillingRate[]>({ queryKey: ['billing-rates'], queryFn: api.getBillingRates });
  const { data: taskData } = useQuery({ queryKey: ['tasks'], queryFn: api.getTasks, staleTime: 30000 });

  const projekte = useMemo(() => {
    const alle = Array.from(new Set([...(taskData?.projects ?? []), ...rates.map(r => r.project)])).filter(Boolean);
    return alle.sort((a, b) => a.localeCompare(b, 'de'));
  }, [taskData, rates]);

  const [projekt, setProjekt] = useState('');
  const [von, setVon] = useState(() => asDate(monatsStart(-1)));
  const [bis, setBis] = useState(() => asDate(new Date()));
  const [nurOffene, setNurOffene] = useState(true);
  const [notiz, setNotiz] = useState('');
  const [entwurf, setEntwurf] = useState<InvoiceDraft | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState(false);

  const satz = rates.find(r => r.project === projekt);

  const bauen = useMutation({
    mutationFn: (commit: boolean) => api.buildInvoiceDraft({
      project: projekt,
      // Der Endtag zählt komplett mit — sonst fehlt die Arbeit vom letzten Tag.
      from: new Date(`${von}T00:00:00`).toISOString(),
      to: new Date(`${bis}T23:59:59`).toISOString(),
      onlyUninvoiced: nurOffene,
      note: notiz,
      commit,
    }),
    onSuccess: (draft) => {
      setEntwurf(draft);
      setFehler(null);
      if (draft.committed) {
        queryClient.invalidateQueries({ queryKey: ['time-entries'] });
        queryClient.invalidateQueries({ queryKey: ['time-summary'] });
        queryClient.invalidateQueries({ queryKey: ['billing-profile'] });
      }
    },
    onError: (e: Error) => { setFehler(e.message); setEntwurf(null); },
  });

  const zuruecknehmen = useMutation({
    mutationFn: () => api.revertInvoice(entwurf?.entryIds ?? []),
    onSuccess: () => {
      setEntwurf(e => (e ? { ...e, committed: false } : e));
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['time-summary'] });
    },
  });

  const alsText = () => {
    if (!entwurf) return '';
    const zeilen = entwurf.positions.map(p =>
      `${p.label}\t${p.hours.toFixed(2).replace('.', ',')} h\t${formatMoney(p.hourlyRate)}\t${formatMoney(p.amount)}`
    );
    return [
      `Rechnung ${entwurf.invoiceNumber}`,
      `Zeitraum: ${new Date(entwurf.period.from).toLocaleDateString('de-DE')} – ${new Date(entwurf.period.to).toLocaleDateString('de-DE')}`,
      entwurf.customer ? `Kunde: ${entwurf.customer}` : '',
      '',
      ...zeilen,
      '',
      `Netto: ${formatMoney(entwurf.totals.net)}`,
      entwurf.smallBusiness ? 'Kein Ausweis der Umsatzsteuer (§ 19 UStG)' : `Umsatzsteuer ${entwurf.totals.vatRate} %: ${formatMoney(entwurf.totals.vat)}`,
      `Gesamt: ${formatMoney(entwurf.totals.gross)}`,
    ].filter(Boolean).join('\n');
  };

  return (
    <div className="space-y-4">
      <GlassCard>
        <div className="flex items-center gap-2 mb-3">
          <Receipt className="w-3.5 h-3.5 text-white/40" />
          <h3 className="text-xs uppercase tracking-widest text-white/25 font-medium">Rechnungsentwurf</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label className="block">
            <span className="block text-[10px] uppercase tracking-widest text-white/25 mb-1">Projekt</span>
            <select className="glass-input py-2 w-full" value={projekt} onChange={e => setProjekt(e.target.value)}>
              <option value="">Projekt wählen …</option>
              {projekte.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[10px] uppercase tracking-widest text-white/25 mb-1">Von</span>
            <input type="date" className="glass-input py-2 w-full" value={von} onChange={e => setVon(e.target.value)} />
          </label>
          <label className="block">
            <span className="block text-[10px] uppercase tracking-widest text-white/25 mb-1">Bis</span>
            <input type="date" className="glass-input py-2 w-full" value={bis} onChange={e => setBis(e.target.value)} />
          </label>
        </div>

        <label className="block mt-2">
          <span className="block text-[10px] uppercase tracking-widest text-white/25 mb-1">Hinweis auf der Rechnung</span>
          <input className="glass-input py-2 w-full" value={notiz} onChange={e => setNotiz(e.target.value)} placeholder="optional" />
        </label>

        <label className="flex items-center gap-2.5 mt-3 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 accent-[rgb(var(--accent-rgb))]"
            checked={nurOffene}
            onChange={e => setNurOffene(e.target.checked)}
          />
          <span className="text-[13px] text-white/70">Nur noch nicht abgerechnete Zeiten</span>
        </label>

        {projekt && !satz?.hourlyRate && (
          <div className="flex items-start gap-2.5 mt-3 p-3 rounded-xl border border-amber-400/20 bg-amber-500/[0.06]">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-amber-200/80">
              Für „{projekt}" ist kein Stundensatz hinterlegt — die Rechnung käme auf 0 €.
              Setz ihn unter „Stundensätze".
            </p>
          </div>
        )}

        <button
          onClick={() => bauen.mutate(false)}
          disabled={!projekt || bauen.isPending}
          className="btn-primary mt-3 px-4 py-2 text-[13px] flex items-center gap-1.5 disabled:opacity-30"
        >
          <Receipt className="w-3.5 h-3.5" />
          {bauen.isPending ? 'Erstellt …' : 'Entwurf erstellen'}
        </button>

        {fehler && <p className="text-[12px] text-red-300 mt-2">{fehler}</p>}
      </GlassCard>

      {entwurf && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => window.print()} className="btn-glass px-3 py-2 text-[13px] flex items-center gap-1.5">
              <Printer className="w-3.5 h-3.5" /> Drucken / als PDF sichern
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(alsText()).then(() => {
                  setKopiert(true);
                  setTimeout(() => setKopiert(false), 2000);
                }).catch(() => { /* Zwischenablage nicht verfügbar */ });
              }}
              className="btn-glass px-3 py-2 text-[13px] flex items-center gap-1.5"
            >
              {kopiert ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {kopiert ? 'Kopiert' : 'Als Text kopieren'}
            </button>

            {/* Festschreiben stempelt die Zeiten als abgerechnet und zählt die
                Rechnungsnummer hoch — bis dahin ist alles ein reiner Entwurf. */}
            {!entwurf.committed ? (
              <button
                onClick={() => {
                  if (confirm('Zeiten als abgerechnet markieren und Rechnungsnummer vergeben?')) bauen.mutate(true);
                }}
                className="btn-glass px-3 py-2 text-[13px] flex items-center gap-1.5 text-emerald-300 border-emerald-400/25"
              >
                <Lock className="w-3.5 h-3.5" /> Festschreiben
              </button>
            ) : (
              <button
                onClick={() => { if (confirm('Abrechnungsstempel wieder entfernen?')) zuruecknehmen.mutate(); }}
                className="btn-glass px-3 py-2 text-[13px] flex items-center gap-1.5 text-amber-300 border-amber-400/25"
              >
                <Undo2 className="w-3.5 h-3.5" /> Festschreibung zurücknehmen
              </button>
            )}

            {entwurf.committed && (
              <span className="text-[12px] text-emerald-300/80">Festgeschrieben als {entwurf.invoiceNumber}</span>
            )}
          </div>

          <InvoiceSheet draft={entwurf} />
        </>
      )}
    </div>
  );
}

/**
 * Der Rechnungsbogen. Auf dem Bildschirm im Dashboard-Look, im Druck als
 * schwarz-weißes Blatt — dunkle Kacheln auf Papier wären unlesbar und würden
 * die halbe Tonerkartusche kosten.
 */
function InvoiceSheet({ draft }: { draft: InvoiceDraft }) {
  const datum = (iso: string) => new Date(iso).toLocaleDateString('de-DE');

  return (
    <>
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          #rechnungsbogen, #rechnungsbogen * { visibility: visible !important; }
          #rechnungsbogen {
            position: absolute; left: 0; top: 0; width: 100%;
            background: #fff !important; color: #111 !important;
            border: none !important; box-shadow: none !important; padding: 0 !important;
          }
          #rechnungsbogen * { color: #111 !important; border-color: #ccc !important; background: transparent !important; }
        }
      `}</style>

      <div
        id="rechnungsbogen"
        className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-8 space-y-6"
      >
        {/* Kopf */}
        <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
          <div className="text-[12px] leading-relaxed">
            <p className="font-semibold text-[14px]">{draft.issuer.name}</p>
            <p className="whitespace-pre-line text-white/60">{draft.issuer.address}</p>
            {draft.issuer.email && <p className="text-white/60">{draft.issuer.email}</p>}
            {draft.issuer.taxId && <p className="text-white/60">Steuernr.: {draft.issuer.taxId}</p>}
          </div>
          <div className="text-[12px] sm:text-right space-y-0.5">
            <p className="text-lg font-semibold">Rechnung</p>
            <p className="text-white/60">Nr. {draft.invoiceNumber}</p>
            <p className="text-white/60">Datum: {datum(draft.issuedAt)}</p>
            <p className="text-white/60">Fällig: {datum(draft.dueAt)}</p>
          </div>
        </div>

        <div className="h-px bg-white/[0.08]" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[12px]">
          <div>
            <p className="text-white/35 uppercase tracking-widest text-[10px] mb-1">Kunde</p>
            <p className="font-medium">{draft.customer || '— kein Kunde hinterlegt —'}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-white/35 uppercase tracking-widest text-[10px] mb-1">Leistungszeitraum</p>
            <p>{datum(draft.period.from)} – {datum(draft.period.to)}</p>
            <p className="text-white/50">Projekt: {draft.project}</p>
          </div>
        </div>

        {/* Positionen */}
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] min-w-[420px]">
            <thead>
              <tr className="text-white/35 uppercase tracking-widest text-[10px] border-b border-white/[0.08]">
                <th className="text-left font-medium py-2">Leistung</th>
                <th className="text-right font-medium py-2 w-20">Stunden</th>
                <th className="text-right font-medium py-2 w-24">Satz</th>
                <th className="text-right font-medium py-2 w-24">Betrag</th>
              </tr>
            </thead>
            <tbody>
              {draft.positions.map((p, i) => (
                <tr key={i} className="border-b border-white/[0.05]">
                  <td className="py-2.5 pr-3">
                    <p>{p.label}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">
                      {p.entries} {p.entries === 1 ? 'Abschnitt' : 'Abschnitte'}
                      {p.dates.length > 0 && ` · ${datum(p.dates[0])}${p.dates.length > 1 ? ` – ${datum(p.dates[p.dates.length - 1])}` : ''}`}
                    </p>
                  </td>
                  <td className="text-right tabular-nums py-2.5">{p.hours.toFixed(2).replace('.', ',')}</td>
                  <td className="text-right tabular-nums py-2.5">{formatMoney(p.hourlyRate, draft.currency)}</td>
                  <td className="text-right tabular-nums py-2.5 font-medium">{formatMoney(p.amount, draft.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summen */}
        <div className="flex justify-end">
          <div className="w-full sm:w-72 space-y-1.5 text-[12px]">
            <div className="flex justify-between">
              <span className="text-white/50">Nettobetrag</span>
              <span className="tabular-nums">{formatMoney(draft.totals.net, draft.currency)}</span>
            </div>
            {!draft.smallBusiness && (
              <div className="flex justify-between">
                <span className="text-white/50">Umsatzsteuer {draft.totals.vatRate} %</span>
                <span className="tabular-nums">{formatMoney(draft.totals.vat, draft.currency)}</span>
              </div>
            )}
            <div className={clsx('flex justify-between pt-1.5 border-t border-white/[0.1] text-[14px] font-semibold')}>
              <span>Gesamtbetrag</span>
              <span className="tabular-nums">{formatMoney(draft.totals.gross, draft.currency)}</span>
            </div>
          </div>
        </div>

        {draft.smallBusiness && (
          <p className="text-[11px] text-white/45">
            Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.
          </p>
        )}

        {draft.note && <p className="text-[12px] text-white/60 whitespace-pre-line">{draft.note}</p>}

        <p className="text-[11px] text-white/35">
          Zahlbar ohne Abzug bis {datum(draft.dueAt)}.
        </p>
      </div>
    </>
  );
}
