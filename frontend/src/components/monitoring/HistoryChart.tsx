/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useId } from 'react';

export interface ChartSeries { label: string; color: string; data: number[]; }

// Leichtgewichtiger Mehrlinien-SVG-Chart (kein Framework) für Metrik-Verläufe.
export function HistoryChart({ series, height = 150, max, gridPercent = false }: { series: ChartSeries[]; height?: number; max?: number; gridPercent?: boolean }) {
  const id = useId().replace(/:/g, '');
  const width = 300;
  const pad = 4;
  const h = height - pad * 2;

  const all = series.flatMap(s => s.data);
  if (all.length < 2) {
    return <div style={{ height }} className="flex items-center justify-center text-xs text-white/25">Sammle Daten…</div>;
  }
  const hi = max ?? Math.max(...all, 1);
  const yOf = (v: number) => pad + h - (Math.max(0, Math.min(hi, v)) / hi) * h;
  const xOf = (i: number, len: number) => (len <= 1 ? 0 : (i / (len - 1)) * width);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
      <defs>
        {series.map((s, i) => (
          <linearGradient key={i} id={`hc-${id}-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={s.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      {(gridPercent ? [0.25, 0.5, 0.75] : [0.5]).map(f => (
        <line key={f} x1={0} x2={width} y1={pad + h * (1 - f)} y2={pad + h * (1 - f)} stroke="rgba(255,255,255,0.05)" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
      ))}
      {series.map((s, si) => {
        const line = s.data.map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i, s.data.length).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');
        const area = `${line} L${width},${height} L0,${height} Z`;
        return (
          <g key={si}>
            <path d={area} fill={`url(#hc-${id}-${si})`} />
            <path d={line} fill="none" stroke={s.color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </g>
        );
      })}
    </svg>
  );
}
