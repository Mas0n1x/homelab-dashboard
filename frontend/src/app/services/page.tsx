'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Plus, Trash2, Zap, BarChart3, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { ServiceDetail } from '@/components/services/ServiceDetail';
import { getIcon } from '@/lib/constants';
import { useServerStore } from '@/stores/serverStore';
import * as api from '@/lib/api';
import type { Service, Favorite } from '@/lib/types';

export default function ServicesPage() {
  const { activeServerId } = useServerStore();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', url: '', icon: 'link', description: '', category: 'Extern' });

  const { data: favorites } = useQuery<Favorite[]>({
    queryKey: ['favorites', activeServerId],
    queryFn: () => api.getFavorites(activeServerId) as Promise<Favorite[]>,
    staleTime: 30000,
  });

  const favoriteIds = new Set(favorites?.map(f => f.service_id) || []);

  const favMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      if (favoriteIds.has(serviceId)) {
        await api.removeFavorite(serviceId, activeServerId);
      } else {
        await api.addFavorite(serviceId, activeServerId);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  });

  const { data } = useQuery({
    queryKey: ['services', activeServerId],
    queryFn: () => api.getServices(activeServerId),
    refetchInterval: 30000,
  });

  const { data: serviceStatus } = useQuery<any[]>({
    queryKey: ['serviceStatus', activeServerId],
    enabled: false,
  });

  const services: Service[] = (data as any)?.services || [];

  const statusMap = new Map(serviceStatus?.map(s => [s.serviceId, s]) || []);

  const addMutation = useMutation({
    mutationFn: (data: typeof form) => api.addService(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setShowAddModal(false);
      setForm({ name: '', url: '', icon: 'link', description: '', category: 'Extern' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteService(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] }),
  });

  // Group by category
  const categories = new Map<string, Service[]>();
  services.forEach(s => {
    const cat = s.category || 'Allgemein';
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Services</h1>
          <p className="text-sm text-white/40 mt-0.5">{services.length} Services konfiguriert</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Service hinzufügen
        </button>
      </div>

      {Array.from(categories.entries()).map(([category, catServices]) => (
        <div key={category}>
          <h2 className="text-sm font-medium text-white/40 mb-3 uppercase tracking-wider">{category}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {catServices.map((service, i) => {
              const Icon = getIcon(service.icon);
              const status = statusMap.get(service.id);
              const isOnline = status?.online ?? (service.state === 'running');
              const uptime24 = service.uptime?.uptime24h;
              const isExpanded = expandedService === service.id;

              return (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div className="glass-card glass-card-hover p-4 group flex flex-col">
                    <div className="relative z-10 flex flex-col">
                      <div className="flex items-start justify-between mb-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isOnline ? 'bg-accent/10' : 'bg-red-500/10'}`}>
                          <Icon className={`w-5 h-5 ${isOnline ? 'text-accent-light' : 'text-red-400'}`} />
                        </div>
                        <div className="flex items-center gap-2">
                          {service.source === 'docker' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                              <Zap className="w-2.5 h-2.5 inline mr-0.5" />Auto
                            </span>
                          )}
                          <span className="relative flex h-2.5 w-2.5">
                            {isOnline && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />}
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOnline ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          </span>
                        </div>
                      </div>

                      <h3 className="text-sm font-semibold mb-1">{service.name}</h3>
                      {service.description && (
                        <p className="text-xs text-white/40 mb-3 line-clamp-2">{service.description}</p>
                      )}

                      <div className="pt-3 border-t border-white/[0.04] flex items-center justify-between">
                        <button
                          onClick={() => setExpandedService(isExpanded ? null : service.id)}
                          className={`flex items-center gap-1 text-xs font-mono transition-colors ${
                            isExpanded ? 'text-accent-light' : uptime24 !== null && uptime24 !== undefined
                              ? uptime24 >= 99 ? 'text-emerald-400 hover:text-emerald-300' : uptime24 >= 90 ? 'text-amber-400 hover:text-amber-300' : 'text-red-400 hover:text-red-300'
                              : 'text-white/20 hover:text-white/40'
                          }`}
                        >
                          <BarChart3 className="w-3 h-3" />
                          {uptime24 !== null && uptime24 !== undefined ? `${uptime24}%` : '--'}
                        </button>

                        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => favMutation.mutate(service.id)}
                            className={`p-1.5 rounded-lg transition-all ${favoriteIds.has(service.id) ? 'text-amber-400 hover:bg-amber-500/10' : 'text-white/30 hover:text-amber-400 hover:bg-amber-500/10'}`}
                            title={favoriteIds.has(service.id) ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
                          >
                            <Star className={`w-3.5 h-3.5 ${favoriteIds.has(service.id) ? 'fill-current' : ''}`} />
                          </button>
                          {service.url && (
                            <a
                              href={service.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-white/80 transition-all"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {service.source === 'manual' && (
                            <button
                              onClick={() => deleteMutation.mutate(service.id)}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Service Detail (expandable: resources + uptime) */}
                      <AnimatePresence>
                        {isExpanded && (
                          <ServiceDetail service={service} />
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Add Service Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Service hinzufügen" size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/40 block mb-1.5">Name</label>
            <input className="glass-input w-full" placeholder="Service Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1.5">URL</label>
            <input className="glass-input w-full" placeholder="https://..." value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1.5">Beschreibung</label>
            <input className="glass-input w-full" placeholder="Optionale Beschreibung" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 block mb-1.5">Icon</label>
              <select className="glass-input w-full" value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}>
                {['link', 'monitor', 'shield', 'server', 'database', 'cloud', 'storage', 'globe', 'terminal', 'file', 'video', 'lock'].map(icon => (
                  <option key={icon} value={icon}>{icon}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-white/40 block mb-1.5">Kategorie</label>
              <input className="glass-input w-full" placeholder="Kategorie" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
            </div>
          </div>
          <button
            onClick={() => addMutation.mutate(form)}
            disabled={!form.name || !form.url || addMutation.isPending}
            className="btn-primary w-full disabled:opacity-40"
          >
            {addMutation.isPending ? 'Wird hinzugefügt...' : 'Hinzufügen'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
