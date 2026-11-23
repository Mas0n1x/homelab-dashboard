/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertOctagon, AlertTriangle, Info, ChevronRight, ChevronDown, Bell } from 'lucide-react';
import { useAttention } from '@/hooks/useAttention';
import type { AttentionItem, AttentionSeverity } from '@/lib/types';

const SCHWERE: Record<AttentionSeverity, { dot: string; text: string; icon: React.ReactNode }> = {
  critical: { dot: 'bg-red-400', text: 'text-red-400', icon: <AlertOctagon className="w-4 h-4" /> },
  warning: { dot: 'bg-amber-400', text: 'text-amber-400', icon: <AlertTriangle className="w-4 h-4" /> },
  info: { dot: 'bg-sky-400', text: 'text-sky-300', icon: <Info className="w-4 h-4" /> },
};

const MAX_SICHTBAR = 3;

function Zeile({ item }: { item: AttentionItem }) {
  const s = SCHWERE[item.severity];
  return (
    <Link
      href={item.href}
      className="group flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.05] focus-visible:bg-white/[0.06] transition-colors"
    >
      <span className={clsx('flex-shrink-0', s.text)}>{s.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium truncate">{item.title}</p>
        <p className="text-[12px] text-white/55 truncate">{item.detail}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-white/35 group-hover:text-white/70 flex-shrink-0 transition-colors" />
    </Link>
  );
}

/**
 * Die Antwort auf „läuft alles?" — ganz oben auf der Startseite.
 *
 * Läuft alles, ist das eine schmale grüne Zeile. Sonst steht hier gebündelt,
 * was nicht stimmt (Ausfälle, Alarme, Dienste, Backup, Platten-Prognose,
 * RAM-Trend, Ablaufdaten) — mit Sprung zur jeweiligen Stelle.
 */
export function AttentionCenter() {
  const { data, isLoading, isError } = useAttention();
  const [alle, setAlle] = useState(false);

  if (isLoading) {
    return <div className="glass-card-elevated h-[54px] animate-pulse" aria-hidden="true" />;
  }
  if (isError || !data) {
    return (
      <div className="glass-card-elevated px-4 py-3 flex items-center gap-3 text-[13px] text-white/60">
        <Info className="w-4 h-4" /> Aufmerksamkeits-Übersicht gerade nicht verfügbar.
      </div>
    );
  }

  const probleme = data.items.filter(i => i.severity !== 'info');
  const hinweise = data.items.filter(i => i.severity === 'info');
  const ok = probleme.length === 0;
  const zeilen = alle ? data.items : probleme.slice(0, MAX_SICHTBAR);
  const versteckt = probleme.length - Math.min(probleme.length, MAX_SICHTBAR);
  const farbe = data.status === 'critical' ? 'red' : data.status === 'warning' ? 'amber' : 'emerald';

  return (
    <motion.section
      aria-label="Aufmerksamkeit"
      aria-live="polite"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={clsx(
        'glass-card-elevated overflow-hidden border',
        farbe === 'red' && 'border-red-500/30 shadow-[0_0_28px_-8px_rgba(239,68,68,0.4)]',
        farbe === 'amber' && 'border-amber-500/30',
        farbe === 'emerald' && 'border-emerald-500/20',
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
          farbe === 'red' && 'bg-red-500/15 text-red-400', farbe === 'amber' && 'bg-amber-500/15 text-amber-400', farbe === 'emerald' && 'bg-emerald-500/12 text-emerald-400')}>
          {ok ? <CheckCircle2 className="w-5 h-5" /> : data.status === 'critical' ? <AlertOctagon className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">
            {ok ? 'Alles in Ordnung' : probleme.length === 1 ? '1 Sache braucht Aufmerksamkeit' : `${probleme.length} Dinge brauchen Aufmerksamkeit`}
          </h2>
          <p className="text-[12px] text-white/55 truncate">
            {ok
              ? (hinweise.length ? `${hinweise.length} ${hinweise.length === 1 ? 'Hinweis' : 'Hinweise'}, nichts Dringendes` : 'Keine Alarme, alle Server und Dienste antworten')
              : [data.counts.critical ? `${data.counts.critical} kritisch` : null, data.counts.warning ? `${data.counts.warning} Warnung${data.counts.warning > 1 ? 'en' : ''}` : null, hinweise.length ? `${hinweise.length} Hinweis${hinweise.length > 1 ? 'e' : ''}` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        {hinweise.length > 0 && ok && (
          <button
            onClick={() => setAlle(v => !v)}
            aria-expanded={alle}
            className="flex items-center gap-1 text-[12px] text-white/60 hover:text-white/85 px-2 py-1 rounded-lg hover:bg-white/[0.05] transition-colors"
          >
            Hinweise <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform', alle && 'rotate-180')} />
          </button>
        )}
        <Link href="/alerts" className="flex items-center gap-1.5 text-[12px] text-white/60 hover:text-white/85 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] transition-colors flex-shrink-0">
          <Bell className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Alarme</span>
        </Link>
      </div>

      <AnimatePresence initial={false}>
        {(!ok || alle) && zeilen.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2 border-t border-white/[0.05] pt-1.5">
              {zeilen.map(item => <Zeile key={item.id} item={item} />)}
              {!ok && !alle && (versteckt > 0 || hinweise.length > 0) && (
                <button
                  onClick={() => setAlle(true)}
                  className="w-full text-center text-[12px] text-white/55 hover:text-white/85 py-2 rounded-lg hover:bg-white/[0.04] transition-colors"
                >
                  {versteckt > 0 ? `${versteckt} weitere` : ''}{versteckt > 0 && hinweise.length > 0 ? ' und ' : ''}{hinweise.length > 0 ? `${hinweise.length} ${hinweise.length === 1 ? 'Hinweis' : 'Hinweise'}` : ''} anzeigen
                </button>
              )}
              {alle && !ok && (
                <button onClick={() => setAlle(false)} className="w-full text-center text-[12px] text-white/55 hover:text-white/85 py-2 rounded-lg hover:bg-white/[0.04] transition-colors">
                  Weniger anzeigen
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
