/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Plus, Trash2, TestTube, Loader2, Settings, Shield, AlertTriangle, Lock, ScrollText, Database, Archive, Server, Download, Clock, Pencil, ChevronRight, LucideIcon, Boxes, Eye, EyeOff, ExternalLink, Palette, RotateCcw } from 'lucide-react';
import { ThemeSettings, ACCENT_PRESETS, DEFAULT_THEME, getStoredTheme, applyTheme, saveTheme, resetTheme } from '@/lib/theme';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { PageTransition } from '@/components/ui/PageTransition';
import { GlassCard } from '@/components/ui/GlassCard';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';
import * as api from '@/lib/api';
import type { AlertChannel } from '@/lib/types';

const EVENT_OPTIONS = [
  { id: 'cpu_high', label: 'CPU > 90%', icon: '🔥' },
  { id: 'ram_high', label: 'RAM > 90%', icon: '💾' },
  { id: 'disk_high', label: 'Speicher > 90%', icon: '🗄️' },
  { id: 'temp_high', label: 'Temperatur > 75°C', icon: '🌡️' },
  { id: 'container_crash', label: 'Container gestoppt', icon: '💀' },
  { id: 'container_restart', label: 'Container wieder aktiv', icon: '🟢' },
  { id: 'service_offline', label: 'Service offline', icon: '🔴' },
  { id: 'reboot', label: 'Neustart erkannt', icon: '🔄' },
  { id: 'status_report', label: 'Statusbericht (periodisch)', icon: '📊' },
  { id: 'new_portfolio_request', label: 'Neue Anfrage', icon: '📩' },
  { id: 'new_portfolio_customer', label: 'Neuer Kunde', icon: '👤' },
  { id: 'backup_completed', label: 'Backup erfolgreich', icon: '💾' },
  { id: 'backup_failed', label: 'Backup fehlgeschlagen', icon: '⚠️' },
];

const SETTINGS_TABS = [
  { id: 'fleet', label: 'Fleet', desc: 'Server & Verbindungen', icon: Server },
  { id: 'services', label: 'Dienste', desc: 'Überwachte Services', icon: Boxes },
  { id: 'appearance', label: 'Darstellung', desc: 'Aussehen & Effekte', icon: Palette },
  { id: 'alerts', label: 'Alerts', desc: 'Benachrichtigungen', icon: Bell },
  { id: 'backup', label: 'Backup', desc: 'Sicherung & Wiederherstellung', icon: Archive },
  { id: 'account', label: 'Account', desc: 'Sicherheit & Zugang', icon: Shield },
] as const;

type SettingsTab = typeof SETTINGS_TABS[number]['id'];

const EMPTY_SERVER = { name: '', host: '', glancesUrl: '', sshHost: '', sshPort: 22, sshUser: 'root', sshKeyPath: '/app/ssh/id_ed25519', provider: '', location: '', monthlyCost: '', currency: 'EUR', expiresAt: '', tunnelName: '', notes: '' };

