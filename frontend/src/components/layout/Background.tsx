'use client';

export function Background() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#050510]">
      {/* Animated gradient orbs - uses CSS vars from ThemeCustomizer */}
      <div
        className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full blur-[120px] animate-glow-pulse"
        style={{ background: 'rgba(var(--accent-rgb), calc(0.08 * var(--orb-opacity)))' }}
      />
      <div
        className="absolute bottom-[-15%] right-[-5%] w-[500px] h-[500px] rounded-full blur-[100px] animate-glow-pulse"
        style={{ background: 'rgba(var(--accent-rgb), calc(0.06 * var(--orb-opacity)))', animationDelay: '2s' }}
      />
      <div
        className="absolute top-[30%] right-[15%] w-[400px] h-[400px] rounded-full blur-[80px] animate-glow-pulse"
        style={{ background: 'rgba(var(--accent-rgb), calc(0.04 * var(--orb-opacity)))', animationDelay: '4s' }}
      />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
        }}
      />
    </div>
  );
}
