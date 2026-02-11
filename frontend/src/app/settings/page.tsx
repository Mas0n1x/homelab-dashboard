'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Plus, Trash2, TestTube, Check, Loader2, Settings, Shield, AlertTriangle, Lock, ScrollText, Database, Archive } from 'lucide-react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/authStore';
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
  const router = useRouter();
  const { setupCompleted, logout, refreshToken } = useAuthStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [form, setForm] = useState({ type: 'discord' as 'discord' | 'telegram', name: '', webhookUrl: '', events: ['container_crash', 'service_offline'] });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const handleChangePassword = async () => {
    setPwError('');
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError('Passwörter stimmen nicht überein');
      return;
    }
    if (pwForm.newPassword.length < 6) {
      setPwError('Passwort muss mindestens 6 Zeichen lang sein');
      return;
    }
    setPwLoading(true);
    try {
      await api.changePassword(pwForm.currentPassword, pwForm.newPassword);
      setPwSuccess(true);
      setTimeout(async () => {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });
        } catch {}
        logout();
        router.replace('/login');
      }, 1500);
    } catch (err: any) {
      setPwError(err.message?.includes('401') ? 'Aktuelles Passwort ist falsch' : 'Fehler beim Ändern des Passworts');
    } finally {
      setPwLoading(false);
    }
  };

  const { data: channels } = useQuery<AlertChannel[]>({
    queryKey: ['alert-channels'],
    queryFn: () => api.getAlertChannels() as Promise<AlertChannel[]>,
  });

  const { data: history } = useQuery<any[]>({
    queryKey: ['alert-history'],
    queryFn: () => api.getAlertHistory(20) as Promise<any[]>,
  });

  const { data: auditLog } = useQuery<any[]>({
    queryKey: ['audit-log'],
    queryFn: () => api.getAuditLog(50) as Promise<any[]>,
  });

  const { data: backups } = useQuery<any[]>({
    queryKey: ['backups'],
    queryFn: () => api.getBackups() as Promise<any[]>,
  });

  const { data: backupStatus } = useQuery<{ running: boolean; latest: any }>({
    queryKey: ['backup-status'],
    queryFn: () => api.getBackupStatus(),
    refetchInterval: backups?.some((b: any) => b.status === 'running') ? 2000 : false,
  });

  const backupMutation = useMutation({
    mutationFn: (type: string) => api.runBackup(type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      queryClient.invalidateQueries({ queryKey: ['backup-status'] });
    },
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

      {/* Default Password Warning */}
      {!setupCompleted && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20"
        >
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">Standard-Passwort aktiv</p>
            <p className="text-xs text-amber-400/60 mt-0.5">Bitte ändere das Standard-Passwort (admin/admin) bevor du das Dashboard öffentlich erreichbar machst.</p>
          </div>
        </motion.div>
      )}

      {/* Security / Password Change */}
      <div>
        <h2 className="text-sm font-medium flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-indigo-400" />
          Sicherheit
        </h2>
        <GlassCard>
          <div className="relative z-10 space-y-4">
            <div>
              <label className="text-xs text-white/40 block mb-1.5">Aktuelles Passwort</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="password"
                  className="glass-input w-full pl-10"
                  value={pwForm.currentPassword}
                  onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
                  placeholder="Aktuelles Passwort"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/40 block mb-1.5">Neues Passwort</label>
                <input
                  type="password"
                  className="glass-input w-full"
                  value={pwForm.newPassword}
                  onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                  placeholder="Min. 6 Zeichen"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1.5">Passwort bestätigen</label>
                <input
                  type="password"
                  className="glass-input w-full"
                  value={pwForm.confirmPassword}
                  onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
                  placeholder="Passwort wiederholen"
                />
              </div>
            </div>
            {pwError && (
              <p className="text-xs text-red-400">{pwError}</p>
            )}
            {pwSuccess && (
              <p className="text-xs text-emerald-400">Passwort geändert! Du wirst abgemeldet...</p>
            )}
            <button
              onClick={handleChangePassword}
              disabled={!pwForm.currentPassword || !pwForm.newPassword || !pwForm.confirmPassword || pwLoading}
              className="btn-primary disabled:opacity-40 flex items-center gap-2 text-xs"
            >
              {pwLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
              {pwLoading ? 'Wird geändert...' : 'Passwort ändern'}
            </button>
          </div>
        </GlassCard>
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
                  <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${channel.type === 'discord' ? 'bg-indigo-500/10' : 'bg-blue-500/10'}`}>
                        <span className="text-lg">{channel.type === 'discord' ? '💬' : '📨'}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{channel.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-white/30 capitalize">{channel.type}</span>
                          <span className="text-xs text-white/20">|</span>
                          <div className="flex gap-1 flex-wrap">
                            {channel.events.map(e => (
                              <span key={e} className="text-xs px-1.5 py-0.5 rounded bg-white/[0.04] text-white/40">
                                {EVENT_OPTIONS.find(o => o.id === e)?.icon} {EVENT_OPTIONS.find(o => o.id === e)?.label || e}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
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
                <div key={h.id || i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-1.5 text-xs gap-1 sm:gap-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white/20">{h.channel_name}</span>
                    <span className="text-white/40">{h.event_type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/50 truncate max-w-[200px]">{h.message}</span>
                    <span className="text-white/20 flex-shrink-0">{new Date(h.sent_at + 'Z').toLocaleString('de-DE')}</span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* Backups */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium flex items-center gap-2">
            <Archive className="w-4 h-4 text-emerald-400" />
            Backups
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => backupMutation.mutate('database')}
              disabled={backupMutation.isPending || backupStatus?.running}
              className="btn-primary flex items-center gap-2 text-xs disabled:opacity-40"
            >
              {backupMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
              Datenbank
            </button>
            <button
              onClick={() => backupMutation.mutate('full')}
              disabled={backupMutation.isPending || backupStatus?.running}
              className="btn-glass flex items-center gap-2 text-xs disabled:opacity-40"
            >
              {backupMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
              Vollständig
            </button>
          </div>
        </div>
        <GlassCard>
          <div className="relative z-10">
            {(!backups || backups.length === 0) ? (
              <p className="text-sm text-white/30 text-center py-6">Noch keine Backups erstellt</p>
            ) : (
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {backups.map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-white/[0.02] text-xs">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded ${
                        b.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                        b.status === 'running' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-red-500/10 text-red-400'
                      }`}>
                        {b.status === 'completed' ? 'OK' : b.status === 'running' ? 'Läuft...' : 'Fehler'}
                      </span>
                      <span className="text-white/50 capitalize">{b.type}</span>
                      {b.size && <span className="text-white/25">{(b.size / 1024 / 1024).toFixed(1)} MB</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {b.error && <span className="text-red-400 truncate max-w-[150px]">{b.error}</span>}
                      <span className="text-white/20">{new Date(b.started_at + 'Z').toLocaleString('de-DE')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Audit Log */}
      <div>
        <h2 className="text-sm font-medium flex items-center gap-2 mb-3">
          <ScrollText className="w-4 h-4 text-cyan-400" />
          Audit Log
        </h2>
        <GlassCard>
          <div className="relative z-10">
            {(!auditLog || auditLog.length === 0) ? (
              <p className="text-sm text-white/30 text-center py-6">Noch keine Audit-Einträge</p>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {auditLog.map((entry: any) => (
                  <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 px-2 rounded-lg hover:bg-white/[0.02] text-xs gap-1 sm:gap-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`px-2 py-0.5 rounded font-mono ${
                        entry.action.startsWith('container.') ? 'bg-cyan-500/10 text-cyan-400' :
                        entry.action.startsWith('auth.') ? 'bg-indigo-500/10 text-indigo-400' :
                        entry.action.startsWith('service.') ? 'bg-emerald-500/10 text-emerald-400' :
                        'bg-white/[0.06] text-white/50'
                      }`}>{entry.action}</span>
                      {entry.target && <span className="text-white/40">{entry.target}</span>}
                      {entry.details && <span className="text-white/25 truncate max-w-[200px]">{entry.details}</span>}
                    </div>
                    <span className="text-white/20 flex-shrink-0 sm:ml-3">
                      {new Date(entry.created_at + 'Z').toLocaleString('de-DE')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>
      </div>

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
