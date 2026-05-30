/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { clsx } from 'clsx';
import { motion } from 'framer-motion';

interface TabsProps {
  tabs: { id: string; label: string; count?: number }[];
  activeTab: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-white/[0.02] border border-white/[0.05] overflow-x-auto backdrop-blur-sm">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={clsx(
            'relative px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex-shrink-0 whitespace-nowrap',
            activeTab === tab.id
              ? 'text-white'
              : 'text-white/50 hover:text-white/80'
          )}
        >
          {activeTab === tab.id && (
            <motion.div
              layoutId="tab-indicator"
              className="absolute inset-0 bg-white/[0.08] rounded-lg shadow-sm"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10">
            {tab.label}
            {tab.count !== undefined && (
              <span className={clsx(
                'ml-1.5 text-xs px-1.5 py-0.5 rounded-full',
                activeTab === tab.id ? 'bg-accent/20 text-accent-light' : 'bg-white/[0.06] text-white/40'
              )}>
                {tab.count}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
