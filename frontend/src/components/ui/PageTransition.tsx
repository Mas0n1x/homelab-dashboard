/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { motion } from 'framer-motion';
import { useLowMotion } from '@/hooks/useLowMotion';

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const lowMotion = useLowMotion();

  // Mobil zeigt sich die Seite sofort. Die 0,4 Sekunden Einblenden fühlten sich
  // auf dem Handy nicht wie Politur an, sondern wie eine langsame Anwendung.
  if (lowMotion) return <>{children}</>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: {
          duration: 0.4,
          ease: [0.16, 1, 0.3, 1],
          staggerChildren: 0.06,
        },
      }}
    >
      {children}
    </motion.div>
  );
}
