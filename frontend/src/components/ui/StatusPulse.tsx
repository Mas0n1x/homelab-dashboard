'use client';

import { clsx } from 'clsx';

type StatusLevel = 'healthy' | 'warning' | 'critical' | 'offline';

interface StatusPulseProps {
  status: StatusLevel;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const STATUS_STYLES: Record<StatusLevel, { bg: string; pulse: string; shadow: string }> = {
  healthy: {
    bg: 'bg-emerald-400',
    pulse: 'animate-[pulse-healthy_2s_ease-in-out_infinite]',
    shadow: 'shadow-[0_0_6px_rgba(16,185,129,0.5)]',
  },
  warning: {
    bg: 'bg-amber-400',
    pulse: 'animate-[pulse-warning_1.5s_ease-in-out_infinite]',
    shadow: 'shadow-[0_0_6px_rgba(245,158,11,0.5)]',
  },
  critical: {
    bg: 'bg-red-400',
    pulse: 'animate-[pulse-critical_1s_ease-in-out_infinite]',
    shadow: 'shadow-[0_0_6px_rgba(239,68,68,0.5)]',
  },
  offline: {
    bg: 'bg-white/20',
    pulse: '',
    shadow: '',
  },
};

const SIZE_MAP = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
};

export function StatusPulse({ status, size = 'md', className }: StatusPulseProps) {
  const styles = STATUS_STYLES[status];

  return (
    <span
      className={clsx(
        'rounded-full inline-block flex-shrink-0',
        SIZE_MAP[size],
        styles.bg,
        styles.pulse,
        styles.shadow,
        className
      )}
    />
  );
}
