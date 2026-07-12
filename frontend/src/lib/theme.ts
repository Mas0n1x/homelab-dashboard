/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */

export interface ThemeSettings {
  accentColor: string;
  orbsEnabled: boolean;
  orbIntensity: number;
  blurStrength: number;
}

export const ACCENT_PRESETS = [
  { name: 'Indigo', color: '#6366f1', bg: 'bg-indigo-500' },
  { name: 'Emerald', color: '#10b981', bg: 'bg-emerald-500' },
  { name: 'Cyan', color: '#06b6d4', bg: 'bg-cyan-500' },
  { name: 'Purple', color: '#8b5cf6', bg: 'bg-purple-500' },
  { name: 'Pink', color: '#ec4899', bg: 'bg-pink-500' },
  { name: 'Amber', color: '#f59e0b', bg: 'bg-amber-500' },
  { name: 'Red', color: '#ef4444', bg: 'bg-red-500' },
  { name: 'Blue', color: '#3b82f6', bg: 'bg-blue-500' },
];

export const DEFAULT_THEME: ThemeSettings = {
  accentColor: '#6366f1',
  orbsEnabled: true,
  orbIntensity: 50,
  blurStrength: 16,
};

export function getStoredTheme(): ThemeSettings {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const stored = localStorage.getItem('dashboard-theme');
    return stored ? { ...DEFAULT_THEME, ...JSON.parse(stored) } : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(settings: ThemeSettings) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--accent-color', settings.accentColor);
  root.style.setProperty('--orb-opacity', settings.orbsEnabled ? String(settings.orbIntensity / 100) : '0');
  root.style.setProperty('--glass-blur', `${settings.blurStrength}px`);

  const hex = settings.accentColor;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  root.style.setProperty('--accent-light', `rgb(${Math.min(r + 30, 255)}, ${Math.min(g + 30, 255)}, ${Math.min(b + 30, 255)})`);
  root.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
}

export function saveTheme(settings: ThemeSettings) {
  try { localStorage.setItem('dashboard-theme', JSON.stringify(settings)); } catch { /* ignore */ }
}

export function resetTheme() {
  try { localStorage.removeItem('dashboard-theme'); } catch { /* ignore */ }
}
