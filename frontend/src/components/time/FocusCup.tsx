/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Play, Pause, CheckCircle2, Folder } from 'lucide-react';
import type { Task } from '@/lib/types';
import { formatDuration, formatHours } from '@/hooks/useTimer';

interface FocusCupProps {
  /** Aufgaben der Spalte „In Arbeit". */
  tasks: Task[];
  /** Sekunden der laufenden Uhr — nur wenn sie auf einer dieser Aufgaben läuft. */
  runningSeconds: number;
  onStart: (task: Task) => void;
  onPause: () => void;
  /** Uhr aus und Aufgabe als erledigt markieren. */
  onStop: (task: Task) => void;
  busy?: boolean;
}

/**
 * Die große Kaffeetasse aus dem ProductivityTracker-Fokusmodus: sie leert sich
 * entlang der Zeitschätzung der Aufgabe, die gerade in Arbeit ist. Start hält
 * die Uhr an bzw. wieder in Gang, Stop schließt die Aufgabe ab.
 *
 * Reines SVG plus CSS-Dampf — keine JS-Animation, läuft auch am Handy flüssig.
 */
export function FocusCup({ tasks, runningSeconds, onStart, onPause, onStop, busy = false }: FocusCupProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const runningTask = tasks.find(t => t.timer_running) ?? null;

  // Läuft eine Uhr, gewinnt diese Aufgabe. Sonst die manuell gewählte, sonst
  // die oberste der Spalte.
  const active =
    runningTask ??
    tasks.find(t => t.id === selectedId) ??
    tasks[0] ??
    null;

  // Manuelle Wahl verwerfen, sobald die Aufgabe die Spalte verlässt.
  useEffect(() => {
    if (selectedId && !tasks.some(t => t.id === selectedId)) setSelectedId(null);
  }, [tasks, selectedId]);

  if (!active) return null;

  const laeuft = !!active.timer_running;
  const soll = active.estimate_minutes ? active.estimate_minutes * 60 : null;
  const erfasst = (active.tracked_seconds ?? 0) + (laeuft ? runningSeconds : 0);
  const uebrig = soll !== null ? soll - erfasst : null;
  const ueberzogen = uebrig !== null && uebrig < 0;

  // Tassenfüllung: voll bei Start, leer wenn die Schätzung aufgebraucht ist.
  const anteil = soll ? Math.max(0, Math.min(1, 1 - erfasst / soll)) : 1;

  // Innenraum der Tasse (viewBox 120). Füllstand baut sich von unten auf.
  const innenOben = 30;
  const innenUnten = 96;
  const fuellHoehe = (innenUnten - innenOben) * anteil;
  const fuellY = innenUnten - fuellHoehe;
  const kaffeeFarbe = anteil > 0.5 ? '#a9642e' : anteil > 0.2 ? '#b8783f' : '#c99760';

  const grosseZeit = soll !== null
    ? (ueberzogen ? `+${formatDuration(-uebrig!)}` : formatDuration(uebrig!))
    : formatDuration(erfasst);

  return (
    <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0" />
        <h2 className="text-sm font-semibold">In Arbeit</h2>
        {laeuft && (
          <span className="flex items-center gap-1.5 text-[11px] text-accent-light">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-light animate-pulse" />
            Uhr läuft
          </span>
        )}
      </div>

      {/* Umschalter — nur wenn mehr als eine Aufgabe in Arbeit ist */}
      {tasks.length > 1 && (
        <div className="flex gap-1.5 mb-4 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {tasks.map(t => {
            const on = t.id === active.id;
            return (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={clsx(
                  'flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[12px] transition-colors max-w-[14rem]',
                  on
                    ? 'bg-cyan-500/15 border-cyan-400/35 text-cyan-100'
                    : 'bg-white/[0.02] border-white/[0.06] text-white/40 hover:text-white/70 hover:border-white/[0.12]',
                )}
              >
                {t.timer_running && <span className="w-1.5 h-1.5 rounded-full bg-accent-light animate-pulse flex-shrink-0" />}
                <span className="truncate">{t.title}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
        {/* Tasse */}
        <div className="flex-shrink-0 text-accent-light/80">
          <svg width="132" height="132" viewBox="0 0 120 120" fill="none" aria-hidden>
            <defs>
              <clipPath id="focus-cup-inner">
                <path d="M28 28 L92 28 L84 96 Q84 100 79 100 L41 100 Q36 100 36 96 Z" />
              </clipPath>
            </defs>

            {laeuft && (
              <g
                className="coffee-steam"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.35"
              >
                <path d="M46 22 C46 14 51 14 51 6" />
                <path d="M60 20 C60 12 65 12 65 4" style={{ animationDelay: '0.6s' }} />
                <path d="M74 22 C74 14 79 14 79 6" style={{ animationDelay: '1.2s' }} />
              </g>
            )}

            {/* Kaffee */}
            <g clipPath="url(#focus-cup-inner)">
              <rect
                x="24"
                y={fuellY}
                width="72"
                height={fuellHoehe + 4}
                fill={kaffeeFarbe}
                opacity="0.85"
                style={{ transition: 'y 0.7s cubic-bezier(0.4,0,0.2,1), height 0.7s cubic-bezier(0.4,0,0.2,1)' }}
              />
              {anteil > 0.02 && (
                <rect
                  x="24"
                  y={fuellY}
                  width="72"
                  height="3"
                  fill="#e0b183"
                  opacity="0.7"
                  style={{ transition: 'y 0.7s cubic-bezier(0.4,0,0.2,1)' }}
                />
              )}
            </g>

            {/* Tasse */}
            <path
              d="M28 28 L92 28 L84 96 Q84 100 79 100 L41 100 Q36 100 36 96 Z"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinejoin="round"
              fill="none"
            />
            {/* Henkel */}
            <path
              d="M92 38 Q108 38 108 54 Q108 70 82 70"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
            {/* Untertasse */}
            <path d="M26 108 L94 108" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
          </svg>
        </div>

        {/* Aufgabe, Zeit, Knöpfe */}
        <div className="min-w-0 flex-1 w-full text-center sm:text-left">
          <p className="text-[15px] font-medium truncate">{active.title}</p>
          <div className="flex items-center justify-center sm:justify-start gap-3 mt-1 text-[11px] text-white/40">
            {active.project && (
              <span className="flex items-center gap-1 truncate">
                <Folder className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{active.project}</span>
              </span>
            )}
            <span>
              {soll !== null
                ? `${formatHours(erfasst)} von ${formatHours(soll)}`
                : `${formatHours(erfasst)} erfasst · keine Schätzung`}
            </span>
          </div>

          <div
            className={clsx(
              'text-4xl font-semibold tabular-nums leading-none mt-3',
              ueberzogen ? 'text-red-300' : 'text-accent-light',
            )}
          >
            {grosseZeit}
          </div>
          <p className="text-[10px] uppercase tracking-widest text-white/25 mt-1.5">
            {soll === null ? 'erfasste Zeit' : ueberzogen ? 'über der Schätzung' : 'verbleibend'}
          </p>

          <div className="flex items-center justify-center sm:justify-start gap-2 mt-4">
            {laeuft ? (
              <button
                onClick={onPause}
                disabled={busy}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.06] border border-white/12 text-sm text-white/80 hover:bg-white/[0.1] disabled:opacity-40 transition-colors"
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>
            ) : (
              <button
                onClick={() => onStart(active)}
                disabled={busy}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent/15 border border-accent/30 text-sm text-accent-light hover:bg-accent/25 disabled:opacity-40 transition-colors"
              >
                <Play className="w-4 h-4" />
                Start
              </button>
            )}
            <button
              onClick={() => onStop(active)}
              disabled={busy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/12 border border-emerald-400/25 text-sm text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40 transition-colors"
              title="Uhr stoppen und Aufgabe abschließen"
            >
              <CheckCircle2 className="w-4 h-4" />
              Stop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
