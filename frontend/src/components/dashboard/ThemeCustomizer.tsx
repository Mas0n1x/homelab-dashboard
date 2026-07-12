/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState, useEffect } from 'react';
import { Palette, X, RotateCcw } from 'lucide-react';
import { ThemeSettings, ACCENT_PRESETS, DEFAULT_THEME, getStoredTheme, applyTheme, saveTheme, resetTheme } from '@/lib/theme';

export function ThemeCustomizer() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_THEME);

  useEffect(() => {
    const onStorage = () => { const s = getStoredTheme(); setSettings(s); applyTheme(s); };
    onStorage();
    window.addEventListener('storage', onStorage);
    window.addEventListener('theme-changed', onStorage);
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('theme-changed', onStorage); };
  }, []);

  const update = (partial: Partial<ThemeSettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    applyTheme(next);
    saveTheme(next);
    window.dispatchEvent(new Event('theme-changed'));
  };

  const reset = () => {
    setSettings(DEFAULT_THEME);
    applyTheme(DEFAULT_THEME);
    resetTheme();
    window.dispatchEvent(new Event('theme-changed'));
  };

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-20 md:bottom-4 right-4 z-50 p-2.5 rounded-xl glass-card glass-card-hover shadow-lg"
        title="Theme anpassen"
      >
        <Palette className="w-4 h-4 text-white/50" />
      </button>

      {open && (
        <div className="fixed bottom-32 md:bottom-16 right-4 z-50 w-64 glass-card p-4 space-y-4">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Theme</span>
              <div className="flex gap-1">
                <button onClick={reset} className="p-1 rounded hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-colors" title="Zurücksetzen">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Accent Color */}
            <div className="space-y-2">
              <span className="text-[10px] text-white/40 uppercase tracking-wider">Akzentfarbe</span>
              <div className="grid grid-cols-4 gap-2">
                {ACCENT_PRESETS.map(preset => (
                  <button
                    key={preset.name}
                    onClick={() => update({ accentColor: preset.color })}
                    className={`flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all ${
                      settings.accentColor === preset.color ? 'bg-white/[0.08] ring-1 ring-white/20' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full ${preset.bg}`} />
                    <span className="text-[8px] text-white/40">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Orbs Toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/40 uppercase tracking-wider">Hintergrund-Orbs</span>
                <button
                  onClick={() => update({ orbsEnabled: !settings.orbsEnabled })}
                  className={`w-8 h-4 rounded-full transition-all ${settings.orbsEnabled ? 'bg-accent/50' : 'bg-white/10'}`}
                >
                  <div className={`w-3 h-3 rounded-full bg-white transition-all ${settings.orbsEnabled ? 'ml-[18px]' : 'ml-0.5'}`} />
                </button>
              </div>
              {settings.orbsEnabled && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-white/30">Intensität</span>
                    <span className="text-[9px] text-white/30 font-mono">{settings.orbIntensity}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={settings.orbIntensity}
                    onChange={e => update({ orbIntensity: Number(e.target.value) })}
                    className="w-full h-1 rounded-full appearance-none bg-white/10 accent-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* Blur Strength */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/40 uppercase tracking-wider">Glass-Blur</span>
                <span className="text-[9px] text-white/30 font-mono">{settings.blurStrength}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="32"
                value={settings.blurStrength}
                onChange={e => update({ blurStrength: Number(e.target.value) })}
                className="w-full h-1 rounded-full appearance-none bg-white/10 accent-indigo-500"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
