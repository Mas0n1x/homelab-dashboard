/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { clsx } from 'clsx';

export interface CategoryTab {
  name: string;
  count: number;
  running?: number;
}

interface Props {
  tabs: CategoryTab[];
  active: string;
  onChange: (name: string) => void;
}

// Kategorie-Leiste (Infra, Minecraft, LawNet …): ein Tab je Kategorie statt einer
// langen, untereinander gestapelten Liste. Läuft auf schmalen Schirmen seitlich weiter.
export function CategoryTabs({ tabs, active, onChange }: Props) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" role="tablist">
      {tabs.map(tab => {
        const isActive = tab.name === active;
        return (
          <button
            key={tab.name}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.name)}
            className={clsx(
              'flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm transition-all border',
              isActive
                ? 'bg-accent/15 border-accent/30 text-accent-light'
                : 'bg-white/[0.03] border-white/[0.06] text-white/50 hover:text-white/80 hover:bg-white/[0.06]',
            )}
          >
            <span className="font-medium">{tab.name}</span>
            <span
              className={clsx(
                'text-[11px] px-1.5 py-0.5 rounded-full tabular-nums',
                isActive ? 'bg-accent/20 text-accent-light' : 'bg-white/[0.06] text-white/40',
              )}
            >
              {tab.running !== undefined ? `${tab.running}/${tab.count}` : tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
