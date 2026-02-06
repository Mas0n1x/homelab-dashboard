'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, RefreshCw, Check, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import * as api from '@/lib/api';
import type { ImageUpdate } from '@/lib/types';

export function ImageUpdates() {
  const queryClient = useQueryClient();
  const [checking, setChecking] = useState(false);

  const { data: updates } = useQuery<ImageUpdate[]>({
    queryKey: ['image-updates'],
    queryFn: async () => {
      setChecking(true);
      try {
        return await api.checkImageUpdates() as ImageUpdate[];
      } finally {
        setChecking(false);
      }
    },
    staleTime: 300000, // 5 min
    enabled: false,
  });

  const pullMutation = useMutation({
    mutationFn: (containerId: string) => api.pullAndRecreate(containerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['image-updates'] }),
  });

  const handleCheck = async () => {
    setChecking(true);
    try {
      const result = await api.checkImageUpdates();
      queryClient.setQueryData(['image-updates'], result);
    } finally {
      setChecking(false);
    }
  };

  return (
    <GlassCard delay={0.15}>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-white/40" />
            <span className="text-sm font-medium">Image Updates</span>
            {updates && updates.length > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                {updates.length}
              </span>
            )}
          </div>
          <button
            onClick={handleCheck}
            disabled={checking}
            className="btn-glass text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-40"
          >
            {checking ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Prüfen
          </button>
        </div>

        {!updates && !checking && (
          <p className="text-xs text-white/30 text-center py-4">Klicke &quot;Prüfen&quot; um nach Updates zu suchen</p>
        )}

        {checking && (
          <div className="flex items-center justify-center gap-2 py-4">
            <Loader2 className="w-4 h-4 animate-spin text-white/40" />
            <span className="text-xs text-white/40">Prüfe Images...</span>
          </div>
        )}

        {updates && updates.length === 0 && !checking && (
          <div className="flex items-center justify-center gap-2 py-4">
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-emerald-400">Alle Images aktuell</span>
          </div>
        )}

        {updates && updates.length > 0 && (
          <div className="space-y-2">
            {updates.map((u, i) => (
              <motion.div
                key={u.containerId}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-amber-500/[0.04] border border-amber-500/10"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{u.containerName}</p>
                  <p className="text-xs text-white/30 font-mono truncate">{u.image}</p>
                </div>
                <button
                  onClick={() => pullMutation.mutate(u.containerId)}
                  disabled={pullMutation.isPending}
                  className="btn-glass text-xs px-2.5 py-1 text-amber-400 hover:bg-amber-500/10 flex items-center gap-1 flex-shrink-0 ml-2"
                >
                  {pullMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                  Update
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
