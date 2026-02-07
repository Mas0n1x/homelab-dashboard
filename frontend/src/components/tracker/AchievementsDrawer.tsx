'use client';

import { useQuery } from '@tanstack/react-query';
import { getTrackerAchievements } from '@/lib/api';
import { useTrackerStore } from '@/stores/trackerStore';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock,
  Footprints, Star, Zap, Crown, Trophy,
  Flame, Sword, Shield, Gem,
  Mountain, Medal, Rocket, Target,
  Sunrise, Moon, Layers
} from 'lucide-react';
import type { Achievement } from '@/lib/types';
import type { LucideIcon } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  footprints: Footprints,
  star: Star,
  zap: Zap,
  crown: Crown,
  trophy: Trophy,
  flame: Flame,
  sword: Sword,
  shield: Shield,
  gem: Gem,
  mountain: Mountain,
  medal: Medal,
  rocket: Rocket,
  target: Target,
  sunrise: Sunrise,
  moon: Moon,
  layers: Layers,
};

export function AchievementsDrawer() {
  const { showAchievements, toggleAchievements } = useTrackerStore();

  const { data: achievements = [] } = useQuery<Achievement[]>({
    queryKey: ['tracker-achievements'],
    queryFn: getTrackerAchievements as () => Promise<Achievement[]>,
    enabled: showAchievements,
  });

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <AnimatePresence>
      {showAchievements && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={toggleAchievements}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-80 glass-card rounded-none rounded-l-2xl p-5 overflow-y-auto"
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold">Achievements</h2>
                  <p className="text-[10px] text-white/40">{unlockedCount}/{achievements.length} freigeschaltet</p>
                </div>
                <button
                  onClick={toggleAchievements}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>

              <div className="space-y-3">
                {achievements.map(achievement => {
                  const IconComponent = ICON_MAP[achievement.icon] || Star;
                  return (
                    <div
                      key={achievement.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        achievement.unlocked
                          ? 'bg-white/[0.05] border-white/[0.1]'
                          : 'bg-white/[0.01] border-white/[0.04] opacity-40'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${achievement.unlocked ? 'bg-yellow-500/15' : 'bg-white/[0.04]'}`}>
                        {achievement.unlocked ? (
                          <IconComponent className="w-5 h-5 text-yellow-400" />
                        ) : (
                          <Lock className="w-5 h-5 text-white/20" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{achievement.name}</p>
                        <p className="text-[10px] text-white/40">{achievement.desc}</p>
                        {achievement.unlocked && achievement.unlocked_at && (
                          <p className="text-[9px] text-white/20 mt-0.5">
                            {new Date(achievement.unlocked_at).toLocaleDateString('de-DE')}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
