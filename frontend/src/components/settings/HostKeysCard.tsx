/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { GlassCard } from '@/components/ui/GlassCard';
import * as api from '@/lib/api';
import { SectionHeader } from './ui';

export function HostKeysCard() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['hostKeys'], queryFn: api.getHostKeys, refetchInterval: 30000 });

  const annehmen = useMutation({
    mutationFn: (k: { host: string; port: number; fingerprint: string }) => api.acceptHostKey(k.host, k.port, k.fingerprint),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hostKeys'] }),
  });

  const keys = data ?? [];

  return (
    <GlassCard>
      <SectionHeader
        icon={KeyRound}
        tint="bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
        title="SSH-Schlüssel"
        desc="Beim ersten Kontakt gemerkt. Ändert sich ein Schlüssel, ist der Server gesperrt."
      />
      {isLoading && <p className="text-xs text-white/50">Lade …</p>}
      {!isLoading && keys.length === 0 && <p className="text-xs text-white/50">Noch keine SSH-Verbindung aufgebaut.</p>}
      <div className="space-y-2">
        {keys.map(k => (
          <div
            key={`${k.host}:${k.port}`}
            className={clsx('rounded-xl border p-3', k.pending ? 'border-red-500/30 bg-red-500/[0.07]' : 'border-white/[0.06] bg-white/[0.02]')}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium truncate">{k.servers.join(', ') || k.host}</p>
              <span className={clsx('text-[11px] flex-shrink-0', k.pending ? 'text-red-400' : 'text-emerald-400')}>
                {k.pending ? 'geändert' : 'bestätigt'}
              </span>
            </div>
            <p className="text-[12px] text-white/50 mt-0.5 truncate">{k.host}:{k.port} · {k.keyType}</p>
            <p className="text-[12px] text-white/55 font-mono break-all mt-1">{k.fingerprint}</p>
            {k.pending && (
              <div className="mt-2 pt-2 border-t border-red-500/20 space-y-2">
                <p className="text-xs text-red-300">Neuer Schlüssel ({k.pending.keyType}):</p>
                <p className="text-[12px] text-red-200 font-mono break-all">{k.pending.fingerprint}</p>
                <p className="text-[12px] text-white/50">
                  Nur annehmen, wenn du den Server neu aufgesetzt hast. Vergleiche dort mit <span className="font-mono">ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub</span>.
                </p>
                <button
                  onClick={() => annehmen.mutate({ host: k.host, port: k.port, fingerprint: k.pending!.fingerprint })}
                  disabled={annehmen.isPending}
                  className="btn-glass py-1.5 px-3 text-xs flex items-center gap-2 disabled:opacity-40"
                >
                  {annehmen.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Neuen Schlüssel annehmen
                </button>
                {annehmen.isError && <p className="text-xs text-red-400">Annehmen fehlgeschlagen. Seite neu laden und erneut prüfen.</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
