/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity, CheckCircle2, AlertTriangle, ExternalLink, Server,
  Sparkles, Trash2, Clock, RefreshCw, Plus, Pencil, Zap, EyeOff,
} from 'lucide-react';
import { clsx } from 'clsx';
import { PageTransition } from '@/components/ui/PageTransition';
import { GlassCard } from '@/components/ui/GlassCard';
import { Modal } from '@/components/ui/Modal';
import { getIcon } from '@/lib/constants';
import * as api from '@/lib/api';
import type { StatusBoard, StatusService } from '@/lib/types';

const RANGES = [
  { days: 7, label: '7 T' },
  { days: 30, label: '30 T' },
  { days: 90, label: '90 T' },
];

const ICON_OPTIONS = ['link', 'monitor', 'shield', 'server', 'database', 'cloud', 'storage', 'globe', 'terminal', 'file', 'video', 'lock'];

function UptimeBars({ timeline, className }: { timeline: { date: string; uptime: number | null }[]; className?: string }) {
  return (
    <div className={clsx('flex items-stretch gap-[2px] w-full', className || 'h-7')} aria-hidden>
      {timeline.map((d, i) => {
        const c = d.uptime === null ? 'bg-white/[0.07]'
          : d.uptime >= 99 ? 'bg-emerald-400/80'
          : d.uptime >= 80 ? 'bg-amber-400/80'
          : 'bg-red-400/80';
        return (
          <div
            key={i}
            title={`${d.date}: ${d.uptime === null ? 'keine Daten' : d.uptime + ' % Verfügbarkeit'}`}
            className={clsx('flex-1 min-w-[2px] rounded-[2px] transition-colors hover:opacity-80', c)}
          />
        );
      })}
    </div>
  );
}

