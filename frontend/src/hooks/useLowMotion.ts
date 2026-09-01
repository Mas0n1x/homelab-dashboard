/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useEffect, useState } from 'react';

/**
 * Wahr auf schmalen Bildschirmen und wenn reduzierte Bewegung eingestellt ist.
 *
 * Hintergrund: jede Glas-Karte ist eine eigene Framer-Motion-Komponente mit
 * Einblend-Animation. Auf einer vollen Seite sind das zwanzig und mehr
 * gleichzeitig laufende JavaScript-Animationen — genau der Ruckler beim Öffnen
 * einer Seite auf dem Handy. Auf dem Rechner bleibt alles wie gehabt.
 *
 * Startwert ist `false`, damit Server- und erstes Client-Rendern
 * übereinstimmen; direkt danach greift die Messung.
 */
export function useLowMotion() {
  const [low, setLow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px), (prefers-reduced-motion: reduce)');
    const apply = () => setLow(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return low;
}
