/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

export function Background() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#050510]">
      {/* Noise texture */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '256px 256px',
        }}
      />

      {/* HUD Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(99, 102, 241, 0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99, 102, 241, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />

      {/* Subtle scan line effect — mobil aus (eine Vollbild-Ebene weniger) */}
      <div
        className="absolute inset-0 opacity-[0.012] pointer-events-none hidden md:block"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)',
          backgroundSize: '100% 4px',
        }}
      />

      {/* Lichtfleck oben links.
          Mobil deutlich kleiner und schwächer weichgezeichnet: die Fläche eines
          Weichzeichners wächst quadratisch, ein 700er mit blur(140px) ist auf
          dem Handy der teuerste Einzelposten der ganzen Seite. Der Farbeindruck
          bleibt, weil beides nur als Schimmer im Hintergrund wirkt. */}
      <div
        className="absolute top-[-20%] left-[-10%] w-[360px] h-[360px] blur-[70px] md:w-[700px] md:h-[700px] md:blur-[140px] rounded-full animate-glow-pulse"
        style={{ background: 'rgba(var(--accent-rgb), calc(0.07 * var(--orb-opacity)))' }}
      />

      {/* Lichtfleck unten rechts */}
      <div
        className="absolute bottom-[-15%] right-[-5%] w-[300px] h-[300px] blur-[60px] md:w-[550px] md:h-[550px] md:blur-[120px] rounded-full animate-glow-pulse"
        style={{ background: 'rgba(var(--accent-rgb), calc(0.05 * var(--orb-opacity)))', animationDelay: '2s' }}
      />

      {/* Tertiary orb - complementary purple (mobil aus) */}
      <div
        className="absolute top-[30%] right-[15%] w-[400px] h-[400px] rounded-full blur-[100px] animate-glow-pulse hidden md:block"
        style={{ background: 'rgba(139, 92, 246, calc(0.04 * var(--orb-opacity)))', animationDelay: '4s' }}
      />

      {/* Cyan orb - floating */}
      <div
        className="absolute top-[60%] left-[20%] w-[350px] h-[350px] rounded-full blur-[90px] animate-float hidden sm:block"
        style={{ background: 'rgba(6, 182, 212, calc(0.03 * var(--orb-opacity)))', animationDuration: '8s' }}
      />

      {/* Dot grid - classic mission control */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Floating particles (pure CSS) — 12 dauerhaft animierte Punkte, mobil aus */}
      <div className="absolute inset-0 overflow-hidden hidden md:block">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/[0.03]"
            style={{
              width: `${2 + (i % 3)}px`,
              height: `${2 + (i % 3)}px`,
              left: `${(i * 8.3) % 100}%`,
              top: `${(i * 13.7 + 20) % 100}%`,
              animation: `particle-float ${12 + (i % 5) * 3}s ease-in-out infinite`,
              animationDelay: `${i * 1.5}s`,
            }}
          />
        ))}
      </div>

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(5,5,16,0.5) 100%)',
        }}
      />
    </div>
  );
}
