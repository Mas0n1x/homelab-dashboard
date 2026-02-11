'use client';

import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: 'indigo' | 'emerald' | 'red' | 'cyan';
  padding?: boolean;
  delay?: number;
}

export function GlassCard({ children, className, hover = false, glow, padding = true, delay = 0 }: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      className={clsx(
        'glass-card',
        hover && 'glass-card-hover cursor-pointer',
        glow === 'indigo' && 'hover:shadow-glow-indigo',
        glow === 'emerald' && 'hover:shadow-glow-emerald',
        glow === 'red' && 'hover:shadow-glow-red',
        glow === 'cyan' && 'hover:shadow-glow-cyan',
        padding && 'p-4 sm:p-5',
        className
      )}
    >
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
