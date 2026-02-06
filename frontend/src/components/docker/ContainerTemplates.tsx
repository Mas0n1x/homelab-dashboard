'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Play, Loader2, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Modal } from '@/components/ui/Modal';
import { useServerStore } from '@/stores/serverStore';
import * as api from '@/lib/api';

interface Template {
  id: string;
  name: string;
  description: string;
  image: string;
  ports: string[];
  env: string[];
  volumes: string[];
  restart_policy: string;
  category: string;
  isCustom: boolean;
}

const CAT_COLORS: Record<string, string> = {
  Web: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  Datenbank: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  Management: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  Monitoring: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  Netzwerk: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  Allgemein: 'text-white/40 bg-white/[0.04] border-white/10',
};

export function ContainerTemplates() {
  const { activeServerId } = useServerStore();
  const queryClient = useQueryClient();
  const [deployModal, setDeployModal] = useState<Template | null>(null);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [deployForm, setDeployForm] = useState({
    containerName: '',
    ports: [] as string[],
    env: [] as string[],
    volumes: [] as string[],
  });

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: () => api.getTemplates() as Promise<Template[]>,
    staleTime: 60000,
  });

  const deployMutation = useMutation({
    mutationFn: (tpl: Template) => api.deployTemplate(tpl.id, {
      containerName: deployForm.containerName,
      image: tpl.image,
      ports: deployForm.ports,
      env: deployForm.env,
      volumes: deployForm.volumes,
      restart_policy: tpl.restart_policy,
      serverId: activeServerId,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
      setDeployModal(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTemplate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });

  // Group by category
  const categories = new Map<string, Template[]>();
  templates.forEach(t => {
    const cat = t.category || 'Allgemein';
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(t);
  });

  const openDeploy = (tpl: Template) => {
    setDeployForm({
      containerName: tpl.name.toLowerCase().replace(/\s+/g, '-'),
      ports: [...tpl.ports],
      env: [...tpl.env],
      volumes: [...tpl.volumes],
    });
    setDeployModal(tpl);
  };

  return (
    <div className="space-y-4">
      {Array.from(categories.entries()).map(([cat, tpls]) => (
        <GlassCard key={cat}>
          <div className="relative z-10">
            <button
              onClick={() => setExpandedCat(expandedCat === cat ? null : cat)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-white/30" />
                <span className="text-sm font-medium">{cat}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${CAT_COLORS[cat] || CAT_COLORS.Allgemein}`}>
                  {tpls.length}
                </span>
              </div>
              {expandedCat === cat ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
            </button>

            {expandedCat === cat && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {tpls.map(tpl => (
                  <div key={tpl.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-all group">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-xs font-semibold">{tpl.name}</span>
                        <p className="text-[10px] text-white/30 mt-0.5">{tpl.description}</p>
                      </div>
                      <div className="flex gap-1">
                        {tpl.isCustom && (
                          <button
                            onClick={() => deleteMutation.mutate(tpl.id)}
                            className="p-1 rounded hover:bg-red-500/10 text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-[10px] font-mono text-white/25 mb-2 truncate">{tpl.image}</div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {tpl.ports.slice(0, 3).map((p, i) => (
                        <span key={i} className="text-[9px] px-1 py-0.5 rounded bg-cyan-500/10 text-cyan-400/60 border border-cyan-500/10">{p}</span>
                      ))}
                    </div>
                    <button
                      onClick={() => openDeploy(tpl)}
                      className="w-full btn-primary text-xs py-1.5 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Play className="w-3 h-3" /> Deployen
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>
      ))}

      {/* Deploy Modal */}
      {deployModal && (
        <Modal isOpen={true} onClose={() => setDeployModal(null)} title={`${deployModal.name} deployen`} size="sm">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/40 block mb-1">Container Name</label>
              <input className="glass-input w-full text-sm" value={deployForm.containerName} onChange={e => setDeployForm(f => ({ ...f, containerName: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-white/40 block mb-1">Image</label>
              <span className="text-xs font-mono text-white/50">{deployModal.image}</span>
            </div>
            <div>
              <label className="text-xs text-white/40 block mb-1">Ports (host:container)</label>
              {deployForm.ports.map((p, i) => (
                <div key={i} className="flex gap-2 mb-1">
                  <input
                    className="glass-input flex-1 text-xs font-mono"
                    value={p}
                    onChange={e => {
                      const next = [...deployForm.ports];
                      next[i] = e.target.value;
                      setDeployForm(f => ({ ...f, ports: next }));
                    }}
                  />
                  <button onClick={() => setDeployForm(f => ({ ...f, ports: f.ports.filter((_, idx) => idx !== i) }))} className="text-white/30 hover:text-red-400 text-xs">x</button>
                </div>
              ))}
              <button onClick={() => setDeployForm(f => ({ ...f, ports: [...f.ports, ''] }))} className="text-[10px] text-accent-light hover:underline">+ Port</button>
            </div>
            <div>
              <label className="text-xs text-white/40 block mb-1">Umgebungsvariablen</label>
              {deployForm.env.map((e, i) => (
                <div key={i} className="flex gap-2 mb-1">
                  <input
                    className="glass-input flex-1 text-xs font-mono"
                    value={e}
                    placeholder="KEY=value"
                    onChange={ev => {
                      const next = [...deployForm.env];
                      next[i] = ev.target.value;
                      setDeployForm(f => ({ ...f, env: next }));
                    }}
                  />
                  <button onClick={() => setDeployForm(f => ({ ...f, env: f.env.filter((_, idx) => idx !== i) }))} className="text-white/30 hover:text-red-400 text-xs">x</button>
                </div>
              ))}
              <button onClick={() => setDeployForm(f => ({ ...f, env: [...f.env, ''] }))} className="text-[10px] text-accent-light hover:underline">+ Variable</button>
            </div>
            <button
              onClick={() => deployMutation.mutate(deployModal)}
              disabled={!deployForm.containerName || deployMutation.isPending}
              className="btn-success w-full flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {deployMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {deployMutation.isPending ? 'Wird erstellt...' : 'Container erstellen & starten'}
            </button>
            {deployMutation.isError && (
              <p className="text-xs text-red-400">{(deployMutation.error as Error).message}</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
