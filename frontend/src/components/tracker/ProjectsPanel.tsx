'use client';

import { useState } from 'react';
import { Plus, Trash2, Folder, Clock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTrackerProjects, createTrackerProject, deleteTrackerProject } from '@/lib/api';
import { GlassCard } from '@/components/ui/GlassCard';
import type { TrackerProject } from '@/lib/types';

export function ProjectsPanel() {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const queryClient = useQueryClient();

  const { data: projects = [] } = useQuery<TrackerProject[]>({
    queryKey: ['tracker-projects'],
    queryFn: getTrackerProjects as () => Promise<TrackerProject[]>,
  });

  const createMutation = useMutation({
    mutationFn: createTrackerProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracker-projects'] });
      setName('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTrackerProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracker-projects'] });
      queryClient.invalidateQueries({ queryKey: ['tracker-tasks'] });
    },
  });

  const maxTime = Math.max(1, ...projects.map(p => p.total_time));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({ name: name.trim(), color });
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Create Form */}
      <GlassCard>
        <h3 className="text-sm font-medium mb-3">Neues Projekt</h3>
        <form onSubmit={handleSubmit} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wider">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Projektname..."
              className="glass-input w-full mt-1"
            />
          </div>
          <div>
            <label className="text-[10px] text-white/40 uppercase tracking-wider">Farbe</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-10 h-10 rounded-lg border border-white/10 bg-transparent cursor-pointer mt-1"
            />
          </div>
          <button
            type="submit"
            disabled={!name.trim() || createMutation.isPending}
            className="btn-primary py-2.5 px-4 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Erstellen
          </button>
        </form>
      </GlassCard>

      {/* Project List */}
      <div className="space-y-3">
        {projects.map((project, i) => (
          <GlassCard key={project.id} delay={i * 0.05}>
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: project.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">{project.name}</h4>
                  <div className="flex items-center gap-3 text-[10px] text-white/40">
                    <span className="flex items-center gap-1">
                      <Folder className="w-3 h-3" /> {project.task_count} Aufgaben
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {project.total_time} min
                    </span>
                  </div>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(project.total_time / maxTime) * 100}%`,
                      backgroundColor: project.color,
                      opacity: 0.6,
                    }}
                  />
                </div>
              </div>
              <button
                onClick={() => deleteMutation.mutate(project.id)}
                className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </GlassCard>
        ))}
        {projects.length === 0 && (
          <p className="text-sm text-white/20 text-center py-8">Noch keine Projekte erstellt</p>
        )}
      </div>
    </div>
  );
}
