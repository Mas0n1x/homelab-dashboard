/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { zahl } from '@/lib/formatters';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Loader2, Database, Archive, Server, Download, Clock, RotateCcw } from 'lucide-react';
import { clsx } from 'clsx';
import { GlassCard } from '@/components/ui/GlassCard';
import { Modal } from '@/components/ui/Modal';
import { useServerStore } from '@/stores/serverStore';
import * as api from '@/lib/api';
import { SectionHeader, SettingRow, Toggle } from './ui';

export function BackupTab() {
  const queryClient = useQueryClient();
  const { servers } = useServerStore();
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

  // Restore + Off-Site
  const [confirmRestore, setConfirmRestore] = useState<any | null>(null);
  const [restoreDone, setRestoreDone] = useState(false);
  const restoreMutation = useMutation({
    mutationFn: (id: number) => api.restoreBackup(id),
    onSuccess: () => { setConfirmRestore(null); setRestoreDone(true); },
  });
  const { data: offsite } = useQuery({ queryKey: ['offsite'], queryFn: () => api.getOffsiteConfig() });
  const [offsiteForm, setOffsiteForm] = useState<api.OffsiteConfig | null>(null);
  const os = offsiteForm ?? offsite ?? { enabled: false, serverId: '', path: '/root/dashboard-backups' };
  const offsiteMutation = useMutation({
    mutationFn: () => api.setOffsiteConfig(os),
    onSuccess: (d: any) => { queryClient.setQueryData(['offsite'], d); setOffsiteForm(null); },
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

  return (
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
                    className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-all', schedule?.type === t ? 'bg-accent/20 border border-accent/30 text-accent-light' : 'bg-white/[0.03] border border-white/10 text-white/55')}>
                    {t === 'database' ? 'Datenbank' : 'Vollständig'}
                  </button>
                ))}
              </div>
            </SettingRow>
            <SettingRow title="Intervall" desc="Wie oft ein Backup erstellt wird">
              <div className="flex gap-2 flex-wrap">
                {[6, 12, 24, 168].map(h => (
                  <button key={h} onClick={() => scheduleMutation.mutate({ intervalHours: h })} disabled={!schedule}
                    className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-all', schedule?.intervalHours === h ? 'bg-accent/20 border border-accent/30 text-accent-light' : 'bg-white/[0.03] border border-white/10 text-white/55')}>
                    {h === 168 ? '7 Tage' : `${h} h`}
                  </button>
                ))}
              </div>
            </SettingRow>
            {/* Aufbewahrung: ältere Sicherungen werden täglich gelöscht.
                Das jüngste Backup bleibt immer stehen — sonst stünde man
                nach einer längeren Pause ganz ohne Sicherung da. */}
            <SettingRow title="Aufbewahrung" desc="Ältere Backups werden automatisch gelöscht (das jüngste bleibt immer)" last>
              <div className="flex gap-2 flex-wrap">
                {[0, 7, 14, 30, 90].map(d => (
                  <button key={d} onClick={() => scheduleMutation.mutate({ retentionDays: d })} disabled={!schedule}
                    className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-all', (schedule?.retentionDays ?? 0) === d ? 'bg-accent/20 border border-accent/30 text-accent-light' : 'bg-white/[0.03] border border-white/10 text-white/55')}>
                    {d === 0 ? 'unbegrenzt' : `${d} Tage`}
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
              <p className="text-sm text-white/50 text-center py-8">Noch keine Backups erstellt</p>
            ) : (
              <div className="space-y-1 max-h-[320px] overflow-y-auto">
                {backups.map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-white/[0.02] text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={clsx('px-2 py-0.5 rounded flex-shrink-0', b.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : b.status === 'running' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400')}>
                        {b.status === 'completed' ? 'OK' : b.status === 'running' ? 'Läuft...' : 'Fehler'}
                      </span>
                      <span className="text-white/65">{b.type === 'full' ? 'Vollständig' : 'Datenbank'}</span>
                      {b.size && <span className="text-white/50">{zahl(b.size / 1024 / 1024, 1)} MB</span>}
                      {b.error && <span className="text-red-400 truncate">{b.error}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-white/50">{new Date(b.started_at + 'Z').toLocaleString('de-DE')}</span>
                      {b.status === 'completed' && (
                        <button onClick={() => setConfirmRestore(b)} className="p-1.5 rounded-lg hover:bg-amber-500/10 text-white/50 hover:text-amber-400 transition-all" title="Wiederherstellen">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {b.status === 'completed' && (
                        <button onClick={() => handleDownloadBackup(b.id)} disabled={downloadingId === b.id} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/50 hover:text-emerald-400 transition-all" title="Herunterladen">
                          {downloadingId === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      {b.status !== 'running' && (
                        <button onClick={() => deleteBackupMutation.mutate(b.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/50 hover:text-red-400 transition-all" title="Löschen">
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
            <SectionHeader
              icon={Server} tint="bg-blue-500/10 border-blue-500/20 text-blue-400" title="Off-Site-Kopie"
              desc="Backups nach jedem Lauf per SFTP auf einen Fleet-Server sichern"
              action={
                <button onClick={() => offsiteMutation.mutate()} disabled={offsiteMutation.isPending} className="btn-primary text-xs flex items-center gap-1.5">
                  {offsiteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Speichern
                </button>
              }
            />
            <SettingRow title="Off-Site aktiviert" desc="Kopiert jedes neue Backup auf den Zielserver">
              <Toggle on={os.enabled} onClick={() => setOffsiteForm({ ...os, enabled: !os.enabled })} />
            </SettingRow>
            <SettingRow title="Zielserver" desc="Server mit SSH-Zugriff aus deiner Fleet">
              <select className="glass-input text-xs py-1.5" value={os.serverId} onChange={e => setOffsiteForm({ ...os, serverId: e.target.value })}>
                <option value="">– wählen –</option>
                {servers.filter(s => !s.is_local && s.ssh_host).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </SettingRow>
            <SettingRow title="Zielpfad" desc="Verzeichnis auf dem Zielserver" last>
              <input className="glass-input text-xs py-1.5 w-56" value={os.path} onChange={e => setOffsiteForm({ ...os, path: e.target.value })} />
            </SettingRow>
          </div>
        </GlassCard>
      {/* Backup wiederherstellen */}
      <Modal isOpen={!!confirmRestore} onClose={() => { if (!restoreDone) setConfirmRestore(null); }} title="Backup wiederherstellen?" size="sm">
        {restoreDone ? (
          <div className="space-y-3 text-center py-3">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-accent-light" />
            <p className="text-sm text-white/70">Wird wiederhergestellt, das Dashboard startet neu…</p>
            <p className="text-xs text-white/55">Bitte die Seite in ~20 Sekunden neu laden.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-white/70">Der aktuelle Stand wird durch das Backup vom <span className="text-white/90">{confirmRestore && new Date(confirmRestore.started_at + 'Z').toLocaleString('de-DE')}</span> ersetzt.</p>
            <p className="text-xs text-amber-400/80">Vorher wird automatisch eine Sicherheitskopie angelegt. Das Backend startet danach neu.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmRestore(null)} className="btn-glass flex-1">Abbrechen</button>
              <button onClick={() => confirmRestore && restoreMutation.mutate(confirmRestore.id)} disabled={restoreMutation.isPending} className="flex-1 py-2 rounded-xl text-sm font-medium bg-amber-500/15 border border-amber-500/25 text-amber-400 hover:bg-amber-500/25 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                {restoreMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Wiederherstellen
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
