/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Loader2, Boxes, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';
import { GlassCard } from '@/components/ui/GlassCard';
import { Modal } from '@/components/ui/Modal';
import { useServerStore } from '@/stores/serverStore';
import * as api from '@/lib/api';
import { SectionHeader } from './ui';

export function ServicesTab() {
  const queryClient = useQueryClient();
  const { servers } = useServerStore();
  // Dienste-Verwaltung
  const [selectedSvcServer, setSelectedSvcServer] = useState('local');
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceForm, setServiceForm] = useState({ name: '', url: '', category: 'Extern' });

  const { data: managedServices } = useQuery<any[]>({
    queryKey: ['managedServices', selectedSvcServer],
    queryFn: async () => {
      const r: any = await api.getManagedServices(selectedSvcServer);
      return (r?.services ?? []) as any[];
    },
  });

  const serviceAddMutation = useMutation({
    mutationFn: () => api.addService({ ...serviceForm, serverId: selectedSvcServer }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managedServices', selectedSvcServer] });
      setShowServiceModal(false);
      setServiceForm({ name: '', url: '', category: 'Extern' });
    },
  });
  const serviceDeleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteService(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['managedServices', selectedSvcServer] }),
  });
  const serviceHideMutation = useMutation({
    mutationFn: (svc: any) => api.updateServiceOverride(svc.id, { serverId: selectedSvcServer, hidden: !svc.hidden, name: svc.name, category: svc.category }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['managedServices', selectedSvcServer] }),
  });

  return (
    <>
      <GlassCard>
        <div className="relative z-10">
          <SectionHeader
            icon={Boxes}
            tint="bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
            title="Überwachte Dienste"
            desc="Sichtbarkeit steuern, externe Dienste zur Überwachung hinzufügen"
            action={
              <div className="flex items-center gap-2">
                <select value={selectedSvcServer} onChange={e => setSelectedSvcServer(e.target.value)} className="glass-input text-xs py-1.5">
                  {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button onClick={() => setShowServiceModal(true)} className="btn-primary flex items-center gap-1.5 text-xs whitespace-nowrap">
                  <Plus className="w-3.5 h-3.5" /> Extern
                </button>
              </div>
            }
          />
          <div className="space-y-1.5 max-h-[560px] overflow-y-auto">
            {(managedServices ?? []).length === 0 && (
              <p className="text-sm text-white/50 text-center py-8">Keine Dienste gefunden</p>
            )}
            {(managedServices ?? []).map((svc: any) => {
              const isManual = svc.source === 'manual';
              const up = svc.uptime ? (svc.uptime.uptime24h ?? 0) >= 50 : svc.state === 'running';
              return (
                <div key={svc.id} className={clsx('flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors', svc.hidden ? 'border-white/[0.04] bg-white/[0.01] opacity-50' : 'border-white/[0.05] bg-white/[0.015]')}>
                  <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', up ? 'bg-emerald-400' : 'bg-white/20')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{svc.name}</p>
                      <span className={clsx('text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0', isManual ? 'bg-blue-500/10 text-blue-400' : 'bg-white/[0.05] text-white/55')}>{isManual ? 'Extern' : 'Docker'}</span>
                      {svc.category && <span className="text-[11px] text-white/50 truncate">{svc.category}</span>}
                    </div>
                    {svc.url && <p className="text-[12px] text-white/50 font-mono truncate">{svc.url}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {svc.url && <a href={svc.url} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-white/50 hover:text-white/70 hover:bg-white/[0.06] transition-all"><ExternalLink className="w-3.5 h-3.5" /></a>}
                    {!isManual && (
                      <button onClick={() => serviceHideMutation.mutate(svc)} disabled={serviceHideMutation.isPending} title={svc.hidden ? 'Einblenden' : 'Verstecken'} className="p-1.5 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-all">
                        {svc.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    {isManual && (
                      <button onClick={() => serviceDeleteMutation.mutate(svc.id)} className="p-1.5 rounded-lg text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </GlassCard>
      {/* Externen Dienst hinzufügen */}
      <Modal isOpen={showServiceModal} onClose={() => setShowServiceModal(false)} title="Externen Dienst überwachen" size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/55 block mb-1.5">Name</label>
            <input className="glass-input w-full" placeholder="z.B. Meine Webseite" value={serviceForm.name} onChange={e => setServiceForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-white/55 block mb-1.5">URL</label>
            <input className="glass-input w-full" placeholder="https://..." value={serviceForm.url} onChange={e => setServiceForm(f => ({ ...f, url: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-white/55 block mb-1.5">Kategorie</label>
            <input className="glass-input w-full" placeholder="Extern" value={serviceForm.category} onChange={e => setServiceForm(f => ({ ...f, category: e.target.value }))} />
          </div>
          <p className="text-[12px] text-white/50">Wird alle 60s per HTTP geprüft und erscheint auf der Status-Seite unter {servers.find(s => s.id === selectedSvcServer)?.name || selectedSvcServer}.</p>
          <button onClick={() => serviceAddMutation.mutate()} disabled={!serviceForm.name || !serviceForm.url || serviceAddMutation.isPending} className="btn-primary w-full disabled:opacity-40 flex items-center justify-center gap-2">
            {serviceAddMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Hinzufügen
          </button>
        </div>
      </Modal>
    </>
  );
}
