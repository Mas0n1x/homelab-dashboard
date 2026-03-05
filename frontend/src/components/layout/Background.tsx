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

      {/* Primary orb */}
      <div
        className="absolute top-[-20%] left-[-10%] w-[700px] h-[700px] rounded-full blur-[140px] animate-glow-pulse"
        style={{ background: 'rgba(var(--accent-rgb), calc(0.07 * var(--orb-opacity)))' }}
      />

      {/* Secondary orb */}
      <div
        className="absolute bottom-[-15%] right-[-5%] w-[550px] h-[550px] rounded-full blur-[120px] animate-glow-pulse"
        style={{ background: 'rgba(var(--accent-rgb), calc(0.05 * var(--orb-opacity)))', animationDelay: '2s' }}
      />

      {/* Tertiary orb - complementary purple */}
      <div
        className="absolute top-[30%] right-[15%] w-[400px] h-[400px] rounded-full blur-[100px] animate-glow-pulse"
        style={{ background: 'rgba(139, 92, 246, calc(0.04 * var(--orb-opacity)))', animationDelay: '4s' }}
      />

      {/* Fourth orb - cyan, floating */}
      <div
        className="absolute top-[60%] left-[20%] w-[350px] h-[350px] rounded-full blur-[90px] animate-float hidden sm:block"
        style={{ background: 'rgba(6, 182, 212, calc(0.03 * var(--orb-opacity)))', animationDuration: '8s' }}
      />

      {/* Dot grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(5,5,16,0.4) 100%)',
        }}
      />
    </div>
  );
}