// Einheitlicher Sektions-Kopf: Icon-Kachel + Titel + Beschreibung + optionale Aktion rechts.
function SectionHeader({ icon: Icon, tint, title, desc, action }: { icon: LucideIcon; tint: string; title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-center gap-3">
        <div className={clsx('w-9 h-9 rounded-xl flex items-center justify-center border', tint)}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold leading-tight">{title}</h2>
          {desc && <p className="text-xs text-white/35 mt-0.5">{desc}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// Einheitliche Einstellungs-Zeile: Label + Beschreibung links, Steuerung rechts.
function SettingRow({ title, desc, children, last }: { title: string; desc?: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={clsx('flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5', !last && 'border-b border-white/[0.05]')}>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {desc && <p className="text-xs text-white/35 mt-0.5">{desc}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ on, onClick, disabled }: { on?: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx('w-11 h-6 rounded-full transition-colors relative flex-shrink-0 disabled:opacity-40', on ? 'bg-emerald-500/30' : 'bg-white/10')}
    >
      <div className={clsx('w-5 h-5 rounded-full absolute top-0.5 transition-all', on ? 'bg-emerald-400 left-[22px]' : 'bg-white/40 left-0.5')} />
    </button>
  );
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { setupCompleted, logout, refreshToken } = useAuthStore();
  const { servers, setServers } = useServerStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('fleet');
  const [showAddModal, setShowAddModal] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [form, setForm] = useState({ type: 'discord' as 'discord' | 'telegram', name: '', webhookUrl: '', events: ['container_crash', 'service_offline'] });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // Server-Verwaltung
  const [showServerModal, setShowServerModal] = useState(false);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [serverForm, setServerForm] = useState({ ...EMPTY_SERVER });
  const [confirmDeleteServer, setConfirmDeleteServer] = useState<string | null>(null);

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

  const refreshServers = async () => {
    try {
      const s = await api.getServers();
      if (Array.isArray(s)) setServers(s as any);
    } catch { /* still */ }
  };

  const serverMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        name: serverForm.name,
        host: serverForm.host,
        glancesUrl: serverForm.glancesUrl || undefined,
        sshHost: serverForm.sshHost || undefined,
        sshPort: serverForm.sshPort || undefined,
        sshUser: serverForm.sshUser || undefined,
        sshKeyPath: serverForm.sshKeyPath || undefined,
      };
      if (editingServerId) {
        // Betriebs-Metadaten nur beim Bearbeiten (updateServer akzeptiert sie)
        payload.provider = serverForm.provider || null;
        payload.location = serverForm.location || null;
        payload.monthlyCost = serverForm.monthlyCost === '' ? null : Number(serverForm.monthlyCost);
        payload.currency = serverForm.currency || null;
        payload.expiresAt = serverForm.expiresAt || null;
        payload.tunnelName = serverForm.tunnelName || null;
        payload.notes = serverForm.notes || null;
        return api.updateServer(editingServerId, payload);
      }
      return api.addServer(payload as any);
    },
    onSuccess: async () => {
      await refreshServers();
      setShowServerModal(false);
      setEditingServerId(null);
      setServerForm({ ...EMPTY_SERVER });
    },
  });

  const serverDeleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteServer(id),
    onSuccess: async () => {
      await refreshServers();
      setConfirmDeleteServer(null);
    },
  });

  const openAddServer = () => {
    setEditingServerId(null);
    setServerForm({ ...EMPTY_SERVER });
    setShowServerModal(true);
  };
  const openEditServer = (s: any) => {
    setEditingServerId(s.id);
    setServerForm({
      name: s.name || '',
      host: s.host || '',
      glancesUrl: s.glances_url || '',
      sshHost: s.ssh_host || '',
      sshPort: s.ssh_port || 22,
      sshUser: s.ssh_user || 'root',
      sshKeyPath: s.ssh_key_path || '/app/ssh/id_ed25519',
      provider: s.provider || '',
      location: s.location || '',
      monthlyCost: s.monthly_cost != null ? String(s.monthly_cost) : '',
      currency: s.currency || 'EUR',
      expiresAt: s.expires_at ? String(s.expires_at).slice(0, 10) : '',
      tunnelName: s.tunnel_name || '',
      notes: s.notes || '',
    });
    setShowServerModal(true);
  };

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

  // Alert-Schwellen (konfigurierbar)
  const { data: thresholds } = useQuery({ queryKey: ['alertThresholds'], queryFn: () => api.getAlertThresholds() });
  const [thForm, setThForm] = useState<{ cpu: number; ram: number; disk: number; temp: number } | null>(null);
  const th = thForm ?? thresholds ?? { cpu: 90, ram: 90, disk: 90, temp: 75 };
  const thMutation = useMutation({
    mutationFn: () => api.setAlertThresholds(th),
    onSuccess: (d: any) => { queryClient.setQueryData(['alertThresholds'], d); setThForm(null); queryClient.invalidateQueries({ queryKey: ['alertThresholds'] }); },
  });

  // Darstellung / Theme
  const [theme, setThemeState] = useState<ThemeSettings>(DEFAULT_THEME);
  useEffect(() => { setThemeState(getStoredTheme()); }, []);
  const updateTheme = (partial: Partial<ThemeSettings>) => {
    const next = { ...theme, ...partial };
    setThemeState(next);
    applyTheme(next);
    saveTheme(next);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('theme-changed'));
  };
  const resetThemeAll = () => {
    setThemeState(DEFAULT_THEME);
    applyTheme(DEFAULT_THEME);
    resetTheme();
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('theme-changed'));
  };

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

  const { data: schedule } = useQuery<api.BackupSchedule>({
    queryKey: ['backup-schedule'],
    queryFn: () => api.getBackupSchedule(),
  });

  const scheduleMutation = useMutation({
    mutationFn: (cfg: Partial<api.BackupSchedule>) => api.setBackupSchedule(cfg),
    onSuccess: (data) => queryClient.setQueryData(['backup-schedule'], data),
  });

  const deleteBackupMutation = useMutation({
    mutationFn: (id: number) => api.deleteBackup(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backups'] }),
  });

  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const handleDownloadBackup = async (id: number) => {
    setDownloadingId(id);
    try {
      await api.downloadBackup(id);
    } catch {
      // Fehler bewusst still — der Button reaktiviert sich einfach wieder
    } finally {
      setDownloadingId(null);
    }
  };

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

  const statusMeta = (status: string) =>
    status === 'connected' ? { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', tile: 'text-emerald-400', label: 'Online' }
    : status === 'monitoring' ? { dot: 'bg-amber-400', text: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', tile: 'text-amber-400', label: 'Nur Monitoring' }
    : { dot: 'bg-red-400', text: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', tile: 'text-red-400', label: 'Offline' };

  const activeMeta = SETTINGS_TABS.find(t => t.id === activeTab)!;

  return (
    <PageTransition>
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Settings className="w-5 h-5 text-white/50" />
          Einstellungen
        </h1>
        <p className="text-sm text-white/40 mt-0.5">Fleet, Alerts, Backups & Account</p>
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

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Navigations-Leiste */}
        <nav className="lg:w-60 flex-shrink-0 flex lg:flex-col gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {SETTINGS_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all whitespace-nowrap lg:whitespace-normal border',
                  isActive
                    ? 'bg-accent/[0.12] border-accent/25 text-white'
                    : 'border-transparent text-white/45 hover:text-white/80 hover:bg-white/[0.03]'
                )}
              >
                <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors', isActive ? 'bg-accent/20 text-accent-light' : 'bg-white/[0.04] text-white/40 group-hover:text-white/70')}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 hidden lg:block">
                  <p className="text-sm font-medium leading-tight">{tab.label}</p>
                  <p className="text-[11px] text-white/30 mt-0.5 truncate">{tab.desc}</p>
                </div>
                <span className="text-sm font-medium lg:hidden">{tab.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 text-accent-light/60 ml-auto hidden lg:block" />}
              </button>
            );
          })}
        </nav>

        {/* Inhalt */}
        <div className="flex-1 min-w-0 space-y-6">
          <div className="lg:hidden">
            <h2 className="text-base font-semibold">{activeMeta.label}</h2>
            <p className="text-xs text-white/35">{activeMeta.desc}</p>
          </div>

          {/* Fleet Tab */}
          {activeTab === 'fleet' && (
            <GlassCard>
              <div className="relative z-10">
                <SectionHeader
                  icon={Server}
                  tint="bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  title="Konfigurierte Server"
                  desc={`${servers.length} ${servers.length === 1 ? 'Server' : 'Server'} in der Fleet`}
                  action={
                    <button onClick={openAddServer} className="btn-primary flex items-center gap-2 text-xs">
                      <Plus className="w-3.5 h-3.5" /> Server hinzufügen
                    </button>
                  }
                />
                <div className="space-y-2">
                  {servers.map(server => {
                    const m = statusMeta(server.status);
                    return (
                      <div key={server.id} className="group flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.015] px-3 py-2.5 hover:bg-white/[0.03] transition-colors">
                        <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border', m.bg)}>
                          <Server className={clsx('w-4 h-4', m.tile)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{server.name}</p>
                            {server.is_local ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] text-white/40">Lokal</span> : null}
                          </div>
                          <p className="text-xs text-white/30 font-mono truncate">{server.host}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {server.glances_url && (
                            <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/15">Glances</span>
                          )}
                          <span className={clsx('flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full', m.bg, m.text)}>
                            <span className={clsx('w-1.5 h-1.5 rounded-full', m.dot)} />
                            {m.label}
                          </span>
                          <button onClick={() => openEditServer(server)} className="p-1.5 rounded-lg text-white/25 hover:text-white/80 hover:bg-white/[0.06] transition-all" title="Bearbeiten">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {!server.is_local && (
                            <button onClick={() => setConfirmDeleteServer(server.id)} className="p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Entfernen">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </GlassCard>
          )}

          {/* Dienste Tab */}
          {activeTab === 'services' && (
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
                    <p className="text-sm text-white/30 text-center py-8">Keine Dienste gefunden</p>
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
                            <span className={clsx('text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0', isManual ? 'bg-blue-500/10 text-blue-400' : 'bg-white/[0.05] text-white/40')}>{isManual ? 'Extern' : 'Docker'}</span>
                            {svc.category && <span className="text-[10px] text-white/30 truncate">{svc.category}</span>}
                          </div>
                          {svc.url && <p className="text-[11px] text-white/25 font-mono truncate">{svc.url}</p>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {svc.url && <a href={svc.url} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-white/25 hover:text-white/70 hover:bg-white/[0.06] transition-all"><ExternalLink className="w-3.5 h-3.5" /></a>}
                          {!isManual && (
                            <button onClick={() => serviceHideMutation.mutate(svc)} disabled={serviceHideMutation.isPending} title={svc.hidden ? 'Einblenden' : 'Verstecken'} className="p-1.5 rounded-lg text-white/25 hover:text-white/80 hover:bg-white/[0.06] transition-all">
                              {svc.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {isManual && (
                            <button onClick={() => serviceDeleteMutation.mutate(svc.id)} className="p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </GlassCard>
          )}

          {/* Darstellung Tab */}
          {activeTab === 'appearance' && (
            <GlassCard>
              <div className="relative z-10">
                <SectionHeader
                  icon={Palette}
                  tint="bg-purple-500/10 border-purple-500/20 text-purple-400"
                  title="Darstellung"
                  desc="Akzentfarbe und visuelle Effekte des Dashboards"
                  action={
                    <button onClick={resetThemeAll} className="btn-glass text-xs flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5" /> Zurücksetzen
                    </button>
                  }
                />
                <div className="mb-5">
                  <p className="text-xs text-white/40 mb-2">Akzentfarbe</p>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {ACCENT_PRESETS.map(p => (
                      <button key={p.name} onClick={() => updateTheme({ accentColor: p.color })} className={clsx('flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all border', theme.accentColor === p.color ? 'border-white/20 bg-white/[0.06]' : 'border-transparent hover:bg-white/[0.03]')}>
                        <span className={clsx('w-6 h-6 rounded-full', p.bg)} style={{ boxShadow: theme.accentColor === p.color ? `0 0 10px ${p.color}80` : 'none' }} />
                        <span className="text-[9px] text-white/40">{p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <SettingRow title="Hintergrund-Orbs" desc="Animierte Farbverläufe im Hintergrund">
                  <Toggle on={theme.orbsEnabled} onClick={() => updateTheme({ orbsEnabled: !theme.orbsEnabled })} />
                </SettingRow>
                {theme.orbsEnabled && (
                  <SettingRow title="Orb-Intensität" desc={`${theme.orbIntensity}%`}>
                    <input type="range" min={10} max={100} value={theme.orbIntensity} onChange={e => updateTheme({ orbIntensity: Number(e.target.value) })} className="w-40 accent-[var(--accent-color)]" />
                  </SettingRow>
                )}
                <SettingRow title="Glass-Blur" desc={`${theme.blurStrength}px Weichzeichnung`} last>
                  <input type="range" min={0} max={32} value={theme.blurStrength} onChange={e => updateTheme({ blurStrength: Number(e.target.value) })} className="w-40 accent-[var(--accent-color)]" />
                </SettingRow>
              </div>
            </GlassCard>
          )}

          {/* Alerts Tab */}
          {activeTab === 'alerts' && (
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
                        <label className="text-xs text-white/40 block mb-1.5">{f.label} <span className="text-white/25">&gt; {f.unit}</span></label>
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
                    <div className="text-center py-10 text-white/30">
                      <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Noch keine Benachrichtigungs-Kanäle konfiguriert</p>
                      <p className="text-xs mt-1">Füge einen Discord- oder Telegram-Webhook hinzu</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {channels.map(channel => (
                        <div key={channel.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.015] px-3 py-2.5">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', channel.type === 'discord' ? 'bg-indigo-500/10' : 'bg-blue-500/10')}>
                              <span className="text-lg">{channel.type === 'discord' ? '💬' : '📨'}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{channel.name}</p>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {channel.events.slice(0, 4).map(e => (
                                  <span key={e} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/40">
                                    {EVENT_OPTIONS.find(o => o.id === e)?.icon} {EVENT_OPTIONS.find(o => o.id === e)?.label || e}
                                  </span>
                                ))}
                                {channel.events.length > 4 && <span className="text-[10px] text-white/25">+{channel.events.length - 4}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                            <Toggle on={channel.enabled} onClick={() => toggleMutation.mutate({ id: channel.id, enabled: !channel.enabled })} />
                            <button onClick={() => testMutation.mutate(channel.id)} disabled={testingId === channel.id} className="btn-glass text-xs px-2.5 py-1.5 flex items-center gap-1">
                              {testingId === channel.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <TestTube className="w-3 h-3" />} Test
                            </button>
                            <button onClick={() => deleteMutation.mutate(channel.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-all">
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
                    <SectionHeader icon={ScrollText} tint="bg-white/[0.05] border-white/10 text-white/50" title="Letzte Benachrichtigungen" desc="Verlauf gesendeter Alarme" />
                    <div className="space-y-1">
                      {history.map((h: any, i: number) => (
                        <div key={h.id || i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 px-2 rounded-lg hover:bg-white/[0.02] text-xs gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-white/25">{h.channel_name}</span>
                            <span className="text-white/45 font-mono">{h.event_type}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-white/50 truncate max-w-[200px]">{h.message}</span>
                            <span className="text-white/20 flex-shrink-0">{new Date(h.sent_at + 'Z').toLocaleString('de-DE')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </GlassCard>
              )}
            </>
          )}

          {/* Backup Tab */}
          {activeTab === 'backup' && (
            <>
              <GlassCard>
                <div className="relative z-10">
                  <SectionHeader icon={Clock} tint="bg-indigo-500/10 border-indigo-500/20 text-indigo-400" title="Automatische Backups" desc="Erstellt Backups im gewählten Intervall" />
                  <SettingRow title="Zeitplan aktiviert" desc="Automatische Sicherung nach Intervall">
                    <Toggle on={schedule?.enabled} disabled={scheduleMutation.isPending || !schedule} onClick={() => scheduleMutation.mutate({ enabled: !schedule?.enabled })} />
                  </SettingRow>
                  <SettingRow title="Backup-Typ" desc="Nur Datenbank oder vollständige Sicherung">
                    <div className="flex gap-2">
                      {(['database', 'full'] as const).map(t => (
                        <button key={t} onClick={() => scheduleMutation.mutate({ type: t })} disabled={!schedule}
                          className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-all', schedule?.type === t ? 'bg-accent/20 border border-accent/30 text-accent-light' : 'bg-white/[0.03] border border-white/10 text-white/40')}>
                          {t === 'database' ? 'Datenbank' : 'Vollständig'}
                        </button>
                      ))}
                    </div>
                  </SettingRow>
                  <SettingRow title="Intervall" desc="Wie oft ein Backup erstellt wird" last>
                    <div className="flex gap-2 flex-wrap">
                      {[6, 12, 24, 168].map(h => (
                        <button key={h} onClick={() => scheduleMutation.mutate({ intervalHours: h })} disabled={!schedule}
                          className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-all', schedule?.intervalHours === h ? 'bg-accent/20 border border-accent/30 text-accent-light' : 'bg-white/[0.03] border border-white/10 text-white/40')}>
                          {h === 168 ? '7 Tage' : `${h} h`}
                        </button>
                      ))}
                    </div>
                  </SettingRow>
                </div>
              </GlassCard>

              <GlassCard>
                <div className="relative z-10">
                  <SectionHeader
                    icon={Archive} tint="bg-emerald-500/10 border-emerald-500/20 text-emerald-400" title="Backups" desc="Manuell erstellen, herunterladen, löschen"
                    action={
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => backupMutation.mutate('database')} disabled={backupMutation.isPending || backupStatus?.running} className="btn-primary flex items-center gap-2 text-xs disabled:opacity-40">
                          {backupMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />} Datenbank
                        </button>
                        <button onClick={() => backupMutation.mutate('full')} disabled={backupMutation.isPending || backupStatus?.running} className="btn-glass flex items-center gap-2 text-xs disabled:opacity-40">
                          {backupMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />} Vollständig
                        </button>
                      </div>
                    }
                  />
                  {(!backups || backups.length === 0) ? (
                    <p className="text-sm text-white/30 text-center py-8">Noch keine Backups erstellt</p>
                  ) : (
                    <div className="space-y-1 max-h-[320px] overflow-y-auto">
                      {backups.map((b: any) => (
                        <div key={b.id} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-white/[0.02] text-xs">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={clsx('px-2 py-0.5 rounded flex-shrink-0', b.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : b.status === 'running' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400')}>
                              {b.status === 'completed' ? 'OK' : b.status === 'running' ? 'Läuft...' : 'Fehler'}
                            </span>
                            <span className="text-white/50">{b.type === 'full' ? 'Vollständig' : 'Datenbank'}</span>
                            {b.size && <span className="text-white/25">{(b.size / 1024 / 1024).toFixed(1)} MB</span>}
                            {b.error && <span className="text-red-400 truncate">{b.error}</span>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-white/20">{new Date(b.started_at + 'Z').toLocaleString('de-DE')}</span>
                            {b.status === 'completed' && (
                              <button onClick={() => handleDownloadBackup(b.id)} disabled={downloadingId === b.id} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/30 hover:text-emerald-400 transition-all" title="Herunterladen">
                                {downloadingId === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            {b.status !== 'running' && (
                              <button onClick={() => deleteBackupMutation.mutate(b.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-all" title="Löschen">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </GlassCard>

              <GlassCard>
                <div className="relative z-10">
                  <SectionHeader icon={ScrollText} tint="bg-cyan-500/10 border-cyan-500/20 text-cyan-400" title="Audit Log" desc="Sicherheitsrelevante Aktionen" />
                  {(!auditLog || auditLog.length === 0) ? (
                    <p className="text-sm text-white/30 text-center py-8">Noch keine Audit-Einträge</p>
                  ) : (
                    <div className="space-y-1 max-h-[400px] overflow-y-auto">
                      {auditLog.map((entry: any) => (
                        <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 px-2 rounded-lg hover:bg-white/[0.02] text-xs gap-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className={clsx('px-2 py-0.5 rounded font-mono',
                              entry.action.startsWith('container.') ? 'bg-cyan-500/10 text-cyan-400' :
                              entry.action.startsWith('auth.') ? 'bg-indigo-500/10 text-indigo-400' :
                              entry.action.startsWith('service.') ? 'bg-emerald-500/10 text-emerald-400' :
                              'bg-white/[0.06] text-white/50')}>{entry.action}</span>
                            {entry.target && <span className="text-white/40">{entry.target}</span>}
                            {entry.details && <span className="text-white/25 truncate max-w-[200px]">{entry.details}</span>}
                          </div>
                          <span className="text-white/20 flex-shrink-0 sm:ml-3">{new Date(entry.created_at + 'Z').toLocaleString('de-DE')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </GlassCard>
            </>
          )}

          {/* Account Tab */}
          {activeTab === 'account' && (
            <GlassCard>
              <div className="relative z-10">
                <SectionHeader icon={Shield} tint="bg-indigo-500/10 border-indigo-500/20 text-indigo-400" title="Passwort ändern" desc="Nach der Änderung wirst du neu angemeldet" />
                <div className="space-y-4 max-w-xl">
                  <div>
                    <label className="text-xs text-white/40 block mb-1.5">Aktuelles Passwort</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input type="password" className="glass-input w-full pl-10" value={pwForm.currentPassword} onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} placeholder="Aktuelles Passwort" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-white/40 block mb-1.5">Neues Passwort</label>
                      <input type="password" className="glass-input w-full" value={pwForm.newPassword} onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))} placeholder="Min. 6 Zeichen" />
                    </div>
                    <div>
                      <label className="text-xs text-white/40 block mb-1.5">Passwort bestätigen</label>
                      <input type="password" className="glass-input w-full" value={pwForm.confirmPassword} onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))} placeholder="Passwort wiederholen" />
                    </div>
                  </div>
                  {pwError && <p className="text-xs text-red-400">{pwError}</p>}
                  {pwSuccess && <p className="text-xs text-emerald-400">Passwort geändert! Du wirst abgemeldet...</p>}
                  <button onClick={handleChangePassword} disabled={!pwForm.currentPassword || !pwForm.newPassword || !pwForm.confirmPassword || pwLoading} className="btn-primary disabled:opacity-40 flex items-center gap-2 text-xs">
                    {pwLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                    {pwLoading ? 'Wird geändert...' : 'Passwort ändern'}
                  </button>
                </div>
              </div>
            </GlassCard>
          )}
        </div>
      </div>

      {/* Server hinzufügen/bearbeiten Modal */}
      <Modal isOpen={showServerModal} onClose={() => setShowServerModal(false)} title={editingServerId ? 'Server bearbeiten' : 'Server hinzufügen'} size="sm">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/40 block mb-1.5">Name</label>
              <input className="glass-input w-full" placeholder="z.B. Mein VPS" value={serverForm.name} onChange={e => setServerForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-white/40 block mb-1.5">Host / IP</label>
              <input className="glass-input w-full" placeholder="z.B. 188.34.130.109" value={serverForm.host} onChange={e => setServerForm(f => ({ ...f, host: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1.5">Glances-URL <span className="text-white/20">(optional, für Monitoring)</span></label>
            <input className="glass-input w-full" placeholder="http://user:pass@host:61208" value={serverForm.glancesUrl} onChange={e => setServerForm(f => ({ ...f, glancesUrl: e.target.value }))} />
          </div>
          <div className="pt-1 border-t border-white/[0.05]">
            <p className="text-[11px] uppercase tracking-wider text-white/25 mt-3 mb-2">SSH (für Docker-Fernzugriff, optional)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs text-white/40 block mb-1.5">SSH-Host</label>
                <input className="glass-input w-full" placeholder="wie Host/IP" value={serverForm.sshHost} onChange={e => setServerForm(f => ({ ...f, sshHost: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1.5">Port</label>
                <input type="number" className="glass-input w-full" value={serverForm.sshPort} onChange={e => setServerForm(f => ({ ...f, sshPort: parseInt(e.target.value) || 22 }))} />
              </div>
              <div>
                <label className="text-xs text-white/40 block mb-1.5">User</label>
                <input className="glass-input w-full" placeholder="root" value={serverForm.sshUser} onChange={e => setServerForm(f => ({ ...f, sshUser: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-white/40 block mb-1.5">Key-Pfad (im Container)</label>
                <input className="glass-input w-full" value={serverForm.sshKeyPath} onChange={e => setServerForm(f => ({ ...f, sshKeyPath: e.target.value }))} />
              </div>
            </div>
          </div>
          {editingServerId && (
            <div className="pt-1 border-t border-white/[0.05]">
              <p className="text-[11px] uppercase tracking-wider text-white/25 mt-3 mb-2">Betrieb & Kosten (optional)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 block mb-1.5">Anbieter</label>
                  <input className="glass-input w-full" placeholder="z.B. Hetzner" value={serverForm.provider} onChange={e => setServerForm(f => ({ ...f, provider: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-white/40 block mb-1.5">Standort</label>
                  <input className="glass-input w-full" placeholder="z.B. Falkenstein" value={serverForm.location} onChange={e => setServerForm(f => ({ ...f, location: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-white/40 block mb-1.5">Kosten / Monat</label>
                    <input type="number" step="0.01" className="glass-input w-full" placeholder="0" value={serverForm.monthlyCost} onChange={e => setServerForm(f => ({ ...f, monthlyCost: e.target.value }))} />
                  </div>
                  <div className="w-24">
                    <label className="text-xs text-white/40 block mb-1.5">Währung</label>
                    <select className="glass-input w-full" value={serverForm.currency} onChange={e => setServerForm(f => ({ ...f, currency: e.target.value }))}>
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/40 block mb-1.5">Ablaufdatum</label>
                  <input type="date" className="glass-input w-full" value={serverForm.expiresAt} onChange={e => setServerForm(f => ({ ...f, expiresAt: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-white/40 block mb-1.5">Cloudflare-Tunnel-Name <span className="text-white/20">(für Tunnel-Status)</span></label>
                  <input className="glass-input w-full" placeholder="z.B. masons-vps2" value={serverForm.tunnelName} onChange={e => setServerForm(f => ({ ...f, tunnelName: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-white/40 block mb-1.5">Notizen</label>
                  <input className="glass-input w-full" placeholder="frei" value={serverForm.notes} onChange={e => setServerForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
            </div>
          )}
          {editingServerId && <p className="text-[11px] text-amber-400/70">Hinweis: Verbindungsänderungen greifen nach einem Neustart des Backends vollständig.</p>}
          <button onClick={() => serverMutation.mutate()} disabled={!serverForm.name || !serverForm.host || serverMutation.isPending} className="btn-primary w-full disabled:opacity-40 flex items-center justify-center gap-2">
            {serverMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {editingServerId ? 'Speichern' : 'Server hinzufügen'}
          </button>
        </div>
      </Modal>

      {/* Server löschen Bestätigung */}
      <Modal isOpen={!!confirmDeleteServer} onClose={() => setConfirmDeleteServer(null)} title="Server entfernen?" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-white/60">Der Server wird aus der Fleet entfernt. Der Server selbst und seine Container bleiben unberührt.</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDeleteServer(null)} className="btn-glass flex-1">Abbrechen</button>
            <button onClick={() => confirmDeleteServer && serverDeleteMutation.mutate(confirmDeleteServer)} disabled={serverDeleteMutation.isPending} className="flex-1 py-2 rounded-xl text-sm font-medium bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
              {serverDeleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Entfernen
            </button>
          </div>
        </div>
      </Modal>

      {/* Externen Dienst hinzufügen */}
      <Modal isOpen={showServiceModal} onClose={() => setShowServiceModal(false)} title="Externen Dienst überwachen" size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/40 block mb-1.5">Name</label>
            <input className="glass-input w-full" placeholder="z.B. Meine Webseite" value={serviceForm.name} onChange={e => setServiceForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1.5">URL</label>
            <input className="glass-input w-full" placeholder="https://..." value={serviceForm.url} onChange={e => setServiceForm(f => ({ ...f, url: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-white/40 block mb-1.5">Kategorie</label>
            <input className="glass-input w-full" placeholder="Extern" value={serviceForm.category} onChange={e => setServiceForm(f => ({ ...f, category: e.target.value }))} />
          </div>
          <p className="text-[11px] text-white/30">Wird alle 60s per HTTP geprüft und erscheint auf der Status-Seite unter {servers.find(s => s.id === selectedSvcServer)?.name || selectedSvcServer}.</p>
          <button onClick={() => serviceAddMutation.mutate()} disabled={!serviceForm.name || !serviceForm.url || serviceAddMutation.isPending} className="btn-primary w-full disabled:opacity-40 flex items-center justify-center gap-2">
            {serviceAddMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Hinzufügen
          </button>
        </div>
      </Modal>

      {/* Add Channel Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Kanal hinzufügen" size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/40 block mb-1.5">Typ</label>
            <div className="flex gap-2">
              {(['discord', 'telegram'] as const).map(type => (
                <button key={type} onClick={() => setForm(f => ({ ...f, type }))} className={clsx('flex-1 py-2 rounded-xl text-sm font-medium transition-all', form.type === type ? 'bg-accent/20 border border-accent/30 text-accent-light' : 'bg-white/[0.03] border border-white/10 text-white/40')}>
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
            <div className="grid grid-cols-2 gap-2 max-h-[240px] overflow-y-auto">
              {EVENT_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => toggleEvent(opt.id)} className={clsx('py-2 px-3 rounded-xl text-xs text-left transition-all', form.events.includes(opt.id) ? 'bg-accent/15 border border-accent/25 text-white/80' : 'bg-white/[0.03] border border-white/10 text-white/40')}>
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
    </div>
    </PageTransition>
  );
}
