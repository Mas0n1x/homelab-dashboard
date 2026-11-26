/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Plus, Trash2, Loader2, Server, Pencil } from 'lucide-react';
import { clsx } from 'clsx';
import { GlassCard } from '@/components/ui/GlassCard';
import { Modal } from '@/components/ui/Modal';
import { useServerStore } from '@/stores/serverStore';
import * as api from '@/lib/api';
import { SectionHeader } from './ui';

const EMPTY_SERVER = { name: '', host: '', glancesUrl: '', sshHost: '', sshPort: 22, sshUser: 'root', sshKeyPath: '/app/ssh/id_ed25519', provider: '', location: '', monthlyCost: '', currency: 'EUR', expiresAt: '', tunnelName: '', notes: '' };

export function FleetTab() {
  const { servers, setServers } = useServerStore();
  // Server-Verwaltung
  const [showServerModal, setShowServerModal] = useState(false);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [serverForm, setServerForm] = useState({ ...EMPTY_SERVER });
  const [confirmDeleteServer, setConfirmDeleteServer] = useState<string | null>(null);

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

  const statusMeta = (status: string) =>
    status === 'connected' ? { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', tile: 'text-emerald-400', label: 'Online' }
    : status === 'monitoring' ? { dot: 'bg-amber-400', text: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', tile: 'text-amber-400', label: 'Nur Monitoring' }
    : { dot: 'bg-red-400', text: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', tile: 'text-red-400', label: 'Offline' };

  return (
    <>
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
                      {server.is_local ? <span className="text-[11px] px-1.5 py-0.5 rounded bg-white/[0.05] text-white/55">Lokal</span> : null}
                    </div>
                    <p className="text-xs text-white/50 font-mono truncate">{server.host}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {server.glances_url && (
                      <span className="hidden sm:inline text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/15">Glances</span>
                    )}
                    {/* Mobil nur der Statuspunkt — die Textpille fraß die
                        Breite, sodass Servernamen abgeschnitten wurden. */}
                    <span className={clsx('flex items-center gap-1.5 text-xs px-1.5 sm:px-2 py-0.5 rounded-full', m.bg, m.text)} title={m.label}>
                      <span className={clsx('w-1.5 h-1.5 rounded-full', m.dot)} />
                      <span className="hidden sm:inline">{m.label}</span>
                    </span>
                    <button onClick={() => openEditServer(server)} className="p-1.5 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-all" title="Bearbeiten">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {!server.is_local && (
                      <button onClick={() => setConfirmDeleteServer(server.id)} className="p-1.5 rounded-lg text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Entfernen">
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
      {/* Server hinzufügen/bearbeiten Modal */}
      <Modal isOpen={showServerModal} onClose={() => setShowServerModal(false)} title={editingServerId ? 'Server bearbeiten' : 'Server hinzufügen'} size="sm">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/55 block mb-1.5">Name</label>
              <input className="glass-input w-full" placeholder="z.B. Mein VPS" value={serverForm.name} onChange={e => setServerForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-white/55 block mb-1.5">Host / IP</label>
              <input className="glass-input w-full" placeholder="z.B. 188.34.130.109" value={serverForm.host} onChange={e => setServerForm(f => ({ ...f, host: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs text-white/55 block mb-1.5">Glances-URL <span className="text-white/50">(optional, für Monitoring)</span></label>
            <input className="glass-input w-full" placeholder="http://user:pass@host:61208" value={serverForm.glancesUrl} onChange={e => setServerForm(f => ({ ...f, glancesUrl: e.target.value }))} />
          </div>
          <div className="pt-1 border-t border-white/[0.05]">
            <p className="text-[12px] uppercase tracking-wider text-white/50 mt-3 mb-2">SSH (für Docker-Fernzugriff, optional)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs text-white/55 block mb-1.5">SSH-Host</label>
                <input className="glass-input w-full" placeholder="wie Host/IP" value={serverForm.sshHost} onChange={e => setServerForm(f => ({ ...f, sshHost: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-white/55 block mb-1.5">Port</label>
                <input type="number" className="glass-input w-full" value={serverForm.sshPort} onChange={e => setServerForm(f => ({ ...f, sshPort: parseInt(e.target.value) || 22 }))} />
              </div>
              <div>
                <label className="text-xs text-white/55 block mb-1.5">User</label>
                <input className="glass-input w-full" placeholder="root" value={serverForm.sshUser} onChange={e => setServerForm(f => ({ ...f, sshUser: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-white/55 block mb-1.5">Key-Pfad (im Container)</label>
                <input className="glass-input w-full" value={serverForm.sshKeyPath} onChange={e => setServerForm(f => ({ ...f, sshKeyPath: e.target.value }))} />
              </div>
            </div>
          </div>
          {editingServerId && (
            <div className="pt-1 border-t border-white/[0.05]">
              <p className="text-[12px] uppercase tracking-wider text-white/50 mt-3 mb-2">Betrieb & Kosten (optional)</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/55 block mb-1.5">Anbieter</label>
                  <input className="glass-input w-full" placeholder="z.B. Hetzner" value={serverForm.provider} onChange={e => setServerForm(f => ({ ...f, provider: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-white/55 block mb-1.5">Standort</label>
                  <input className="glass-input w-full" placeholder="z.B. Falkenstein" value={serverForm.location} onChange={e => setServerForm(f => ({ ...f, location: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-white/55 block mb-1.5">Kosten / Monat</label>
                    <input type="number" step="0.01" className="glass-input w-full" placeholder="0" value={serverForm.monthlyCost} onChange={e => setServerForm(f => ({ ...f, monthlyCost: e.target.value }))} />
                  </div>
                  <div className="w-24">
                    <label className="text-xs text-white/55 block mb-1.5">Währung</label>
                    <select className="glass-input w-full" value={serverForm.currency} onChange={e => setServerForm(f => ({ ...f, currency: e.target.value }))}>
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/55 block mb-1.5">Ablaufdatum</label>
                  <input type="date" className="glass-input w-full" value={serverForm.expiresAt} onChange={e => setServerForm(f => ({ ...f, expiresAt: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-white/55 block mb-1.5">Cloudflare-Tunnel-Name <span className="text-white/50">(für Tunnel-Status)</span></label>
                  <input className="glass-input w-full" placeholder="z.B. masons-vps2" value={serverForm.tunnelName} onChange={e => setServerForm(f => ({ ...f, tunnelName: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-white/55 block mb-1.5">Notizen</label>
                  <input className="glass-input w-full" placeholder="frei" value={serverForm.notes} onChange={e => setServerForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
            </div>
          )}
          {editingServerId && <p className="text-[12px] text-amber-400/70">Hinweis: Verbindungsänderungen greifen nach einem Neustart des Backends vollständig.</p>}
          <button onClick={() => serverMutation.mutate()} disabled={!serverForm.name || !serverForm.host || serverMutation.isPending} className="btn-primary w-full disabled:opacity-40 flex items-center justify-center gap-2">
            {serverMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {editingServerId ? 'Speichern' : 'Server hinzufügen'}
          </button>
        </div>
      </Modal>

      {/* Server löschen Bestätigung */}
      <Modal isOpen={!!confirmDeleteServer} onClose={() => setConfirmDeleteServer(null)} title="Server entfernen?" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-white/70">Der Server wird aus der Fleet entfernt. Der Server selbst und seine Container bleiben unberührt.</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDeleteServer(null)} className="btn-glass flex-1">Abbrechen</button>
            <button onClick={() => confirmDeleteServer && serverDeleteMutation.mutate(confirmDeleteServer)} disabled={serverDeleteMutation.isPending} className="flex-1 py-2 rounded-xl text-sm font-medium bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
              {serverDeleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Entfernen
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
