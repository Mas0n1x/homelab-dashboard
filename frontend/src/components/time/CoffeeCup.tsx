/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { clsx } from 'clsx';

interface CoffeeCupProps {
  /** 0 = leer, 1 = voll. Ohne Schätzung bleibt die Tasse voll. */
  fill: number;
  /** Dampf nur bei laufender Uhr — steht sie, kühlt der Kaffee ab. */
  steaming?: boolean;
  size?: number;
  className?: string;
}

/**
 * Die Kaffeetasse aus dem ProductivityTracker: sie leert sich, während die
 * geschätzte Zeit verrinnt. Reines SVG plus CSS, keine Bibliothek und keine
 * JavaScript-Animation — läuft damit auch auf dem Handy ohne Ruckeln.
 */
export function CoffeeCup({ fill, steaming = false, size = 40, className }: CoffeeCupProps) {
  const anteil = Math.max(0, Math.min(1, fill));

  // Innenraum der Tasse in Nutzerkoordinaten. Der Füllstand wird von unten
  // aufgebaut, damit die Oberfläche des Kaffees sichtbar wandert.
  const innenOben = 15;
  const innenUnten = 40;
  const hoehe = (innenUnten - innenOben) * anteil;
  const y = innenUnten - hoehe;

  // Farbe wandert mit: voll = kräftiger Kaffee, fast leer = blass.
  const farbe = anteil > 0.5 ? '#a9642e' : anteil > 0.2 ? '#b8783f' : '#c99760';

  return (
    <span className={clsx('inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
        <defs>
          <clipPath id="cup-inner">
            {/* Leicht konisch — sonst sieht der Kaffee wie ein Rechteck aus. */}
            <path d="M12 14 L36 14 L33 40 Q33 42 31 42 L17 42 Q15 42 15 40 Z" />
          </clipPath>
        </defs>

        {/* Dampf */}
        {steaming && (
          <g className="coffee-steam" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.35">
            <path d="M19 10 C19 7 21 7 21 4" />
            <path d="M24 9 C24 6 26 6 26 3" style={{ animationDelay: '0.6s' }} />
            <path d="M29 10 C29 7 31 7 31 4" style={{ animationDelay: '1.2s' }} />
          </g>
        )}

        {/* Kaffee */}
        <g clipPath="url(#cup-inner)">
          <rect x="10" y={y} width="28" height={hoehe + 2} fill={farbe} opacity="0.85" />
          {/* Oberfläche als hellere Kante — gibt der Flüssigkeit Tiefe. */}
          {anteil > 0.02 && <rect x="10" y={y} width="28" height="1.5" fill="#e0b183" opacity="0.7" />}
        </g>

        {/* Tasse */}
        <path
          d="M12 14 L36 14 L33 40 Q33 42 31 42 L17 42 Q15 42 15 40 Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Henkel */}
        <path
          d="M36 18 Q42 18 42 24 Q42 30 35 30"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
        {/* Untertasse */}
        <path d="M11 45 L37 45" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
      </svg>
    </span>
  );
}
