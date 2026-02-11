'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getIcon } from '@/lib/constants';
import { useServerStore } from '@/stores/serverStore';
import * as api from '@/lib/api';
import type { Favorite, Service } from '@/lib/types';

export function FavoritesBar() {
  const { activeServerId } = useServerStore();
  const queryClient = useQueryClient();

  const { data: favorites } = useQuery<Favorite[]>({
    queryKey: ['favorites', activeServerId],
    queryFn: () => api.getFavorites(activeServerId) as Promise<Favorite[]>,
    staleTime: 30000,
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services', activeServerId],
    queryFn: () => api.getServices(activeServerId),
    staleTime: 30000,
  });

  const { data: serviceStatus } = useQuery<any[]>({
    queryKey: ['serviceStatus', activeServerId],
    enabled: false,
  });

  const removeMutation = useMutation({
    mutationFn: (serviceId: string) => api.removeFavorite(serviceId, activeServerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  });

  const services: Service[] = (servicesData as any)?.services || [];
  const statusMap = new Map(serviceStatus?.map(s => [s.serviceId, s]) || []);
  const favoriteIds = new Set(favorites?.map(f => f.service_id) || []);

  const favoriteServices = services
    .filter(s => favoriteIds.has(s.id))
    .sort((a, b) => {
      const aOrder = favorites?.find(f => f.service_id === a.id)?.sort_order ?? 999;
      const bOrder = favorites?.find(f => f.service_id === b.id)?.sort_order ?? 999;
      return aOrder - bOrder;
    });

  if (favoriteServices.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-xs font-medium text-white/30 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Star className="w-3 h-3" />
        Favoriten
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        <AnimatePresence>
          {favoriteServices.map((service, i) => {
            const Icon = getIcon(service.icon);
            const status = statusMap.get(service.id);
            const isOnline = status?.online ?? (service.state === 'running');

            return (
              <motion.a
                key={service.id}
                href={service.url || '#'}
                target={service.url ? '_blank' : undefined}
                rel="noopener noreferrer"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card glass-card-hover flex items-center gap-3 px-4 py-3 min-w-[180px] group"
              >
                <div className="relative z-10 flex items-center gap-3 w-full">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isOnline ? 'bg-accent/10' : 'bg-red-500/10'}`}>
                    <Icon className={`w-4 h-4 ${isOnline ? 'text-accent-light' : 'text-red-400'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{service.name}</p>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      <span className="text-xs text-white/30">{isOnline ? 'Online' : 'Offline'}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    {service.url && <ExternalLink className="w-3.5 h-3.5 text-white/30" />}
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeMutation.mutate(service.id); }}
                      className="p-0.5 hover:text-amber-400 text-white/20 transition-colors"
                    >
                      <Star className="w-3.5 h-3.5 fill-current" />
                    </button>
                  </div>
                </div>
              </motion.a>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
