/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileCode, Save, Loader2, AlertTriangle, Wifi } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Modal } from '@/components/ui/Modal';
import { useServerStore } from '@/stores/serverStore';
import * as api from '@/lib/api';
import type { ComposeProject } from '@/lib/types';

export function ComposeEditor() {
  const queryClient = useQueryClient();
  const { activeServerId } = useServerStore();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [confirmSave, setConfirmSave] = useState(false);

  const { data: projects } = useQuery<ComposeProject[]>({
    queryKey: ['compose-projects', activeServerId],
    queryFn: () => api.getComposeProjects(activeServerId) as Promise<ComposeProject[]>,
  });

  const { data: fileData, isLoading: fileLoading } = useQuery({
    queryKey: ['compose-file', activeServerId, selectedProject],
    queryFn: () => api.getComposeFile(selectedProject!, activeServerId),
    enabled: !!selectedProject,
  });

  // Update content when file loads
  const loadedPath = fileData?.path;
  if (fileData && fileData.content !== originalContent && loadedPath) {
    setContent(fileData.content);
    setOriginalContent(fileData.content);
  }

  const saveMutation = useMutation({
    mutationFn: () => api.saveComposeFile(selectedProject!, content, activeServerId),
    onSuccess: () => {
      setOriginalContent(content);
      setConfirmSave(false);
      queryClient.invalidateQueries({ queryKey: ['compose-file', activeServerId, selectedProject] });
    },
  });

  const hasChanges = content !== originalContent;

  return (
    <div className="space-y-4">
      {/* Project selector */}
      <GlassCard>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <FileCode className="w-4 h-4 text-white/40" />
            <span className="text-sm font-medium">Compose Datei bearbeiten</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(projects || []).map(p => (
              <button
                key={p.name}
                onClick={() => {
                  setSelectedProject(p.name);
                  setOriginalContent('');
                }}
                className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                  selectedProject === p.name
                    ? 'bg-accent/20 border border-accent/30 text-accent-light'
                    : 'bg-white/[0.04] border border-white/10 text-white/50 hover:bg-white/[0.06]'
                }`}
              >
                {p.name}
              </button>
            ))}
            {(!projects || projects.length === 0) && (
              <p className="text-sm text-white/30">Keine Compose-Projekte gefunden</p>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Editor */}
      {selectedProject && (
        <GlassCard>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{selectedProject}</p>
                  {fileData?.remote && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-medium">
                      <Wifi className="w-2.5 h-2.5" />
                      Remote (SSH)
                    </span>
                  )}
                </div>
                {fileData?.path && (
                  <p className="text-[10px] text-white/25 font-mono mt-0.5">{fileData.path}</p>
                )}
              </div>
              <button
                onClick={() => setConfirmSave(true)}
                disabled={!hasChanges || saveMutation.isPending}
                className="btn-primary flex items-center gap-2 text-xs disabled:opacity-30"
              >
                {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Speichern
              </button>
            </div>

            {fileLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-white/30" />
              </div>
            ) : fileData ? (
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                className="w-full h-[500px] bg-black/30 rounded-xl p-4 font-mono text-xs text-white/80 leading-5 resize-y outline-none border border-white/[0.06] focus:border-accent/30 transition-colors"
                spellCheck={false}
              />
            ) : (
              <p className="text-sm text-white/30 text-center py-8">
                Compose-Datei konnte nicht geladen werden. Beim lokalen Server muss das Host-Verzeichnis gemountet sein; bei Remote-Servern braucht der SSH-Nutzer Leserechte auf die Datei.
              </p>
            )}
          </div>
        </GlassCard>
      )}

      {/* Confirm Save Modal */}
      <Modal isOpen={confirmSave} onClose={() => setConfirmSave(false)} title="Änderungen speichern" size="sm">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-white/70">
              Möchtest du die Compose-Datei von <span className="font-semibold text-white">{selectedProject}</span> wirklich überschreiben?
            </p>
            <p className="text-xs text-white/30 mt-1">Ein Backup (.bak) wird automatisch erstellt.</p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setConfirmSave(false)}
            className="px-4 py-2 text-sm rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/60 transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="px-4 py-2 text-sm rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-medium transition-colors"
          >
            {saveMutation.isPending ? 'Wird gespeichert...' : 'Speichern'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
