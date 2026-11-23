/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useEffect } from 'react';

/** Meldet den Service Worker an (Voraussetzung für „Zum Startbildschirm" und Push). */
export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;
    navigator.serviceWorker.register('/sw.js').catch(() => { /* Push ist optional */ });
  }, []);
  return null;
}
