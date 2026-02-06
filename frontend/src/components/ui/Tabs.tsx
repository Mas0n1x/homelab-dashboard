'use client';

import { clsx } from 'clsx';

interface TabsProps {
  tabs: { id: string; label: string; count?: number }[];
  activeTab: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={clsx(
            'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
            activeTab === tab.id
              ? 'bg-white/[0.08] text-white shadow-sm'
              : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={clsx(
              'ml-1.5 text-xs px-1.5 py-0.5 rounded-full',
              activeTab === tab.id ? 'bg-accent/20 text-accent-light' : 'bg-white/[0.06] text-white/40'
            )}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
