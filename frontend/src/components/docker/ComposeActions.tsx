'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Square, RotateCcw, Layers, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import * as api from '@/lib/api';
import type { ComposeProject } from '@/lib/types';

export function ComposeActions() {
  const queryClient = useQueryClient();
  const [loadingAction, setLoadingAction] = useState<string>('');

  const { data: projects } = useQuery<ComposeProject[]>({
    queryKey: ['compose-projects'],
    queryFn: () => api.getComposeProjects() as Promise<ComposeProject[]>,
    staleTime: 30000,
  });

  const actionMutation = useMutation({
    mutationFn: ({ project, action }: { project: string; action: string }) => api.composeAction(project, action),
    onMutate: ({ project, action }) => setLoadingAction(`${project}-${action}`),
    onSettled: () => {
      setLoadingAction('');
      queryClient.invalidateQueries({ queryKey: ['compose-projects'] });
    },
  });

  if (!projects?.length) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-xs font-medium text-white/30 uppercase tracking-wider flex items-center gap-1.5">
        <Layers className="w-3 h-3" />
        Compose Projekte
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {projects.map((project, i) => {
          const running = project.containers.filter(c => c.state === 'running').length;
          const total = project.containers.length;
          const allRunning = running === total;
          const allStopped = running === 0;

          return (
            <motion.div
              key={project.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <GlassCard padding={false}>
                <div className="relative z-10 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium">{project.name}</p>
                      <p className="text-xs text-white/30">{running}/{total} laufend</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!allRunning && (
                        <button
                          onClick={() => actionMutation.mutate({ project: project.name, action: 'start' })}
                          disabled={!!loadingAction}
                          className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-emerald-400/60 hover:text-emerald-400 transition-all disabled:opacity-30"
                          title="Alle starten"
                        >
                          {loadingAction === `${project.name}-start` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      {!allStopped && (
                        <>
                          <button
                            onClick={() => actionMutation.mutate({ project: project.name, action: 'restart' })}
                            disabled={!!loadingAction}
                            className="p-1.5 rounded-lg hover:bg-amber-500/10 text-amber-400/60 hover:text-amber-400 transition-all disabled:opacity-30"
                            title="Alle neustarten"
                          >
                            {loadingAction === `${project.name}-restart` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => actionMutation.mutate({ project: project.name, action: 'stop' })}
                            disabled={!!loadingAction}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400/60 hover:text-red-400 transition-all disabled:opacity-30"
                            title="Alle stoppen"
                          >
                            {loadingAction === `${project.name}-stop` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {project.containers.map(c => (
                      <span
                        key={c.id}
                        className={`text-xs px-2 py-0.5 rounded-full ${c.state === 'running' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}
                      >
                        {c.service || c.name}
                      </span>
                    ))}
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
