/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Square, Folder } from 'lucide-react';
import { useTimer, useElapsed, formatDuration } from '@/hooks/useTimer';
import { CoffeeCup } from './CoffeeCup';

/**
 * Schwebende Anzeige der laufenden Uhr — auf jeder Seite sichtbar.
 *
 * Ohne sie ist der häufigste Fehler bei Zeiterfassung garantiert: Uhr gestartet,
 * weitergeklickt, abends steht eine Achtstundenbuchung auf einer Aufgabe von
 * zwanzig Minuten. Sie sitzt über der mobilen Bottom-Bar, nicht darauf.
 */
export function TimerBar() {
  const { running, elapsed } = useElapsed();
  const { stop, isBusy } = useTimer();

  return (
    <AnimatePresence>
      {running && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          className="fixed z-30 left-3 right-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:left-auto md:right-5 md:bottom-5 md:w-[340px]"
        >
          <div className="relative rounded-2xl border border-accent/25 bg-[#0c0c1c]/95 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden">
            {/* Akzentkante — hebt die Leiste vom Seiteninhalt ab */}
            <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent-light" />

            <div className="flex items-center gap-3 px-3 py-2.5 pl-4">
              <CoffeeCup fill={1} steaming size={34} className="text-accent-light/70 flex-shrink-0" />

              <Link href="/tasks" className="min-w-0 flex-1 group">
                <p className="text-[13px] font-medium truncate group-hover:text-accent-light transition-colors">
                  {running.description || running.taskTitle || 'Zeiterfassung läuft'}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-lg font-semibold tabular-nums leading-none text-accent-light">
                    {formatDuration(elapsed)}
                  </span>
                  {running.project && (
                    <span className="flex items-center gap-1 text-[10px] text-white/35 truncate">
                      <Folder className="w-2.5 h-2.5 flex-shrink-0" />
                      <span className="truncate">{running.project}</span>
                    </span>
                  )}
                </div>
              </Link>

              <button
                onClick={() => stop()}
                disabled={isBusy}
                className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-500/15 border border-red-400/30 text-red-300 flex items-center justify-center hover:bg-red-500/25 disabled:opacity-40 transition-colors"
                title="Uhr stoppen"
                aria-label="Uhr stoppen"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
