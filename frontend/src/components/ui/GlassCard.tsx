/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: 'indigo' | 'emerald' | 'red' | 'cyan' | 'amber' | 'purple';
  padding?: boolean;
  delay?: number;
  elevated?: boolean;
  accentBorder?: string;
  mouseTracking?: boolean;
}

const glowShadows = {
  indigo: 'hover:shadow-glow-indigo',
  emerald: 'hover:shadow-glow-emerald',
  red: 'hover:shadow-glow-red',
  cyan: 'hover:shadow-glow-cyan',
  amber: 'hover:shadow-glow-amber',
  purple: 'hover:shadow-glow-purple',
};

export function GlassCard({
  children,
  className,
  hover = false,
  glow,
  padding = true,
  delay = 0,
  elevated = false,
  accentBorder,
  mouseTracking = true,
}: GlassCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!mouseTracking || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    cardRef.current.style.setProperty('--mouse-x', `${x}%`);
    cardRef.current.style.setProperty('--mouse-y', `${y}%`);
  }, [mouseTracking]);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.45,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      onMouseMove={handleMouseMove}
      className={clsx(
        elevated ? 'glass-card-elevated' : 'glass-card',
        hover && 'glass-card-hover cursor-pointer',
        mouseTracking && 'glass-card-interactive',
        glow && glowShadows[glow],
        padding && 'p-4 sm:p-5',
        className
      )}
    >
      {accentBorder && (
        <div
          className="absolute top-0 left-4 right-4 h-[2px] rounded-full opacity-60 z-20"
          style={{
            background: `linear-gradient(90deg, transparent, ${accentBorder}, transparent)`,
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
