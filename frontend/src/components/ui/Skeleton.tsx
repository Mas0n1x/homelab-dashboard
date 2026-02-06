'use client';

import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={clsx(
        'animate-pulse rounded-lg',
        'bg-gradient-to-r from-white/[0.03] via-white/[0.06] to-white/[0.03]',
        'bg-[length:200%_100%]',
        className
      )}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="glass-card p-5 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-2 w-full" />
    </div>
  );
}
