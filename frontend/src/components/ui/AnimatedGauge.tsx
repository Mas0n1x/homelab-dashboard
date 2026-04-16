'use client';

import { motion } from 'framer-motion';

interface AnimatedGaugeProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  icon?: React.ReactNode;
  sublabel?: string;
  arcDegrees?: number;
}

export function AnimatedGauge({
  percent,
  size = 100,
  strokeWidth = 6,
  color,
  trackColor = 'rgba(255,255,255,0.04)',
  label,
  icon,
  sublabel,
  arcDegrees = 270,
}: AnimatedGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const arcFraction = arcDegrees / 360;
  const circumference = 2 * Math.PI * radius * arcFraction;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;
  const rotation = 90 + (360 - arcDegrees) / 2; // Center the arc gap at bottom

  const strokeColor = color || getAutoColor(percent);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: `rotate(${rotation}deg)` }}>
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={0}
            strokeLinecap="round"
          />
          {/* Value */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            style={{ filter: `drop-shadow(0 0 6px ${strokeColor}40)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {icon && <span className="text-white/25 mb-0.5">{icon}</span>}
          <span
            className="text-lg font-bold tabular-nums"
            style={{ color: strokeColor }}
          >
            {percent.toFixed(1)}%
          </span>
        </div>
      </div>
      {label && <p className="text-xs font-medium text-white/50 mt-1.5">{label}</p>}
      {sublabel && <p className="text-[10px] text-white/25 mt-0.5">{sublabel}</p>}
    </div>
  );
}

function getAutoColor(percent: number): string {
  if (percent > 90) return '#ef4444';
  if (percent > 70) return '#f59e0b';
  if (percent > 50) return '#eab308';
  return '#10b981';
}
