/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useEffect } from 'react';
import { getStoredTheme, applyTheme } from '@/lib/theme';

// Wendet das gespeicherte Theme an und reagiert auf Änderungen (aus den Einstellungen).
// Rendert nichts sichtbar — die Theme-Anpassung selbst liegt in den Einstellungen.
export function ThemeApplier() {
  useEffect(() => {
    const apply = () => applyTheme(getStoredTheme());
    apply();
    window.addEventListener('storage', apply);
    window.addEventListener('theme-changed', apply);
    return () => {
      window.removeEventListener('storage', apply);
      window.removeEventListener('theme-changed', apply);
    };
  }, []);
  return null;
}
