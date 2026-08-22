/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Bot, Circle, Users, Activity, ArrowLeft, RefreshCw, Loader2,
  CheckCircle2, AlertTriangle, UsersRound, ShieldCheck, ExternalLink, Clock,
} from 'lucide-react';
import { PageTransition } from '@/components/ui/PageTransition';
import { botCall } from '@/lib/api';

function fmtUptime(ms?: number | null): string {
  if (!ms || ms <= 0) return '—';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return 'nie';
  try { return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; }
}

export default function PersonetBotPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const flash = (ok: boolean, msg: string) => { setToast({ ok, msg }); setTimeout(() => setToast(null), 4000); };

  const load = useCallback(async () => {
    const r = await botCall('personet', '/status');
    if (r.ok) setStatus(r.data);
    else setStatus({ connected: false, error: r.data?.error });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const sync = async (path: '/sync-members' | '/sync-roles', label: string) => {
    setBusy(path);
    const r = await botCall<any>('personet', path, { method: 'POST' });
    setBusy(null);
    if (r.ok) {
      flash(true, `${label} abgeschlossen.`);
      if (r.data?.result) setResult(r.data.result);
    } else {
      flash(false, r.data?.error || `${label} fehlgeschlagen`);
    }
    load();
  };

  const connected = !!status?.connected;

  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto md:py-2">
        <Link href="/bots" className="inline-flex items-center gap-1.5 text-[13px] text-white/40 hover:text-white/70 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Alle Bots
        </Link>

        <div className="glass-card rounded-2xl p-5 mb-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-accent/15 border border-accent/25 flex items-center justify-center">
                <Bot className="w-6 h-6 text-accent-light" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-semibold">PersoNet-Bot</h1>
                  <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-medium ${connected ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300/80'}`}>
                    <Circle className={`w-2 h-2 ${connected ? 'fill-emerald-400 text-emerald-400' : 'fill-red-400 text-red-400'}`} />
                    {connected ? 'Online' : 'Offline'}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-white/30"><ExternalLink className="w-3 h-3" /> läuft in PersoNet</span>
                </div>
                <div className="text-[12px] text-white/40">
                  {status?.guild?.name || 'LSPD Corleone City'}{status?.username ? ` · ${status.username}` : ''}
                </div>
              </div>
            </div>
            <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-colors">
              <RefreshCw className="w-4 h-4" /> Aktualisieren
            </button>
          </div>
        </div>

        {loading ? (
          <div className="glass-card rounded-2xl p-8 flex items-center justify-center text-white/40">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Lade…
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status-Kacheln */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat icon={Users} label="Mitglieder" value={status?.guild?.memberCount ?? '—'} />
              <Stat icon={Activity} label="Ping" value={status?.ping != null ? `${status.ping} ms` : '—'} />
              <Stat icon={Clock} label="Uptime" value={fmtUptime(status?.uptime)} />
              <Stat icon={CheckCircle2} label="Letzter Sync" value={status?.lastSyncAt ? fmtDate(status.lastSyncAt).split(',')[0] : 'nie'} small />
            </div>

            {status?.error && (
              <div className="glass-card rounded-2xl p-4 border border-red-500/20 text-red-300/80 text-sm">
                {status.error}
              </div>
            )}

            {/* Aktionen */}
            <div className="glass-card rounded-2xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-white/70">Aktionen</h2>
              <p className="text-[12px] text-white/40">Löst die in PersoNet vorhandenen Sync-Funktionen aus. Es wird nichts entfernt oder verändert — nur synchronisiert.</p>
              <div className="flex flex-wrap gap-3 pt-1">
                <button onClick={() => sync('/sync-members', 'Mitglieder-Sync')} disabled={!!busy}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-accent/20 border border-accent/25 text-accent-light hover:bg-accent/30 transition-colors disabled:opacity-50">
                  {busy === '/sync-members' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UsersRound className="w-4 h-4" />}
                  Mitglieder synchronisieren
                </button>
                <button onClick={() => sync('/sync-roles', 'Rollen-Sync')} disabled={!!busy}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/[0.05] border border-white/[0.08] text-white/70 hover:bg-white/[0.09] hover:text-white transition-colors disabled:opacity-50">
                  {busy === '/sync-roles' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Rollen synchronisieren
                </button>
              </div>
              {result && (
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12px]">
                  {['created', 'updated', 'removed', 'total'].map(k => k in result && (
                    <div key={k} className="px-3 py-2 rounded-lg bg-white/[0.03] flex justify-between">
                      <span className="text-white/40 capitalize">{k}</span>
                      <span className="text-white/80 tabular-nums">{result[k]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className={`fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm shadow-lg border ${toast.ok ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-200' : 'bg-red-500/15 border-red-500/25 text-red-200'}`}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </motion.div>
      )}
    </PageTransition>
  );
}

function Stat({ icon: Icon, label, value, small }: { icon: any; label: string; value: any; small?: boolean }) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2"><Icon className="w-4 h-4 text-accent-light/70" /><span className="text-[11px] text-white/45">{label}</span></div>
      <div className={`font-bold tabular-nums ${small ? 'text-sm' : 'text-xl'}`}>{value}</div>
    </div>
  );
}
