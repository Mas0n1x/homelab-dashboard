'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Plus, Trash2, TestTube, Check, Loader2, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { Modal } from '@/components/ui/Modal';
import * as api from '@/lib/api';
import type { AlertChannel } from '@/lib/types';

const EVENT_OPTIONS = [
  { id: 'cpu_high', label: 'CPU > 90%', icon: '🔥' },
  { id: 'ram_high', label: 'RAM > 90%', icon: '💾' },
  { id: 'container_crash', label: 'Container gestoppt', icon: '💀' },
  { id: 'service_offline', label: 'Service offline', icon: '🔴' },
  { id: 'new_portfolio_request', label: 'Neue Anfrage', icon: '📩' },
  { id: 'new_portfolio_customer', label: 'Neuer Kunde', icon: '👤' },
];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [form, setForm] = useState({ type: 'discord' as 'discord' | 'telegram', name: '', webhookUrl: '', events: ['container_crash', 'service_offline'] });

  const { data: channels } = useQuery<AlertChannel[]>({
    queryKey: ['alert-channels'],
    queryFn: () => api.getAlertChannels() as Promise<AlertChannel[]>,
  });

  const { data: history } = useQuery<any[]>({
    queryKey: ['alert-history'],
    queryFn: () => api.getAlertHistory(20) as Promise<any[]>,
  });

  const addMutation = useMutation({
    mutationFn: () => api.addAlertChannel(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-channels'] });
      setShowAddModal(false);
      setForm({ type: 'discord', name: '', webhookUrl: '', events: ['container_crash', 'service_offline'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAlertChannel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alert-channels'] }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => api.updateAlertChannel(id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alert-channels'] }),
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      setTestingId(id);
      try {
        return await api.testAlertChannel(id);
      } finally {
        setTestingId(null);
      }
    },
  });

  const toggleEvent = (eventId: string) => {
    setForm(f => ({
      ...f,
      events: f.events.includes(eventId)
        ? f.events.filter(e => e !== eventId)
        : [...f.events, eventId],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Settings className="w-5 h-5 text-white/50" />
            Einstellungen
          </h1>
          <p className="text-sm text-white/40 mt-0.5">Alerting & Benachrichtigungen</p>
        </div>
      </div>

      {/* Alert Channels */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            Benachrichtigungs-Kanäle
          </h2>
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 text-xs">
            <Plus className="w-3.5 h-3.5" />
            Kanal hinzufügen
          </button>
        </div>

        {(!channels || channels.length === 0) ? (
          <GlassCard>
            <div className="relative z-10 text-center py-8 text-white/30">
              <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Noch keine Benachrichtigungs-Kanäle konfiguriert</p>
              <p className="text-xs mt-1">Füge einen Discord oder Telegram Webhook hinzu</p>
            </div>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {channels.map((channel, i) => (
              <motion.div
                key={channel.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <GlassCard>
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${channel.type === 'discord' ? 'bg-indigo-500/10' : 'bg-blue-500/10'}`}>
                        <span className="text-lg">{channel.type === 'discord' ? '💬' : '📨'}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{channel.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-white/30 capitalize">{channel.type}</span>
                          <span className="text-xs text-white/20">|</span>
                          <div className="flex gap-1">
                            {channel.events.map(e => (
                              <span key={e} className="text-xs px-1.5 py-0.5 rounded bg-white/[0.04] text-white/40">
                                {EVENT_OPTIONS.find(o => o.id === e)?.icon} {EVENT_OPTIONS.find(o => o.id === e)?.label || e}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleMutation.mutate({ id: channel.id, enabled: !channel.enabled })}
                        className={`w-10 h-5 rounded-full transition-colors relative ${channel.enabled ? 'bg-emerald-500/30' : 'bg-white/10'}`}
                      >
                        <div className={`w-4 h-4 rounded-full absolute top-0.5 transition-all ${channel.enabled ? 'bg-emerald-400 left-5' : 'bg-white/30 left-0.5'}`} />
                      </button>

                      <button
                        onClick={() => testMutation.mutate(channel.id)}
                        disabled={testingId === channel.id}
                        className="btn-glass text-xs px-2 py-1 flex items-center gap-1"
                      >
                        {testingId === channel.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <TestTube className="w-3 h-3" />}
                        Test
                      </button>

                      <button
                        onClick={() => deleteMutation.mutate(channel.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Alert History */}
      {history && history.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-white/40 mb-3">Letzte Benachrichtigungen</h2>
          <GlassCard>
            <div className="relative z-10 space-y-2">
              {history.map((h: any, i: number) => (
                <div key={h.id || i} className="flex items-center justify-between py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-white/20">{h.channel_name}</span>
                    <span className="text-white/40">{h.event_type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/50 truncate max-w-[200px]">{h.message}</span>
                    <span className="text-white/20">{new Date(h.sent_at + 'Z').toLocaleString('de-DE')}</span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* Add Channel Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Kanal hinzufügen" size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/40 block mb-1.5">Typ</label>
            <div className="flex gap-2">
              {(['discord', 'telegram'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setForm(f => ({ ...f, type }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${form.type === type ? 'bg-accent/20 border border-accent/30 text-accent-light' : 'bg-white/[0.03] border border-white/10 text-white/40'}`}
                >
                  {type === 'discord' ? '💬 Discord' : '📨 Telegram'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1.5">Name</label>
            <input className="glass-input w-full" placeholder="z.B. Server Alerts" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1.5">Webhook URL</label>
            <input className="glass-input w-full" placeholder={form.type === 'discord' ? 'https://discord.com/api/webhooks/...' : 'https://api.telegram.org/bot.../sendMessage'} value={form.webhookUrl} onChange={e => setForm(f => ({ ...f, webhookUrl: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1.5">Events</label>
            <div className="grid grid-cols-2 gap-2">
              {EVENT_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => toggleEvent(opt.id)}
                  className={`py-2 px-3 rounded-xl text-xs text-left transition-all ${form.events.includes(opt.id) ? 'bg-accent/15 border border-accent/25 text-white/80' : 'bg-white/[0.03] border border-white/10 text-white/40'}`}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => addMutation.mutate()}
            disabled={!form.name || !form.webhookUrl || form.events.length === 0 || addMutation.isPending}
            className="btn-primary w-full disabled:opacity-40"
          >
            {addMutation.isPending ? 'Wird hinzugefügt...' : 'Hinzufügen'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
