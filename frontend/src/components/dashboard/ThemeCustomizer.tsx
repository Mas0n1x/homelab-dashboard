'use client';

import { useState, useEffect } from 'react';
import { Palette, X, RotateCcw } from 'lucide-react';

interface ThemeSettings {
  accentColor: string;
  orbsEnabled: boolean;
  orbIntensity: number;
  blurStrength: number;
}

const ACCENT_PRESETS = [
  { name: 'Indigo', color: '#6366f1', bg: 'bg-indigo-500' },
  { name: 'Emerald', color: '#10b981', bg: 'bg-emerald-500' },
  { name: 'Cyan', color: '#06b6d4', bg: 'bg-cyan-500' },
  { name: 'Purple', color: '#8b5cf6', bg: 'bg-purple-500' },
  { name: 'Pink', color: '#ec4899', bg: 'bg-pink-500' },
  { name: 'Amber', color: '#f59e0b', bg: 'bg-amber-500' },
  { name: 'Red', color: '#ef4444', bg: 'bg-red-500' },
  { name: 'Blue', color: '#3b82f6', bg: 'bg-blue-500' },
];

const DEFAULT_SETTINGS: ThemeSettings = {
  accentColor: '#6366f1',
  orbsEnabled: true,
  orbIntensity: 50,
  blurStrength: 16,
};

function getStoredTheme(): ThemeSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem('dashboard-theme');
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function applyTheme(settings: ThemeSettings) {
  const root = document.documentElement;
  root.style.setProperty('--accent-color', settings.accentColor);
  root.style.setProperty('--orb-opacity', settings.orbsEnabled ? String(settings.orbIntensity / 100) : '0');
  root.style.setProperty('--glass-blur', `${settings.blurStrength}px`);

  // Compute lighter variant
  const hex = settings.accentColor;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  root.style.setProperty('--accent-light', `rgb(${Math.min(r + 30, 255)}, ${Math.min(g + 30, 255)}, ${Math.min(b + 30, 255)})`);
  root.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
}

export function ThemeCustomizer() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const stored = getStoredTheme();
    setSettings(stored);
    applyTheme(stored);
  }, []);

  const update = (partial: Partial<ThemeSettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    applyTheme(next);
    localStorage.setItem('dashboard-theme', JSON.stringify(next));
  };

  const reset = () => {
    setSettings(DEFAULT_SETTINGS);
    applyTheme(DEFAULT_SETTINGS);
    localStorage.removeItem('dashboard-theme');
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
