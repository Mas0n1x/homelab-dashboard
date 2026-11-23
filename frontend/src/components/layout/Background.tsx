/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

/**
 * Ruhiger Hintergrund: ein feines Raster, zwei weiche Lichtflecken in der
 * Akzentfarbe und eine Vignette. Vorher kamen Scanlines, Punktraster, zwei
 * weitere Lichtflecken und zwölf dauerhaft animierte Partikel dazu — das
 * konkurrierte mit den Messwerten, statt sie zu tragen.
 */
export function Background() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#050510]" aria-hidden="true">
      {/* Raster */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(99, 102, 241, 0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99, 102, 241, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />

      {/* Lichtfleck oben links.
          Mobil deutlich kleiner und schwächer weichgezeichnet: die Fläche eines
          Weichzeichners wächst quadratisch, ein 700er mit blur(140px) ist auf
          dem Handy der teuerste Einzelposten der ganzen Seite. */}
      <div
        className="absolute top-[-20%] left-[-10%] w-[360px] h-[360px] blur-[70px] md:w-[700px] md:h-[700px] md:blur-[140px] rounded-full animate-glow-pulse"
        style={{ background: 'rgba(var(--accent-rgb), calc(0.07 * var(--orb-opacity)))' }}
      />

      {/* Lichtfleck unten rechts */}
      <div
        className="absolute bottom-[-15%] right-[-5%] w-[300px] h-[300px] blur-[60px] md:w-[550px] md:h-[550px] md:blur-[120px] rounded-full animate-glow-pulse"
        style={{ background: 'rgba(var(--accent-rgb), calc(0.05 * var(--orb-opacity)))', animationDelay: '2s' }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(5,5,16,0.5) 100%)' }}
      />
    </div>
  );
}
