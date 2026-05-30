/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface GreetingHeaderProps {
  containersRunning?: number;
  cpuPercent?: number;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Guten Morgen';
  if (hour >= 12 && hour < 18) return 'Guten Tag';
  if (hour >= 18 && hour < 22) return 'Guten Abend';
  return 'Gute Nacht';
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function GreetingHeader({ containersRunning, cpuPercent }: GreetingHeaderProps) {
  const [greeting, setGreeting] = useState(getGreeting());
  const [date, setDate] = useState(getFormattedDate());

  useEffect(() => {
    const interval = setInterval(() => {
      setGreeting(getGreeting());
      setDate(getFormattedDate());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const parts: string[] = [];
  if (containersRunning !== undefined) parts.push(`${containersRunning} Container laufen`);
  if (cpuPercent !== undefined) parts.push(`CPU bei ${Math.round(cpuPercent)}%`);
  const summary = parts.length > 0 ? parts.join(' · ') : undefined;

  return (
    <div className="mb-2">
      <motion.h1
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="text-2xl sm:text-3xl font-bold"
      >
        <span className="text-gradient">{greeting}</span>
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="text-sm text-white/40 mt-1"
      >
        {date}
        {summary && <span className="text-white/25"> — {summary}</span>}
      </motion.p>
    </div>
  );
}
