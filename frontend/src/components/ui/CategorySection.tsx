/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import type { ReactNode } from 'react';
import { ChevronDown, Server, Box, Gamepad2, Briefcase, User, Boxes, type LucideIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Infra: Server,
  Minecraft: Box,
  'Game-Server': Gamepad2,
  LawNet: Briefcase,
  'Persönliches': User,
  Sonstiges: Boxes,
};

interface Props {
  name: string;
  /** Kurzer Zusatz rechts neben dem Namen, z. B. "3 Projekte". */
  detail?: string;
  /** Laufende / gesamte Einheiten für die Anzeige rechts. */
  running?: number;
  total?: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

// Aufklappbarer Kategorie-Abschnitt (Infra, Minecraft, Game-Server …): die Kategorien stehen
// untereinander, jede lässt sich einzeln auf- und zuklappen.
export function CategorySection({ name, detail, running, total, open, onToggle, children }: Props) {
  const Icon = CATEGORY_ICONS[name] || Boxes;
  const allUp = running !== undefined && total !== undefined && running === total;
  return (
    <section className="glass-card overflow-hidden">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="relative z-10 w-full flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <ChevronDown className={clsx('w-4 h-4 text-white/40 flex-shrink-0 transition-transform', !open && '-rotate-90')} />
          <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-accent-light" />
          </div>
          <span className="font-semibold truncate">{name}</span>
          {detail && <span className="text-xs text-white/30 hidden sm:inline">{detail}</span>}
        </div>
        {running !== undefined && total !== undefined && (
          <span className={clsx('text-xs tabular-nums flex-shrink-0', allUp ? 'text-emerald-400' : 'text-amber-400')}>
            {running}/{total} laufend
          </span>
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="relative z-10 border-t border-white/[0.05] p-3 sm:p-4 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
