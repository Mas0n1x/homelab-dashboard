'use client';

import { clsx } from 'clsx';

interface StatusBadgeProps {
  status: string;
  label?: string;
  size?: 'sm' | 'md';
  pulse?: boolean;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  running: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  online: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  connected: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  exited: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
  offline: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
  stopped: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
  paused: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' },
  warning: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' },
  restarting: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400' },
};

export function StatusBadge({ status, label, size = 'sm', pulse = true }: StatusBadgeProps) {
  const style = STATUS_STYLES[status.toLowerCase()] || STATUS_STYLES.offline;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border',
        style.bg,
        style.text,
        `border-current/20`,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      )}
    >
      <span className="relative flex h-2 w-2">
        {pulse && (status === 'running' || status === 'online' || status === 'connected') && (
          <span className={clsx('absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping', style.dot)} />
        )}
        <span className={clsx('relative inline-flex rounded-full h-2 w-2', style.dot)} />
      </span>
      {label || status}
    </span>
  );
}
