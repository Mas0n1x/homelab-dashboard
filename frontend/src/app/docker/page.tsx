'use client';

import { useState, useCallback } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Play, Square, RotateCcw, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tabs } from '@/components/ui/Tabs';
import { Modal } from '@/components/ui/Modal';
import { ContainerResourcesInline } from '@/components/docker/ContainerResources';
import { ComposeActions } from '@/components/docker/ComposeActions';
import { DiskTreemap } from '@/components/docker/DiskTreemap';
import { ImageUpdates } from '@/components/docker/ImageUpdates';
import { ContainerComparison } from '@/components/docker/ContainerComparison';
import { ContainerTemplates } from '@/components/docker/ContainerTemplates';
import { useServerStore } from '@/stores/serverStore';
import * as api from '@/lib/api';
import type { Container, DockerInfo } from '@/lib/types';
import { clsx } from 'clsx';

export default function DockerPage() {
  const queryClient = useQueryClient();
  const { activeServerId } = useServerStore();
  const [activeTab, setActiveTab] = useState('containers');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set(['all']));
  const [logsModal, setLogsModal] = useState<{ open: boolean; containerId: string; name: string; logs: string }>({ open: false, containerId: '', name: '', logs: '' });
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const { data: containersData } = useQuery<Container[]>({ queryKey: ['containers', activeServerId], enabled: false });
  const { data: dockerInfoData } = useQuery<DockerInfo>({ queryKey: ['dockerInfo', activeServerId], enabled: false });
  const containers = containersData || [];
  const dockerInfo = dockerInfoData;

  const { data: images } = useQuery({ queryKey: ['images'], queryFn: () => api.getImages(), enabled: activeTab === 'images' });
  const { data: volumes } = useQuery({ queryKey: ['volumes'], queryFn: () => api.getVolumes(), enabled: activeTab === 'volumes' });
  const { data: networks } = useQuery({ queryKey: ['networks'], queryFn: () => api.getNetworks(), enabled: activeTab === 'networks' });
  const { data: ports } = useQuery({ queryKey: ['ports'], queryFn: () => api.getPorts(), enabled: activeTab === 'ports' });

  const running = containers.filter(c => c.state === 'running').length;
  const stopped = containers.filter(c => c.state === 'exited').length;

  const handleAction = useCallback(async (id: string, action: string) => {
    setLoading(prev => ({ ...prev, [id]: true }));
    try {
      await api.containerAction(id, action);
    } catch (e) {
      console.error(e);
    }
    setLoading(prev => ({ ...prev, [id]: false }));
  }, []);

  const viewLogs = useCallback(async (id: string, name: string) => {
    try {
      const result = await api.getContainerLogs(id);
      setLogsModal({ open: true, containerId: id, name, logs: result.logs });
    } catch {
      setLogsModal({ open: true, containerId: id, name, logs: 'Fehler beim Laden der Logs' });
    }
  }, []);

  // Group containers by project
  const projects = new Map<string, Container[]>();
  containers.forEach(c => {
    const key = c.project || 'Andere';
    if (!projects.has(key)) projects.set(key, []);
    projects.get(key)!.push(c);
  });

  const toggleProject = (name: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const tabs = [
    { id: 'containers', label: 'Container', count: containers.length },
    { id: 'compose', label: 'Projekte' },
    { id: 'images', label: 'Images', count: (images as any[])?.length },
    { id: 'volumes', label: 'Volumes', count: (volumes as any[])?.length },
    { id: 'networks', label: 'Netzwerke', count: (networks as any[])?.length },
    { id: 'ports', label: 'Ports', count: (ports as any[])?.length },
    { id: 'comparison', label: 'Vergleich' },
    { id: 'templates', label: 'Templates' },
    { id: 'storage', label: 'Speicher' },
    { id: 'updates', label: 'Updates' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status="running" label={`${running} laufend`} size="md" />
        <StatusBadge status="stopped" label={`${stopped} gestoppt`} size="md" />
        <span className="text-sm text-white/30">{dockerInfo?.images || 0} Images | Docker v{dockerInfo?.dockerVersion || '?'}</span>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* Container Tab */}
      {activeTab === 'containers' && (
        <div className="space-y-4">
          {Array.from(projects.entries()).map(([projectName, projectContainers]) => (
            <GlassCard key={projectName} padding={false} delay={0.1}>
              <button
                onClick={() => toggleProject(projectName)}
                className="relative z-10 w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors rounded-t-2xl"
              >
                <div className="flex items-center gap-3">
                  {expandedProjects.has(projectName) ? <ChevronDown className="w-4 h-4 text-white/40" /> : <ChevronRight className="w-4 h-4 text-white/40" />}
                  <span className="font-medium">{projectName}</span>
                  <span className="text-xs text-white/30">{projectContainers.length} Container</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-xs text-emerald-400">{projectContainers.filter(c => c.state === 'running').length} laufend</span>
                </div>
              </button>

              <AnimatePresence>
                {expandedProjects.has(projectName) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="relative z-10 border-t border-white/[0.04]">
                      {projectContainers.map(c => (
                        <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors border-b border-white/[0.03] last:border-b-0">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', c.state === 'running' ? 'bg-emerald-400' : 'bg-red-400')} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{c.name}</p>
                              <p className="text-xs text-white/30 truncate font-mono">{c.image}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Resource sparklines for running containers */}
                            {c.state === 'running' && (
                              <div className="hidden lg:block">
                                <ContainerResourcesInline containerId={c.id} />
                              </div>
                            )}

                            <StatusBadge status={c.state} />

                            {c.state === 'running' ? (
                              <>
                                <button
                                  onClick={() => handleAction(c.id, 'stop')}
                                  disabled={loading[c.id]}
                                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400/60 hover:text-red-400 transition-all disabled:opacity-30"
                                  title="Stoppen"
                                >
                                  <Square className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleAction(c.id, 'restart')}
                                  disabled={loading[c.id]}
                                  className="p-1.5 rounded-lg hover:bg-amber-500/10 text-amber-400/60 hover:text-amber-400 transition-all disabled:opacity-30"
                                  title="Neustarten"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleAction(c.id, 'start')}
                                disabled={loading[c.id]}
                                className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-emerald-400/60 hover:text-emerald-400 transition-all disabled:opacity-30"
                                title="Starten"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => viewLogs(c.id, c.name)}
                              className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-all"
                              title="Logs"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Compose Projects Tab */}
      {activeTab === 'compose' && <ComposeActions />}

      {/* Images Tab */}
      {activeTab === 'images' && (
        <GlassCard delay={0.1}>
          <div className="relative z-10 space-y-2">
            {(images as any[] || []).map((img: any) => (
              <div key={img.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/[0.03] transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{img.repoTags?.[0] || '<none>'}</p>
                  <p className="text-xs text-white/30 font-mono">{img.shortId} | {(img.size / 1024 / 1024).toFixed(0)} MB</p>
                </div>
                {img.inUse && <span className="text-xs text-emerald-400">In Verwendung</span>}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Volumes Tab */}
      {activeTab === 'volumes' && (
        <GlassCard delay={0.1}>
          <div className="relative z-10 space-y-2">
            {(volumes as any[] || []).map((vol: any) => (
              <div key={vol.name} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/[0.03] transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{vol.name}</p>
                  <p className="text-xs text-white/30">{vol.driver} | {vol.scope}</p>
                </div>
                {vol.inUse && <span className="text-xs text-emerald-400">In Verwendung</span>}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Networks Tab */}
      {activeTab === 'networks' && (
        <GlassCard delay={0.1}>
          <div className="relative z-10 space-y-2">
            {(networks as any[] || []).map((net: any) => (
              <div key={net.id} className="py-2 px-3 rounded-lg hover:bg-white/[0.03] transition-colors">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{net.name}</p>
                  <span className="text-xs text-white/30">{net.driver}</span>
                </div>
                {net.containers?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {net.containers.map((c: any) => (
                      <span key={c.id} className="text-xs px-2 py-0.5 rounded-full bg-white/[0.04] text-white/50">{c.name}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Ports Tab */}
      {activeTab === 'ports' && (
        <GlassCard delay={0.1}>
          <div className="relative z-10 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/30 text-xs uppercase tracking-wider border-b border-white/[0.06]">
                  <th className="text-left py-2 px-3">Port</th>
                  <th className="text-left py-2 px-3">Container</th>
                  <th className="text-left py-2 px-3">Status</th>
                  <th className="text-left py-2 px-3">Intern</th>
                </tr>
              </thead>
              <tbody>
                {(ports as any[] || []).map((p: any, i: number) => (
                  <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="py-2 px-3 font-mono text-accent-light">{p.publicPort}</td>
                    <td className="py-2 px-3">{p.containerName}</td>
                    <td className="py-2 px-3"><StatusBadge status={p.containerState} /></td>
                    <td className="py-2 px-3 text-white/40 font-mono">{p.privatePort}/{p.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Comparison Tab */}
      {activeTab === 'comparison' && <ContainerComparison />}

      {/* Templates Tab */}
      {activeTab === 'templates' && <ContainerTemplates />}

      {/* Storage Tab */}
      {activeTab === 'storage' && <DiskTreemap />}

      {/* Updates Tab */}
      {activeTab === 'updates' && <ImageUpdates />}

      {/* Logs Modal */}
      <Modal isOpen={logsModal.open} onClose={() => setLogsModal(prev => ({ ...prev, open: false }))} title={`Logs: ${logsModal.name}`} size="lg">
        <pre className="text-xs font-mono text-white/70 whitespace-pre-wrap max-h-[60vh] overflow-y-auto bg-black/30 rounded-xl p-4 leading-5">
          {logsModal.logs || 'Keine Logs verfügbar'}
        </pre>
      </Modal>
    </div>
  );
}