function relativeTime(iso: string | null) {
  if (!iso) return 'nie';
  const diff = Date.now() - Date.parse(iso);
  if (Number.isNaN(diff)) return 'unbekannt';
  const min = Math.round(diff / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const std = Math.round(min / 60);
  if (std < 24) return `vor ${std} Std.`;
  return `vor ${Math.round(std / 24)} Tagen`;
}

function hostFrom(url: string | null | undefined) {
  if (!url) return null;
  try { return new URL(url).host; } catch { return url; }
}

type ServiceForm = { name: string; url: string; icon: string; description: string; category: string };
const EMPTY_FORM: ServiceForm = { name: '', url: '', icon: 'link', description: '', category: 'Extern' };

function ServiceTile({ svc, onOpen }: { svc: StatusService; onOpen: () => void }) {
  const isUp = svc.current !== false && !svc.vanished;
  const uptime = svc.uptime24h;
  const Icon = getIcon(svc.icon || 'link');
  const host = hostFrom(svc.publicUrl || svc.url);

  return (
    <button
      onClick={onOpen}
      className={clsx(
        'glass-card glass-card-hover p-4 text-left flex flex-col gap-3 group',
        svc.vanished && 'opacity-50',
      )}
    >
      <div className="relative z-10 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className={clsx(
            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
            svc.vanished ? 'bg-white/[0.05]' : isUp ? 'bg-accent/10' : 'bg-red-500/10',
          )}>
            <Icon className={clsx('w-5 h-5', svc.vanished ? 'text-white/30' : isUp ? 'text-accent-light' : 'text-red-400')} />
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {svc.source === 'docker' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-0.5">
                <Zap className="w-2.5 h-2.5" />Auto
              </span>
            )}
            <span className="relative flex h-2.5 w-2.5">
              {isUp && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />}
              <span className={clsx('relative inline-flex rounded-full h-2.5 w-2.5', svc.vanished ? 'bg-white/25' : isUp ? 'bg-emerald-400' : 'bg-red-400')} />
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className={clsx('text-sm font-semibold truncate', svc.vanished && 'line-through')}>{svc.name}</p>
            {svc.isNew && (
              <span className="flex items-center gap-0.5 flex-shrink-0 px-1.5 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-400/30 text-[9px] font-semibold text-cyan-300 uppercase tracking-wide">
                <Sparkles className="w-2.5 h-2.5" /> Neu
              </span>
            )}
          </div>
          <p className="text-[10px] text-white/30 truncate mt-0.5">{svc.category}</p>
          {host && (
            <div className="flex items-center gap-1 mt-1.5 text-[11px] text-white/40 font-mono truncate">
              <span className="truncate">{host}</span>
              {(svc.publicUrl || svc.url) && !svc.vanished && (
                <a
                  href={svc.publicUrl || svc.url || undefined}
                  target="_blank" rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-white/20 hover:text-white/70 transition-colors flex-shrink-0"
                  title="Dienst öffnen"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between text-xs tabular-nums">
          <span className={clsx(
            'font-semibold',
            uptime === null ? 'text-white/30'
              : uptime >= 99 ? 'text-emerald-400'
              : uptime >= 80 ? 'text-amber-400'
              : 'text-red-400',
          )}>
            {svc.vanished ? 'entfernt' : uptime !== null ? `${uptime}% · 24h` : '–'}
          </span>
          <span className="text-white/40">{svc.avgResponseTime ? `${svc.avgResponseTime} ms` : ''}</span>
        </div>
      </div>
    </button>
  );
}

function ServiceForm({ form, setForm, onSubmit, pending, submitLabel }: {
  form: ServiceForm; setForm: (f: ServiceForm) => void; onSubmit: () => void; pending: boolean; submitLabel: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-white/40 block mb-1.5">Name</label>
        <input className="glass-input w-full" placeholder="Dienstname" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      </div>
      <div>
        <label className="text-xs text-white/40 block mb-1.5">URL</label>
        <input className="glass-input w-full" placeholder="https://..." value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} />
      </div>
      <div>
        <label className="text-xs text-white/40 block mb-1.5">Beschreibung</label>
        <input className="glass-input w-full" placeholder="Optional" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/40 block mb-1.5">Icon</label>
          <select className="glass-input w-full" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })}>
            {ICON_OPTIONS.map(icon => <option key={icon} value={icon}>{icon}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-white/40 block mb-1.5">Kategorie</label>
          <input className="glass-input w-full" placeholder="Kategorie" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
        </div>
      </div>
      <button onClick={onSubmit} disabled={!form.name || !form.url || pending} className="btn-primary w-full disabled:opacity-40">
        {pending ? 'Wird gespeichert...' : submitLabel}
      </button>
    </div>
  );
}

