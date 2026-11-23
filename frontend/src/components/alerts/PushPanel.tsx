/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Smartphone, BellRing, Trash2, Send, Loader2 } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { usePush } from '@/hooks/usePush';
import * as api from '@/lib/api';

interface Channel { id: string; type: string; name: string; enabled: boolean; endpoint?: string | null; events: string[] }

/** Push-Benachrichtigungen auf diesem Gerät (PWA) und die Liste aller angemeldeten Geräte. */
export function PushPanel() {
  const qc = useQueryClient();
  const push = usePush();
  const { data } = useQuery<Channel[]>({ queryKey: ['alert-channels'], queryFn: api.getAlertChannels as () => Promise<Channel[]> });
  const geraete = (data ?? []).filter(c => c.type === 'webpush');
  const neu = () => qc.invalidateQueries({ queryKey: ['alert-channels'] });

  const aktivieren = useMutation({ mutationFn: push.enable, onSuccess: neu });
  const entfernen = useMutation({
    mutationFn: async (c: Channel) => {
      if (c.endpoint && c.endpoint === push.endpoint) await push.disable();
      await api.deleteAlertChannel(c.id);
    },
    onSuccess: neu,
  });
  const test = useMutation({ mutationFn: (id: string) => api.testAlertChannel(id) });

  const hinweis: Record<string, string> = {
    unsupported: 'Dieser Browser unterstützt keine Push-Nachrichten. Auf dem iPhone zuerst „Zum Home-Bildschirm" hinzufügen und die App von dort öffnen.',
    blocked: 'Benachrichtigungen sind für diese Seite blockiert. In den Browser-Einstellungen der Seite wieder erlauben.',
  };

  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-1">
        <Smartphone className="w-4 h-4 text-emerald-300" />
        <h2 className="text-sm font-semibold">Push auf dem Handy</h2>
      </div>
      <p className="text-[12px] text-white/55 mb-4">Alarme als Benachrichtigung auf dem Gerät — auch bei geschlossenem Dashboard. Installiere die Seite dazu über „Zum Startbildschirm hinzufügen".</p>

      {hinweis[push.state] ? (
        <p className="text-[13px] text-amber-200/90 bg-amber-500/[0.08] border border-amber-500/20 rounded-xl px-3 py-2.5 mb-4">{hinweis[push.state]}</p>
      ) : push.state === 'on' ? (
        <p className="text-[13px] text-emerald-300 flex items-center gap-2 mb-4"><BellRing className="w-4 h-4" /> Dieses Gerät erhält Push-Nachrichten.</p>
      ) : (
        <button
          onClick={() => aktivieren.mutate()} disabled={push.state === 'working'}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-accent/20 border border-accent/30 text-accent-light text-[13px] font-medium hover:bg-accent/30 transition-colors disabled:opacity-50 mb-4"
        >{push.state === 'working' ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />} Auf diesem Gerät aktivieren</button>
      )}
      {push.error && <p role="alert" className="text-[12px] text-red-300 mb-3">{push.error}</p>}

      {geraete.length > 0 && (
        <ul className="space-y-1.5">
          {geraete.map(c => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <Smartphone className="w-4 h-4 text-white/55 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium truncate">{c.name}{c.endpoint && c.endpoint === push.endpoint && <span className="ml-2 text-[11px] text-emerald-300">dieses Gerät</span>}</p>
                <p className="text-[12px] text-white/55 truncate">{c.events.length} Ereignisse{c.enabled ? '' : ' · pausiert'}</p>
              </div>
              <button onClick={() => test.mutate(c.id)} aria-label={`Testnachricht an ${c.name}`} title="Testnachricht senden" className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/[0.08] transition-colors"><Send className="w-3.5 h-3.5" /></button>
              <button onClick={() => entfernen.mutate(c)} aria-label={`${c.name} abmelden`} title="Gerät entfernen" className="p-1.5 rounded-lg text-white/60 hover:text-red-300 hover:bg-white/[0.08] transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      {test.isSuccess && <p role="status" className="text-[12px] text-emerald-300 mt-2">Testnachricht gesendet.</p>}
    </GlassCard>
  );
}
