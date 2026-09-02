/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { CalendarDays, Mail, Timer, Euro, AlertTriangle, ArrowRight } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { CoffeeCup } from '@/components/time/CoffeeCup';
import { useElapsed, formatDuration, formatHours, formatMoney } from '@/hooks/useTimer';
import { useMailUnread } from '@/hooks/useMailUnread';
import { isOverdue, isDueToday } from '@/components/tasks/taskUtils';
import * as api from '@/lib/api';
import type { TimeSummary } from '@/lib/types';

/** Tagesbeginn als ISO — Grundlage für „heute erfasst". */
function heuteStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Der Tagesblock ganz oben auf dem Control Center.
 *
 * Beantwortet die vier Fragen, die man beim Öffnen wirklich hat: Was ist heute
 * fällig? Läuft eine Uhr? Wie viel habe ich heute geschafft? Liegt Post da?
 * Die Flotten-Kacheln darunter beantworten „läuft alles" — das ist nur dann
 * interessant, wenn etwas kaputt ist.
 */
export function TodayWidget() {
  const { running, elapsed } = useElapsed();
  const { total: unread } = useMailUnread();

  const { data: taskData } = useQuery({
    queryKey: ['tasks'],
    queryFn: api.getTasks,
    staleTime: 30000,
  });

  const von = useMemo(heuteStart, []);
  const { data: heute } = useQuery<TimeSummary>({
    queryKey: ['time-summary', von, 'heute'],
    queryFn: () => api.getTimeSummary(von, new Date().toISOString()),
    staleTime: 60000,
  });

  const { data: offen } = useQuery<TimeSummary>({
    queryKey: ['time-summary', 'offen'],
    // 90 Tage zurück reichen, um alles Unabgerechnete einzufangen.
    queryFn: () => api.getTimeSummary(
      new Date(Date.now() - 90 * 86400000).toISOString(),
      new Date().toISOString(),
    ),
    staleTime: 300000,
  });

  const tasks = taskData?.tasks ?? [];
  const ueberfaellig = tasks.filter(t => t.status !== 'done' && isOverdue(t));
  const heuteFaellig = tasks.filter(t => t.status !== 'done' && isDueToday(t));
  const inArbeit = tasks.filter(t => t.status === 'doing');

  const offenerBetrag = (offen?.projects ?? []).reduce(
    (s, p) => s + (p.uninvoicedSeconds / 3600) * p.hourlyRate, 0,
  );

  // Heute erfasste Zeit inklusive der laufenden Uhr — die ist im Bericht noch
  // nicht festgeschrieben.
  const heuteSekunden = (heute?.totalSeconds ?? 0) + (running ? elapsed : 0);

  const begruessung = (() => {
    const h = new Date().getHours();
    if (h < 5) return 'Noch wach';
    if (h < 11) return 'Guten Morgen';
    if (h < 18) return 'Guten Tag';
    return 'Guten Abend';
  })();

  return (
    <GlassCard>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold truncate">{begruessung}, Mas0n1x</h2>
          <p className="text-[11px] text-white/35 mt-0.5">
            {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}
          </p>
        </div>
        {running ? (
          <div className="flex items-center gap-2 flex-shrink-0 px-2.5 py-1.5 rounded-xl bg-accent/12 border border-accent/25">
            <CoffeeCup fill={1} steaming size={22} className="text-accent-light" />
            <span className="text-sm font-semibold tabular-nums text-accent-light">
              {formatDuration(elapsed)}
            </span>
          </div>
        ) : (
          <Link
            href="/tasks"
            className="flex items-center gap-1.5 flex-shrink-0 px-2.5 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[12px] text-white/45 hover:text-white/80 transition-colors"
          >
            <Timer className="w-3.5 h-3.5" />
            Uhr starten
          </Link>
        )}
      </div>

      {/* Überfällig steht bewusst allein und in Rot: das ist der einzige Posten
          hier, der wirklich sofort etwas von einem will. */}
      {ueberfaellig.length > 0 && (
        <Link
          href="/tasks"
          className="flex items-center gap-2.5 p-3 mb-3 rounded-xl border border-red-500/25 bg-red-500/[0.07] hover:bg-red-500/[0.11] transition-colors"
        >
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-[13px] text-red-200 min-w-0 truncate">
            {ueberfaellig.length} {ueberfaellig.length === 1 ? 'Aufgabe ist' : 'Aufgaben sind'} überfällig
            <span className="text-red-200/50"> · {ueberfaellig[0].title}</span>
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-red-300/50 ml-auto flex-shrink-0" />
        </Link>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Kachel
          href="/tasks"
          icon={<CalendarDays className="w-3.5 h-3.5 text-amber-400" />}
          ton="bg-amber-500/10"
          wert={String(heuteFaellig.length)}
          label="heute fällig"
          zusatz={inArbeit.length > 0 ? `${inArbeit.length} in Arbeit` : 'nichts angefangen'}
        />
        <Kachel
          href="/tasks"
          icon={<Timer className="w-3.5 h-3.5 text-cyan-400" />}
          ton="bg-cyan-500/10"
          wert={heuteSekunden > 0 ? formatHours(heuteSekunden) : '0 Min.'}
          label="heute erfasst"
          zusatz={running ? (running.project || 'läuft gerade') : 'Uhr steht'}
          hervorheben={!!running}
        />
        <Kachel
          href="/mail"
          icon={<Mail className="w-3.5 h-3.5 text-violet-400" />}
          ton="bg-violet-500/10"
          wert={String(unread)}
          label="ungelesen"
          zusatz={unread > 0 ? 'wartet auf dich' : 'alles gelesen'}
        />
        <Kachel
          href="/tasks"
          icon={<Euro className="w-3.5 h-3.5 text-emerald-400" />}
          ton="bg-emerald-500/10"
          wert={formatMoney(offenerBetrag)}
          label="nicht abgerechnet"
          zusatz="letzte 90 Tage"
        />
      </div>
    </GlassCard>
  );
}

function Kachel({ href, icon, ton, wert, label, zusatz, hervorheben }: {
  href: string;
  icon: React.ReactNode;
  ton: string;
  wert: string;
  label: string;
  zusatz: string;
  hervorheben?: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        'rounded-xl border p-3 transition-colors block',
        hervorheben
          ? 'bg-accent/[0.07] border-accent/25 hover:bg-accent/[0.11]'
          : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.05]',
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={clsx('w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0', ton)}>
          {icon}
        </div>
        <span className="text-[10px] text-white/40 truncate">{label}</span>
      </div>
      <p className="text-lg font-semibold tabular-nums leading-none truncate">{wert}</p>
      <p className="text-[10px] text-white/25 mt-1 truncate">{zusatz}</p>
    </Link>
  );
}
