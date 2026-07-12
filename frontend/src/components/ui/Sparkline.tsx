/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useId } from 'react';

interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  strokeWidth?: number;
  fill?: boolean;
  /** Feste Skala (z. B. 0..100 fuer Prozent); sonst automatisch. */
  min?: number;
  max?: number;
  className?: string;
}

// Leichtgewichtige SVG-Sparkline (kein Chart-Framework) fuer die Fleet-Karten.
export function Sparkline({ data, color = '#8b5cf6', height = 34, strokeWidth = 1.5, fill = true, min, max, className }: SparklineProps) {
  const id = useId().replace(/:/g, '');
  const width = 100; // via viewBox skaliert, Container gibt Breite vor

  if (!data || data.length < 2) {
    return <div className={className} style={{ height }} />;
  }

  const lo = min ?? Math.min(...data);
  const hi = max ?? Math.max(...data);
  const range = hi - lo || 1;
  const pad = strokeWidth;
  const h = height - pad * 2;

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = pad + h - ((Math.max(lo, Math.min(hi, v)) - lo) / range) * h;
    return [x, y] as const;
  });

  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={className} style={{ width: '100%', height }}>
      <defs>
        <linearGradient id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#grad-${id})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
