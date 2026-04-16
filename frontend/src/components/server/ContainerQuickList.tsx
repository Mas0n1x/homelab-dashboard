'use client';

import { useState, useCallback } from 'react';
import { Play, Square, RotateCcw, Box } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import * as api from '@/lib/api';
import type { Container } from '@/lib/types';
import { CONTAINER_STATE_COLORS } from '@/lib/constants';

interface ContainerQuickListProps {
  containers: Container[];
  serverId: string;
}

export function ContainerQuickList({ containers, serverId }: ContainerQuickListProps) {
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const handleAction = useCallback(async (id: string, action: string) => {
    setLoading(prev => ({ ...prev, [id]: true }));
    try {
      await api.containerAction(id, action);
    } catch (e) {
      console.error(e);
    }
    setLoading(prev => ({ ...prev, [id]: false }));
  }, []);

  const running = containers.filter(c => c.state === 'running');
  const stopped = containers.filter(c => c.state !== 'running');

  // Group by compose project
  const grouped = new Map<string, Container[]>();
  containers.forEach(c => {
    const project = c.project || 'Standalone';
    if (!grouped.has(project)) grouped.set(project, []);
    grouped.get(project)!.push(c);
  });

  return (
    <div className="glass-card">
      <div className="relative z-10 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-medium">Container</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-emerald-400">{running.length} running</span>
            <span className="text-white/20">|</span>
            <span className="text-white/30">{stopped.length} stopped</span>
          </div>
        </div>

        <div className="space-y-1 max-h-[400px] overflow-y-auto scrollbar-hide">
          {Array.from(grouped.entries()).map(([project, ctrs]) => (
            <div key={project}>
              {project !== 'Standalone' && (
                <div className="text-[10px] uppercase tracking-wider text-white/20 mt-2 mb-1 px-1">{project}</div>
              )}
              {ctrs.map(container => (
                <div
                  key={container.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors group"
                >
                  <span className={clsx(
                    'w-1.5 h-1.5 rounded-full flex-shrink-0',
                    container.state === 'running' ? 'bg-emerald-400' : container.state === 'paused' ? 'bg-amber-400' : 'bg-white/20'
                  )} />
                  <span className="text-xs flex-1 truncate text-white/70">{container.name}</span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {container.state === 'running' ? (
                      <>
                        <button
                          onClick={() => handleAction(container.id, 'restart')}
                          disabled={loading[container.id]}
                          className="p-1 rounded hover:bg-white/[0.06] text-white/30 hover:text-amber-400 transition-colors"
                          title="Restart"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleAction(container.id, 'stop')}
                          disabled={loading[container.id]}
                          className="p-1 rounded hover:bg-white/[0.06] text-white/30 hover:text-red-400 transition-colors"
                          title="Stop"
                        >
                          <Square className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleAction(container.id, 'start')}
                        disabled={loading[container.id]}
                        className="p-1 rounded hover:bg-white/[0.06] text-white/30 hover:text-emerald-400 transition-colors"
                        title="Start"
                      >
                        <Play className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