export default function StatusPage() {
  const [days, setDays] = useState(30);
  const [detail, setDetail] = useState<StatusService | null>(null);
  const [addFor, setAddFor] = useState<string | null>(null); // serverId
  const [addForm, setAddForm] = useState<ServiceForm>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<ServiceForm | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, refetch, error } = useQuery<StatusBoard>({
    queryKey: ['statusBoard', days],
    queryFn: () => api.getStatusBoard(days),
    // Das Board kommt aus der Datenbank und wird alle 60 Sekunden durch neue
    // Messwerte bewegt — öfter zu fragen bringt nichts.
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['statusBoard'] });

  const addMutation = useMutation({
    mutationFn: (p: { serverId: string; form: ServiceForm }) => api.addService({ ...p.form, serverId: p.serverId }),
    onSuccess: () => { invalidate(); setAddFor(null); setAddForm(EMPTY_FORM); },
  });

  const editMutation = useMutation({
    mutationFn: (p: { svc: StatusService; form: ServiceForm }) =>
      p.svc.source === 'manual' ? api.updateService(p.svc.id, p.form) : api.updateServiceOverride(p.svc.id, p.form),
    onSuccess: () => { invalidate(); setEditForm(null); setDetail(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteService(id),
    onSuccess: () => { invalidate(); setDetail(null); },
  });

  const hideMutation = useMutation({
    // Die Override-Zeile wird komplett ersetzt (kein partielles Update im Backend) -
    // deshalb hier alle aktuell sichtbaren Werte mitschicken, sonst gehen Name/URL/
    // Kategorie eines bereits angepassten Dienstes beim Ausblenden verloren.
    mutationFn: (svc: StatusService) => api.updateServiceOverride(svc.id, {
      name: svc.name, url: svc.publicUrl || svc.url, icon: svc.icon || undefined,
      description: svc.description || undefined, category: svc.category, hidden: true,
    }),
    onSuccess: () => { invalidate(); setDetail(null); },
  });

  const { summary, groups } = useMemo(() => ({
    summary: data?.summary ?? { up: 0, down: 0, total: 0, servers: 0 },
    groups: data?.groups ?? [],
  }), [data]);

  const allOk = summary.down === 0 && summary.total > 0;

  const openEdit = (svc: StatusService) => {
    setEditForm({
      name: svc.name, url: svc.publicUrl || svc.url || '',
      icon: svc.icon || 'link', description: svc.description || '', category: svc.category || 'Extern',
    });
  };

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Kopfzeile */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">
              Service <span className="text-gradient">Status</span>
            </h1>
            <p className="text-sm text-white/40 mt-1">
              Dienste erscheinen automatisch beim Deploy und verschwinden, sobald sie vom Server sind
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-xl bg-white/[0.03] border border-white/[0.06] p-0.5">
              {RANGES.map(r => (
                <button
                  key={r.days}
                  onClick={() => setDays(r.days)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    days === r.days ? 'bg-white/[0.09] text-white' : 'text-white/40 hover:text-white/70',
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => refetch()}
              className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/40 hover:text-white/80 transition-colors"
              title="Neu laden"
            >
              <RefreshCw className={clsx('w-4 h-4', isFetching && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Gesamtlage */}
        <div className={clsx(
          'flex items-center gap-4 p-5 rounded-2xl border',
          allOk ? 'bg-emerald-500/[0.07] border-emerald-500/20'
            : summary.down > 0 ? 'bg-amber-500/[0.07] border-amber-500/20'
            : 'bg-white/[0.02] border-white/[0.06]',
        )}>
          <div className={clsx(
            'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
            allOk ? 'bg-emerald-500/15' : 'bg-amber-500/15',
          )}>
            {allOk
              ? <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              : <AlertTriangle className="w-6 h-6 text-amber-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold">
              {isLoading ? 'Lade Status …'
                : allOk ? 'Alle Systeme betriebsbereit'
                : `${summary.down} von ${summary.total} Diensten offline`}
            </p>
            <p className="text-xs text-white/40 mt-0.5">
              {summary.up} online · {summary.total} überwacht · {summary.servers} Server
            </p>
          </div>
          <Activity className={clsx('w-5 h-5 flex-shrink-0', allOk ? 'text-emerald-400/50' : 'text-amber-400/50')} />
        </div>

        {error && (
          <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/[0.06] text-sm text-red-300">
            Status konnte nicht geladen werden: {(error as Error).message}
          </div>
        )}

        {/* Ladezustand als Platzhalter statt eines Textes — sonst springt die
            Seite beim Eintreffen der Daten. */}
        {isLoading && (
          <div className="space-y-3">
            {[0, 1].map(i => (
              <div key={i} className="h-40 rounded-2xl bg-white/[0.02] border border-white/[0.05] animate-pulse" />
            ))}
          </div>
        )}

        {/* Je Server ein Abschnitt mit Kachel-Grid */}
        {groups.map(g => (
          <div key={g.server.id}>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Server className="w-4 h-4 text-white/40 flex-shrink-0" />
              <h2 className="text-sm font-semibold">{g.server.name}</h2>
              <span className="text-xs text-white/30">{g.services.length} Dienste</span>
              {g.stale && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-400/25 text-[10px] text-amber-300">
                  <Clock className="w-2.5 h-2.5" />
                  Erkennung {relativeTime(g.lastDiscovery)}
                </span>
              )}
              <button
                onClick={() => { setAddFor(g.server.id); setAddForm(EMPTY_FORM); }}
                className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-white/50 hover:text-white/90 hover:bg-white/[0.06] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Dienst hinzufügen
              </button>
            </div>

            {g.services.length === 0 ? (
              <GlassCard>
                <p className="relative z-10 py-6 text-center text-sm text-white/30">
                  Keine Dienste erkannt — läuft auf diesem Server gerade nichts?
                </p>
              </GlassCard>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {g.services.map(svc => (
                  <ServiceTile key={svc.id} svc={svc} onOpen={() => setDetail(svc)} />
                ))}
              </div>
            )}
          </div>
        ))}

        {!isLoading && groups.length === 0 && (
          <p className="text-sm text-white/30 text-center py-8">Keine Server angebunden.</p>
        )}
      </div>

      {/* Detail-Modal */}
      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={detail?.name || 'Dienst'} size="md">
        {detail && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span className={clsx(
                'w-2.5 h-2.5 rounded-full flex-shrink-0',
                detail.vanished ? 'bg-white/25' : detail.current !== false ? 'bg-emerald-400' : 'bg-red-400',
              )} />
              <span className="text-sm text-white/70">
                {detail.vanished ? 'Nicht mehr auf dem Server gefunden' : detail.current !== false ? 'Online' : 'Offline'}
              </span>
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] text-white/40 border border-white/10">{detail.category}</span>
              {detail.source === 'docker' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-0.5">
                  <Zap className="w-2.5 h-2.5" />Auto
                </span>
              )}
            </div>

            {(detail.publicUrl || detail.url) && (
              <a
                href={detail.publicUrl || detail.url || undefined}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-sm text-accent-light hover:underline break-all"
              >
                <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" /> {detail.publicUrl || detail.url}
              </a>
            )}

            {detail.description && <p className="text-sm text-white/50">{detail.description}</p>}

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-center">
                <p className={clsx('text-lg font-bold', (detail.uptime24h ?? 0) >= 99 ? 'text-emerald-400' : (detail.uptime24h ?? 0) >= 80 ? 'text-amber-400' : 'text-red-400')}>
                  {detail.uptime24h !== null ? `${detail.uptime24h}%` : '–'}
                </p>
                <p className="text-[10px] text-white/30 mt-1">Uptime 24h</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-center">
                <p className="text-lg font-bold text-white/80">
                  {detail.uptime7d !== null ? `${detail.uptime7d}%` : '–'}
                </p>
                <p className="text-[10px] text-white/30 mt-1">Uptime 7 T</p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-center">
                <p className="text-lg font-bold text-white/80">
                  {detail.avgResponseTime ? `${detail.avgResponseTime} ms` : '–'}
                </p>
                <p className="text-[10px] text-white/30 mt-1">Ø Antwortzeit</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] text-white/30 mb-1.5">Verlauf ({days} Tage) · zuletzt geprüft {relativeTime(detail.lastCheck)}</p>
              <UptimeBars timeline={detail.timeline} className="h-10" />
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.05]">
              <button
                onClick={() => openEdit(detail)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs text-white/60 hover:text-white/90 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> Bearbeiten
              </button>
              {detail.source === 'docker' && !detail.vanished && (
                <button
                  onClick={() => hideMutation.mutate(detail)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs text-white/60 hover:text-white/90 transition-colors"
                >
                  <EyeOff className="w-3.5 h-3.5" /> Ausblenden
                </button>
              )}
              {detail.source === 'manual' && (
                <button
                  onClick={() => deleteMutation.mutate(detail.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs text-red-300 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Löschen
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Bearbeiten-Modal */}
      <Modal isOpen={!!editForm} onClose={() => setEditForm(null)} title="Dienst bearbeiten" size="sm">
        {editForm && detail && (
          <ServiceForm
            form={editForm}
            setForm={setEditForm}
            pending={editMutation.isPending}
            submitLabel="Speichern"
            onSubmit={() => editMutation.mutate({ svc: detail, form: editForm })}
          />
        )}
      </Modal>

      {/* Hinzufügen-Modal */}
      <Modal isOpen={!!addFor} onClose={() => setAddFor(null)} title="Dienst hinzufügen" size="sm">
        <ServiceForm
          form={addForm}
          setForm={setAddForm}
          pending={addMutation.isPending}
          submitLabel="Hinzufügen"
          onSubmit={() => addFor && addMutation.mutate({ serverId: addFor, form: addForm })}
        />
      </Modal>
    </PageTransition>
  );
}
