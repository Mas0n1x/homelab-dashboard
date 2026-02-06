'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}

export function AnimatedNumber({ value, duration = 500, decimals = 0, suffix = '', className }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  const frameRef = useRef<number>();

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      const current = from + (to - from) * eased;

      setDisplay(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        prevRef.current = to;
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [value, duration]);

  return (
    <span className={className}>
      {display.toFixed(decimals)}{suffix}
    </span>
  );
}
