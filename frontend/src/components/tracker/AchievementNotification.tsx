'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Zap } from 'lucide-react';
import { useTrackerStore } from '@/stores/trackerStore';
import type { Achievement } from '@/lib/types';

export function AchievementNotification() {
  const { notification, clearNotification } = useTrackerStore();

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(clearNotification, 4000);
      return () => clearTimeout(timer);
    }
  }, [notification, clearNotification]);

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, scale: 0.9 }}
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] glass-card px-6 py-4 flex items-center gap-4 cursor-pointer"
          onClick={clearNotification}
        >
          <div className="relative z-10 flex items-center gap-4">
            {notification.type === 'levelup' ? (
              <>
                <div className="p-2.5 rounded-xl bg-indigo-500/20">
                  <Zap className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wider">Level Up!</p>
                  <p className="text-lg font-bold">Level {(notification.data as { level: number }).level}</p>
                </div>
              </>
            ) : (
              <>
                <div className="p-2.5 rounded-xl bg-yellow-500/20">
                  <Trophy className="w-6 h-6 text-yellow-400" />
                </div>
                <div>
                  <p className="text-xs text-white/50 uppercase tracking-wider">Achievement!</p>
                  <p className="text-lg font-bold">{(notification.data as Achievement).name}</p>
                  <p className="text-xs text-white/40">{(notification.data as Achievement).desc}</p>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
