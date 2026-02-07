'use client';

import { useId } from 'react';

interface CoffeeCupProps {
  fillPercent: number; // 0-1
  isActive: boolean;
  size?: number;
}

export function CoffeeCup({ fillPercent, isActive, size = 160 }: CoffeeCupProps) {
  const id = useId();
  const fill = Math.max(0, Math.min(1, fillPercent));
  const fillHeight = fill * 58;
  const fillY = 93 - fillHeight;
  const steamOpacity = isActive ? 1 : 0;

  // Color shifts warmer as it fills
  const r = Math.round(99 + fill * 60);
  const g = Math.round(102 - fill * 40);
  const b = Math.round(241 - fill * 80);
  const liquidColor = `rgb(${r},${g},${b})`;
  const liquidColorDim = `rgba(${r},${g},${b},0.25)`;
  const glowColor = `rgba(${r},${g},${b},${0.15 + fill * 0.25})`;

  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="mx-auto block">
      <defs>
        {/* Liquid gradient - top lighter, bottom deeper */}
        <linearGradient id={`${id}-liquid`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={liquidColor} stopOpacity="0.7" />
          <stop offset="50%" stopColor={liquidColor} stopOpacity="0.45" />
          <stop offset="100%" stopColor={liquidColorDim} />
        </linearGradient>

        {/* Surface shine on liquid top */}
        <linearGradient id={`${id}-surface`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="30%" stopColor="white" stopOpacity="0.15" />
          <stop offset="50%" stopColor="white" stopOpacity="0.25" />
          <stop offset="70%" stopColor="white" stopOpacity="0.1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>

        {/* Cup glass gradient for frosted look */}
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.08" />
          <stop offset="50%" stopColor="white" stopOpacity="0.03" />
          <stop offset="100%" stopColor="white" stopOpacity="0.06" />
        </linearGradient>

        {/* Glow filter for the liquid */}
        <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Soft shadow under saucer */}
        <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
          <feOffset dy="2" />
          <feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <clipPath id={`${id}-cup`}>
          <path d="M30,35 L30,85 Q30,95 40,95 L70,95 Q80,95 80,85 L80,35 Z" />
        </clipPath>

        {/* Wavy surface path for liquid animation */}
        <clipPath id={`${id}-wave`}>
          <rect x="28" y={fillY} width="54" height={fillHeight + 4} />
        </clipPath>
      </defs>

      {/* Ambient glow behind cup from liquid */}
      {fill > 0.05 && (
        <ellipse
          cx="55"
          cy="70"
          rx={20 + fill * 12}
          ry={15 + fill * 10}
          fill={glowColor}
          className="transition-all duration-700"
        >
          {isActive && (
            <animate attributeName="opacity" values="0.6;1;0.6" dur="3s" repeatCount="indefinite" />
          )}
        </ellipse>
      )}

      {/* Saucer shadow */}
      <ellipse cx="55" cy="102" rx="32" ry="4" fill="rgba(0,0,0,0.2)" />

      {/* Saucer */}
      <ellipse cx="55" cy="99" rx="36" ry="5" fill={`url(#${id}-glass)`} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
      <ellipse cx="55" cy="99" rx="28" ry="3" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />

      {/* Cup body - frosted glass fill */}
      <path
        d="M30,35 L30,85 Q30,95 40,95 L70,95 Q80,95 80,85 L80,35 Z"
        fill={`url(#${id}-glass)`}
      />

      {/* Liquid fill with glow */}
      {fill > 0 && (
        <g clipPath={`url(#${id}-cup)`}>
          {/* Main liquid body */}
          <rect
            x="29"
            y={fillY}
            width="52"
            height={fillHeight + 2}
            fill={`url(#${id}-liquid)`}
            className="transition-all duration-500 ease-out"
          />

          {/* Wavy surface line */}
          <path
            d={`M29,${fillY + 1} Q39,${fillY - 1.5} 49,${fillY + 1} Q59,${fillY + 3.5} 69,${fillY + 1} L81,${fillY + 1}`}
            fill={liquidColor}
            fillOpacity="0.5"
            className="transition-all duration-500"
          >
            {isActive && (
              <animate
                attributeName="d"
                values={`M29,${fillY + 1} Q39,${fillY - 1.5} 49,${fillY + 1} Q59,${fillY + 3.5} 69,${fillY + 1} L81,${fillY + 1};M29,${fillY + 1} Q39,${fillY + 3} 49,${fillY + 1} Q59,${fillY - 2} 69,${fillY + 1} L81,${fillY + 1};M29,${fillY + 1} Q39,${fillY - 1.5} 49,${fillY + 1} Q59,${fillY + 3.5} 69,${fillY + 1} L81,${fillY + 1}`}
                dur="3s"
                repeatCount="indefinite"
              />
            )}
          </path>

          {/* Surface shine reflection */}
          <rect
            x="29"
            y={fillY - 1}
            width="52"
            height="4"
            fill={`url(#${id}-surface)`}
            className="transition-all duration-500"
          />

          {/* Bubble particles when active */}
          {isActive && fill > 0.1 && (
            <g>
              <circle cx="42" cy={fillY + fillHeight * 0.4} r="1" fill="white" fillOpacity="0.15">
                <animate attributeName="cy" values={`${fillY + fillHeight * 0.7};${fillY + 4}`} dur="2.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.15;0" dur="2.5s" repeatCount="indefinite" />
              </circle>
              <circle cx="58" cy={fillY + fillHeight * 0.6} r="0.8" fill="white" fillOpacity="0.1">
                <animate attributeName="cy" values={`${fillY + fillHeight * 0.8};${fillY + 6}`} dur="3.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.12;0" dur="3.2s" repeatCount="indefinite" />
              </circle>
              <circle cx="50" cy={fillY + fillHeight * 0.5} r="1.2" fill="white" fillOpacity="0.08">
                <animate attributeName="cy" values={`${fillY + fillHeight * 0.9};${fillY + 3}`} dur="4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.1;0" dur="4s" repeatCount="indefinite" />
              </circle>
            </g>
          )}
        </g>
      )}

      {/* Cup outline */}
      <path
        d="M30,35 L30,85 Q30,95 40,95 L70,95 Q80,95 80,85 L80,35 Z"
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="1.5"
      />

      {/* Left edge highlight (glass reflection) */}
      <line x1="32" y1="38" x2="32" y2="82" stroke="rgba(255,255,255,0.07)" strokeWidth="1" strokeLinecap="round" />

      {/* Rim - thicker top edge */}
      <line x1="29" y1="35" x2="81" y2="35" stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeLinecap="round" />
      {/* Rim inner highlight */}
      <line x1="33" y1="36.5" x2="77" y2="36.5" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeLinecap="round" />

      {/* Handle */}
      <path
        d="M80,45 Q97,45 97,60 Q97,75 80,75"
        fill="none"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Handle inner highlight */}
      <path
        d="M80,48 Q93,48 93,60 Q93,72 80,72"
        fill="none"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth="0.8"
      />

      {/* Steam - wavy paths instead of circles */}
      <g opacity={steamOpacity} className="transition-opacity duration-700">
        <path d="M43,30 Q41,22 44,15" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeLinecap="round">
          <animate attributeName="d" values="M43,30 Q41,22 44,15;M43,30 Q45,22 42,14;M43,30 Q41,22 44,15" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.12;0.06;0.12" dur="2.5s" repeatCount="indefinite" />
        </path>
        <path d="M55,28 Q53,19 56,11" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.8" strokeLinecap="round">
          <animate attributeName="d" values="M55,28 Q53,19 56,11;M55,28 Q57,20 54,10;M55,28 Q53,19 56,11" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.1;0.04;0.1" dur="3s" repeatCount="indefinite" />
        </path>
        <path d="M67,30 Q65,23 68,16" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" strokeLinecap="round">
          <animate attributeName="d" values="M67,30 Q65,23 68,16;M67,30 Q69,23 66,15;M67,30 Q65,23 68,16" dur="2.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.08;0.03;0.08" dur="2.8s" repeatCount="indefinite" />
        </path>
      </g>

      {/* Fill level percentage text */}
      {fill > 0 && (
        <text
          x="55"
          y="108"
          textAnchor="middle"
          fill="rgba(255,255,255,0.2)"
          fontSize="7"
          fontFamily="monospace"
        >
          {Math.round(fill * 100)}%
        </text>
      )}
    </svg>
  );
}
