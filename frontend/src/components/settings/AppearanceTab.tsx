/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState, useEffect } from 'react';
import { Palette, RotateCcw } from 'lucide-react';
import { ThemeSettings, ACCENT_PRESETS, DEFAULT_THEME, getStoredTheme, applyTheme, saveTheme, resetTheme } from '@/lib/theme';
import { clsx } from 'clsx';
import { GlassCard } from '@/components/ui/GlassCard';
import { SectionHeader, SettingRow, Toggle } from './ui';

export function AppearanceTab() {
  // Darstellung / Theme
  const [theme, setThemeState] = useState<ThemeSettings>(DEFAULT_THEME);
  useEffect(() => { setThemeState(getStoredTheme()); }, []);
  const updateTheme = (partial: Partial<ThemeSettings>) => {
    const next = { ...theme, ...partial };
    setThemeState(next);
    applyTheme(next);
    saveTheme(next);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('theme-changed'));
  };
  const resetThemeAll = () => {
    setThemeState(DEFAULT_THEME);
    applyTheme(DEFAULT_THEME);
    resetTheme();
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('theme-changed'));
  };

  return (
      <GlassCard>
        <div className="relative z-10">
          <SectionHeader
            icon={Palette}
            tint="bg-purple-500/10 border-purple-500/20 text-purple-400"
            title="Darstellung"
            desc="Akzentfarbe und visuelle Effekte des Dashboards"
            action={
              <button onClick={resetThemeAll} className="btn-glass text-xs flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" /> Zurücksetzen
              </button>
            }
          />
          <div className="mb-5">
            <p className="text-xs text-white/55 mb-2">Akzentfarbe</p>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {ACCENT_PRESETS.map(p => (
                <button key={p.name} onClick={() => updateTheme({ accentColor: p.color })} className={clsx('flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all border', theme.accentColor === p.color ? 'border-white/20 bg-white/[0.06]' : 'border-transparent hover:bg-white/[0.03]')}>
                  <span className={clsx('w-6 h-6 rounded-full', p.bg)} style={{ boxShadow: theme.accentColor === p.color ? `0 0 10px ${p.color}80` : 'none' }} />
                  <span className="text-[10px] text-white/55">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
          <SettingRow title="Hintergrund-Orbs" desc="Animierte Farbverläufe im Hintergrund">
            <Toggle on={theme.orbsEnabled} onClick={() => updateTheme({ orbsEnabled: !theme.orbsEnabled })} />
          </SettingRow>
          {theme.orbsEnabled && (
            <SettingRow title="Orb-Intensität" desc={`${theme.orbIntensity}%`}>
              <input type="range" min={10} max={100} value={theme.orbIntensity} onChange={e => updateTheme({ orbIntensity: Number(e.target.value) })} className="w-40 accent-[var(--accent-color)]" />
            </SettingRow>
          )}
          <SettingRow title="Glass-Blur" desc={`${theme.blurStrength}px Weichzeichnung`} last>
            <input type="range" min={0} max={32} value={theme.blurStrength} onChange={e => updateTheme({ blurStrength: Number(e.target.value) })} className="w-40 accent-[var(--accent-color)]" />
          </SettingRow>
        </div>
      </GlassCard>
  );
}
