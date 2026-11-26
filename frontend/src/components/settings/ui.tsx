/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

// Einheitlicher Sektions-Kopf: Icon-Kachel + Titel + Beschreibung + optionale Aktion rechts.
export function SectionHeader({ icon: Icon, tint, title, desc, action }: { icon: LucideIcon; tint: string; title: string; desc?: string; action?: React.ReactNode }) {
  return (
    /* Mobil steht die Aktion unter der Überschrift — nebeneinander brach der
       Knopf zweizeilig um und drängte den Titel zusammen. */
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3 mb-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center border flex-shrink-0', tint)}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold leading-tight">{title}</h2>
          {desc && <p className="text-xs text-white/50 mt-0.5">{desc}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0 [&>button]:w-full sm:[&>button]:w-auto [&>button]:justify-center">{action}</div>}
    </div>
  );
}

// Einheitliche Einstellungs-Zeile: Label + Beschreibung links, Steuerung rechts.
export function SettingRow({ title, desc, children, last }: { title: string; desc?: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={clsx('flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5', !last && 'border-b border-white/[0.05]')}>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {desc && <p className="text-xs text-white/50 mt-0.5">{desc}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

export function Toggle({ on, onClick, disabled }: { on?: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx('w-11 h-6 rounded-full transition-colors relative flex-shrink-0 disabled:opacity-40', on ? 'bg-emerald-500/30' : 'bg-white/10')}
    >
      <div className={clsx('w-5 h-5 rounded-full absolute top-0.5 transition-all', on ? 'bg-emerald-400 left-[22px]' : 'bg-white/40 left-0.5')} />
    </button>
  );
}
