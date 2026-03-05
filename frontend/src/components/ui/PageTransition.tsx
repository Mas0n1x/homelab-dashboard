'use client';

import { motion } from 'framer-motion';

interface PageTransitionProps {
  children: React.ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
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
