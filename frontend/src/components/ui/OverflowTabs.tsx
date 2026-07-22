/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { ChevronDown, type LucideIcon } from 'lucide-react';

export interface OverflowTab {
  id: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
  overflow?: boolean; // true → landet im "Mehr"-Menü statt in der Hauptleiste
}

interface Props {
  tabs: OverflowTab[];
  activeTab: string;
  onChange: (id: string) => void;
}

function Count({ value, active }: { value?: number; active: boolean }) {
  if (value === undefined) return null;
  return (
    <span className={clsx('ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full tabular-nums',
      active ? 'bg-accent/20 text-accent-light' : 'bg-white/[0.06] text-white/40')}>
      {value}
    </span>
  );
}

export function OverflowTabs({ tabs, activeTab, onChange }: Props) {
  const main = tabs.filter(t => !t.overflow);
  const more = tabs.filter(t => t.overflow);
  const activeMore = more.find(t => t.id === activeTab);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="flex gap-1 p-1 rounded-xl bg-white/[0.02] border border-white/[0.05] backdrop-blur-sm">
      {/* Nur die Haupt-Tabs scrollen — sonst würde overflow-x-auto das „Mehr"-Dropdown abschneiden. */}
      <div className="flex gap-1 overflow-x-auto min-w-0 flex-1">
        {main.map(tab => {
          const active = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={clsx('relative px-3.5 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex-shrink-0 whitespace-nowrap flex items-center gap-1.5',
                active ? 'text-white' : 'text-white/50 hover:text-white/80')}
            >
              {active && <motion.div layoutId="overflow-tab-indicator" className="absolute inset-0 bg-white/[0.08] rounded-lg shadow-sm" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
              <span className="relative z-10 flex items-center">
                {Icon && <Icon className="w-4 h-4 mr-1.5 opacity-70" />}
                {tab.label}
                <Count value={tab.count} active={active} />
              </span>
            </button>
          );
        })}
      </div>

      {more.length > 0 && (
        <div ref={ref} className="relative flex-shrink-0">
          <button
            onClick={() => setOpen(o => !o)}
            className={clsx('relative px-3.5 py-2 rounded-lg text-sm font-medium transition-colors duration-200 whitespace-nowrap flex items-center gap-1.5',
              activeMore ? 'text-white bg-white/[0.08]' : 'text-white/50 hover:text-white/80')}
          >
            {activeMore ? (
              <span className="flex items-center">
                {activeMore.icon && <activeMore.icon className="w-4 h-4 mr-1.5 opacity-70" />}
                {activeMore.label}
              </span>
            ) : 'Mehr'}
            <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
          </button>

          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 top-full mt-2 z-30 min-w-[190px] p-1.5 rounded-xl bg-[#0d1017]/95 border border-white/[0.08] backdrop-blur-xl shadow-2xl shadow-black/40"
            >
              {more.map(tab => {
                const active = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => { onChange(tab.id); setOpen(false); }}
                    className={clsx('w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors text-left',
                      active ? 'bg-white/[0.08] text-white' : 'text-white/60 hover:bg-white/[0.04] hover:text-white/90')}
                  >
                    {Icon && <Icon className="w-4 h-4 opacity-70 flex-shrink-0" />}
                    <span className="flex-1">{tab.label}</span>
                    <Count value={tab.count} active={active} />
                  </button>
                );
              })}
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
