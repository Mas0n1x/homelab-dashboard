/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Plus, Trash2, TestTube, Loader2, AlertTriangle, ScrollText, Server } from 'lucide-react';
import { clsx } from 'clsx';
import { GlassCard } from '@/components/ui/GlassCard';
import { Modal } from '@/components/ui/Modal';
import * as api from '@/lib/api';
import type { AlertChannel } from '@/lib/types';
import { SectionHeader, Toggle } from './ui';
import { EVENT_OPTIONS } from './events';

export function AlertsTab() {
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

  // Alert-Schwellen (konfigurierbar)
  const { data: thresholds } = useQuery({ queryKey: ['alertThresholds'], queryFn: () => api.getAlertThresholds() });
  const [thForm, setThForm] = useState<{ cpu: number; ram: number; disk: number; temp: number } | null>(null);
  const th = thForm ?? thresholds ?? { cpu: 90, ram: 90, disk: 90, temp: 75 };
  const thMutation = useMutation({
    mutationFn: () => api.setAlertThresholds(th),
    onSuccess: (d: any) => { queryClient.setQueryData(['alertThresholds'], d); setThForm(null); queryClient.invalidateQueries({ queryKey: ['alertThresholds'] }); },
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
    <>
        <GlassCard>
          <div className="relative z-10">
            <SectionHeader
              icon={AlertTriangle}
              tint="bg-amber-500/10 border-amber-500/20 text-amber-400"
              title="Schwellenwerte"
              desc="Ab wann Alarme feuern und die Server-Karten rot werden"
              action={
                <button onClick={() => thMutation.mutate()} disabled={thMutation.isPending} className="btn-primary text-xs flex items-center gap-1.5">
                  {thMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Speichern
                </button>
              }
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { key: 'cpu', label: 'CPU', unit: '%' },
                { key: 'ram', label: 'RAM', unit: '%' },
                { key: 'disk', label: 'Speicher', unit: '%' },
                { key: 'temp', label: 'Temperatur', unit: '°C' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-white/55 block mb-1.5">{f.label} <span className="text-white/50">&gt; {f.unit}</span></label>
                  <input type="number" className="glass-input w-full" value={(th as any)[f.key]} onChange={e => setThForm({ ...th, [f.key]: Number(e.target.value) })} />
                </div>
              ))}
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="relative z-10">
            <SectionHeader
              icon={Bell}
              tint="bg-amber-500/10 border-amber-500/20 text-amber-400"
              title="Benachrichtigungs-Kanäle"
              desc="Discord- oder Telegram-Webhooks für Alarme"
              action={
                <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Kanal hinzufügen
                </button>
              }
            />
            {(!channels || channels.length === 0) ? (
              <div className="text-center py-10 text-white/50">
                <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Noch keine Benachrichtigungs-Kanäle konfiguriert</p>
                <p className="text-xs mt-1">Füge einen Discord- oder Telegram-Webhook hinzu</p>
              </div>
            ) : (
              <div className="space-y-2">
                {channels.map(channel => (
                  <div key={channel.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.015] px-3 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', channel.type === 'discord' ? 'bg-indigo-500/10' : (channel.type as string) === 'webpush' ? 'bg-emerald-500/10' : 'bg-blue-500/10')}>
                        <span className="text-lg">{channel.type === 'discord' ? '💬' : (channel.type as string) === 'webpush' ? '📱' : '📨'}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{channel.name}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {channel.events.slice(0, 4).map(e => (
                            <span key={e} className="text-[11px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/55">
                              {EVENT_OPTIONS.find(o => o.id === e)?.icon} {EVENT_OPTIONS.find(o => o.id === e)?.label || e}
                            </span>
                          ))}
                          {channel.events.length > 4 && <span className="text-[11px] text-white/50">+{channel.events.length - 4}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                      <Toggle on={channel.enabled} onClick={() => toggleMutation.mutate({ id: channel.id, enabled: !channel.enabled })} />
                      <button onClick={() => testMutation.mutate(channel.id)} disabled={testingId === channel.id} className="btn-glass text-xs px-2.5 py-1.5 flex items-center gap-1">
                        {testingId === channel.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <TestTube className="w-3 h-3" />} Test
                      </button>
                      <button onClick={() => deleteMutation.mutate(channel.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/50 hover:text-red-400 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>

        {history && history.length > 0 && (
          <GlassCard>
            <div className="relative z-10">
              <SectionHeader icon={ScrollText} tint="bg-white/[0.05] border-white/10 text-white/65" title="Letzte Benachrichtigungen" desc="Verlauf gesendeter Alarme" />
              <div className="space-y-1">
                {history.map((h: any, i: number) => (
                  <div key={h.id || i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 px-2 rounded-lg hover:bg-white/[0.02] text-xs gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white/50">{h.channel_name}</span>
                      <span className="text-white/60 font-mono">{h.event_type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white/65 truncate max-w-[200px]">{h.message}</span>
                      <span className="text-white/50 flex-shrink-0">{new Date(h.sent_at + 'Z').toLocaleString('de-DE')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        )}
      {/* Add Channel Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Kanal hinzufügen" size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/55 block mb-1.5">Typ</label>
            <div className="flex gap-2">
              {(['discord', 'telegram'] as const).map(type => (
                <button key={type} onClick={() => setForm(f => ({ ...f, type }))} className={clsx('flex-1 py-2 rounded-xl text-sm font-medium transition-all', form.type === type ? 'bg-accent/20 border border-accent/30 text-accent-light' : 'bg-white/[0.03] border border-white/10 text-white/55')}>
                  {type === 'discord' ? '💬 Discord' : '📨 Telegram'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-white/55 block mb-1.5">Name</label>
            <input className="glass-input w-full" placeholder="z.B. Server Alerts" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-white/55 block mb-1.5">Webhook URL</label>
            <input className="glass-input w-full" placeholder={form.type === 'discord' ? 'https://discord.com/api/webhooks/...' : 'https://api.telegram.org/bot.../sendMessage'} value={form.webhookUrl} onChange={e => setForm(f => ({ ...f, webhookUrl: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-white/55 block mb-1.5">Events</label>
            <div className="grid grid-cols-2 gap-2 max-h-[240px] overflow-y-auto">
              {EVENT_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => toggleEvent(opt.id)} className={clsx('py-2 px-3 rounded-xl text-xs text-left transition-all', form.events.includes(opt.id) ? 'bg-accent/15 border border-accent/25 text-white/80' : 'bg-white/[0.03] border border-white/10 text-white/55')}>
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => addMutation.mutate()} disabled={!form.name || !form.webhookUrl || form.events.length === 0 || addMutation.isPending} className="btn-primary w-full disabled:opacity-40">
            {addMutation.isPending ? 'Wird hinzugefügt...' : 'Hinzufügen'}
          </button>
        </div>
      </Modal>
    </>
  );
}
