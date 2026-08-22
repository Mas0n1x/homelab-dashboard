/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Bot, Circle, Play, Square, RotateCw, Save, Send, Hash, MessageSquare,
  Github, ScrollText, ArrowLeft, Users, ShieldAlert, Ticket, Filter,
  RefreshCw, Trash2, Loader2, CheckCircle2, AlertTriangle, Plus, Clock, Link2,
} from 'lucide-react';
import { PageTransition } from '@/components/ui/PageTransition';
import { botCall } from '@/lib/api';
import { PlaceholderChips } from '@/components/bots/ContentEditors';
import {
  useGuildDirectory, ChannelPicker, RolePicker, DirectoryStatus, type Directory,
} from '@/components/bots/IdPicker';

type Cfg = Record<string, string>;
type Tab = 'general' | 'content' | 'moderation' | 'tickets' | 'automod' | 'github' | 'logs';

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'general', label: 'Allgemein', icon: Bot },
  { id: 'content', label: 'Inhalte', icon: MessageSquare },
  { id: 'moderation', label: 'Moderation', icon: ShieldAlert },
  { id: 'tickets', label: 'Tickets', icon: Ticket },
  { id: 'automod', label: 'Auto-Mod', icon: Filter },
  { id: 'github', label: 'GitHub', icon: Github },
  { id: 'logs', label: 'Logs', icon: ScrollText },
];

const CHANNELS: { key: string; label: string; kind?: 'text' | 'category' }[] = [
  { key: 'discord_welcome_channel_id', label: 'Willkommen' },
  { key: 'discord_leave_channel_id', label: 'Verabschiedung' },
  { key: 'discord_log_channel_id', label: 'Log' },
  { key: 'discord_notify_orders_channel_id', label: 'Bestellungen' },
  { key: 'discord_notify_contacts_channel_id', label: 'Kontaktanfragen' },
  { key: 'discord_notify_affiliates_channel_id', label: 'Affiliate-Anträge' },
  { key: 'discord_notify_incidents_channel_id', label: 'Incidents' },
  { key: 'discord_ticket_category_id', label: 'Ticket-Kategorie', kind: 'category' },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer ${checked ? 'bg-emerald-500/60' : 'bg-white/[0.12]'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 pointer-events-none ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', mono }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[12px] text-white/45 mb-1.5 block">{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={`w-full px-3 py-2 rounded-xl bg-black/25 border border-white/[0.08] text-sm text-white/85 outline-none focus:border-accent/40 transition-colors ${mono ? 'font-mono text-[12px]' : ''}`} />
    </label>
  );
}

function ActionBtn({ busy, onClick, icon: Icon, label, small, danger }: { busy: boolean; onClick: () => void; icon: any; label: string; small?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} disabled={busy}
      className={`flex items-center gap-2 rounded-xl font-medium border transition-colors disabled:opacity-50 ${danger ? 'bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20' : 'bg-white/[0.05] border-white/[0.08] text-white/70 hover:bg-white/[0.09] hover:text-white'} ${small ? 'px-3 py-1.5 text-[12px]' : 'px-4 py-2.5 text-sm'}`}>
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {label}
    </button>
  );
}

function SaveBtn({ busy, onSave }: { busy: boolean; onSave: () => void }) {
  return (
    <button onClick={onSave} disabled={busy}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-accent/20 border border-accent/25 text-accent-light hover:bg-accent/30 transition-colors disabled:opacity-50">
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Speichern
    </button>
  );
}

export default function SalenetBotPage() {
  const [tab, setTab] = useState<Tab>('general');
  const [cfg, setCfg] = useState<Cfg>({});
  const [status, setStatus] = useState<any>(null);
  const [tokenSet, setTokenSet] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const welcomeRef = useRef<HTMLTextAreaElement>(null);
  const leaveRef = useRef<HTMLTextAreaElement>(null);

  const flash = (ok: boolean, msg: string) => { setToast({ ok, msg }); setTimeout(() => setToast(null), 3500); };

  const loadStatus = useCallback(async () => {
    const r = await botCall('salenet', '/status');
    if (r.ok) setStatus(r.data);
    const t = await botCall<{ configured: boolean }>('salenet', '/token-status');
    if (t.ok) setTokenSet(!!t.data.configured);
  }, []);

  const loadConfig = useCallback(async () => {
    const r = await botCall<Cfg>('salenet', '/config');
    if (r.ok) setCfg(r.data || {});
    setLoading(false);
  }, []);

  useEffect(() => {
    loadConfig(); loadStatus();
    const t = setInterval(loadStatus, 15000);
    return () => clearInterval(t);
  }, [loadConfig, loadStatus]);

  const set = (k: string, v: string) => setCfg(prev => ({ ...prev, [k]: v }));

  const saveConfig = async () => {
    setBusy('save');
    const r = await botCall('salenet', '/config', { method: 'PUT', body: JSON.stringify(cfg) });
    setBusy(null);
    flash(r.ok, r.ok ? 'Gespeichert.' : r.data?.error || 'Fehler');
  };

  const saveToken = async () => {
    if (!tokenInput.trim()) return;
    setBusy('token');
    const r = await botCall('salenet', '/token', { method: 'POST', body: JSON.stringify({ token: tokenInput.trim() }) });
    setBusy(null);
    if (r.ok) { setTokenInput(''); setTokenSet(true); }
    flash(r.ok, r.ok ? 'Token gespeichert.' : r.data?.error || 'Fehler');
  };

  const life = async (path: '/start' | '/stop' | '/restart', msg: string) => {
    setBusy('life');
    const r = await botCall('salenet', path, { method: 'POST' });
    setBusy(null);
    flash(r.ok, r.ok ? msg : r.data?.error || 'Fehler');
    loadStatus();
  };

  const post = async (path: string, msg: string) => {
    setBusy(path);
    const r = await botCall('salenet', path, { method: 'POST', body: JSON.stringify({}) });
    setBusy(null);
    flash(r.ok, r.ok ? msg : r.data?.error || 'Fehler');
  };

  const online = status?.status === 'online';
  // Kanal-/Rollenlisten holt der Bot selbst aus der Guild — nur wenn er läuft.
  const dir = useGuildDirectory('salenet', online);

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto md:py-2">
        <Link href="/bots" className="inline-flex items-center gap-1.5 text-[13px] text-white/40 hover:text-white/70 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Alle Bots
        </Link>

        {/* Header */}
        <div className="glass-card rounded-2xl p-5 mb-5 flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-accent/15 border border-accent/25 flex items-center justify-center">
              <Bot className="w-6 h-6 text-accent-light" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold">SaleNet-Support-Bot</h1>
                <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-medium ${online ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300/80'}`}>
                  <Circle className={`w-2 h-2 ${online ? 'fill-emerald-400 text-emerald-400' : 'fill-red-400 text-red-400'}`} />
                  {online ? 'Online' : status?.status === 'disabled' ? 'Kein Token' : 'Offline'}
                </span>
              </div>
              <div className="text-[12px] text-white/40 truncate">
                {status?.guild_name ? `${status.guild_name} · ` : ''}
                {status?.member_count ? `${status.member_count} Mitglieder` : 'LawNet Sales'}
                {status?.last_error ? ` · ${status.last_error}` : ''}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ActionBtn busy={busy === 'life' && online} onClick={() => life(online ? '/stop' : '/start', online ? 'Bot gestoppt.' : 'Bot gestartet.')} icon={online ? Square : Play} label={online ? 'Stop' : 'Start'} />
            <ActionBtn busy={busy === 'life'} onClick={() => life('/restart', 'Bot neu gestartet.')} icon={RotateCw} label="Neustart" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 overflow-x-auto scrollbar-hide">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] whitespace-nowrap transition-colors ${tab === t.id ? 'bg-white/[0.08] text-white' : 'text-white/45 hover:text-white/75 hover:bg-white/[0.04]'}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="glass-card rounded-2xl p-8 flex items-center justify-center text-white/40">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Lade…
          </div>
        ) : (
          <>
            {tab === 'general' && (
              <div className="space-y-4">
                <div className="glass-card rounded-2xl p-5 space-y-4">
                  <h2 className="text-sm font-semibold text-white/70">Verbindung</h2>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Field label={`Bot-Token ${tokenSet ? '(gesetzt — leer lassen = unverändert)' : ''}`} value={tokenInput} onChange={setTokenInput} type="password" placeholder={tokenSet ? '•••••••• (gesetzt)' : 'Token einfügen'} />
                    </div>
                    <button onClick={saveToken} disabled={busy === 'token' || !tokenInput.trim()} className="px-4 py-2 rounded-xl text-sm bg-accent/20 border border-accent/25 text-accent-light hover:bg-accent/30 disabled:opacity-40">
                      {busy === 'token' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Setzen'}
                    </button>
                  </div>
                  <Field label="Guild-ID (Server)" value={cfg.discord_guild_id || ''} onChange={v => set('discord_guild_id', v)} placeholder="123456789012345678" mono />
                </div>

                <div className="glass-card rounded-2xl p-5 space-y-4">
                  <h2 className="text-sm font-semibold text-white/70">Kanäle</h2>
                  <DirectoryStatus dir={dir} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {CHANNELS.map(c => (
                      <ChannelPicker key={c.key} label={c.label} kind={c.kind || 'text'} value={cfg[c.key] || ''} onChange={v => set(c.key, v)} dir={dir} />
                    ))}
                    <RolePicker label="Support-Rolle (Tickets)" value={cfg.discord_ticket_support_role_id || ''} onChange={v => set('discord_ticket_support_role_id', v)} dir={dir} />
                  </div>
                </div>

                <div className="glass-card rounded-2xl p-5 space-y-4">
                  <h2 className="text-sm font-semibold text-white/70">Willkommen / Verabschiedung</h2>
                  <div>
                    <label className="block">
                      <span className="text-[12px] text-white/45 mb-1.5 block">Willkommens-Text</span>
                      <textarea ref={welcomeRef} value={cfg.discord_welcome_message || ''} onChange={e => set('discord_welcome_message', e.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl bg-black/25 border border-white/[0.08] text-sm text-white/85 outline-none focus:border-accent/40 resize-y" />
                    </label>
                    <PlaceholderChips tokens={['{user}', '{server}']} value={cfg.discord_welcome_message || ''} onChange={v => set('discord_welcome_message', v)} textareaRef={welcomeRef} />
                  </div>
                  <div>
                    <label className="block">
                      <span className="text-[12px] text-white/45 mb-1.5 block">Verabschiedungs-Text</span>
                      <textarea ref={leaveRef} value={cfg.discord_leave_message || ''} onChange={e => set('discord_leave_message', e.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl bg-black/25 border border-white/[0.08] text-sm text-white/85 outline-none focus:border-accent/40 resize-y" />
                    </label>
                    <PlaceholderChips tokens={['{user}', '{server}']} value={cfg.discord_leave_message || ''} onChange={v => set('discord_leave_message', v)} textareaRef={leaveRef} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <SaveBtn busy={busy === 'save'} onSave={saveConfig} />
                  <ActionBtn busy={busy === '/test-notify'} onClick={() => post('/test-notify', 'Test-Benachrichtigung gesendet.')} icon={Send} label="Test-Benachrichtigung" />
                </div>
              </div>
            )}

            {tab === 'content' && <ContentTab flash={flash} post={post} busy={busy} setBusy={setBusy} dir={dir} />}
            {tab === 'moderation' && <ModerationTab flash={flash} dir={dir} />}
            {tab === 'tickets' && <TicketsTab flash={flash} />}
            {tab === 'automod' && <AutomodTab flash={flash} />}
            {tab === 'github' && <GithubTab flash={flash} />}
            {tab === 'logs' && <LogsTab />}
          </>
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

function ContentTab({ flash, post, busy, setBusy, dir }: { flash: (ok: boolean, m: string) => void; post: (p: string, m: string) => void; busy: string | null; setBusy: (v: string | null) => void; dir: Directory }) {
  const [cfg, setCfg] = useState<Cfg>({});
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { (async () => { const r = await botCall<Cfg>('salenet', '/content/config'); if (r.ok) setCfg(r.data || {}); setLoaded(true); })(); }, []);
  const set = (k: string, v: string) => setCfg(p => ({ ...p, [k]: v }));
  const save = async () => { setBusy('save'); const r = await botCall('salenet', '/content/config', { method: 'PUT', body: JSON.stringify(cfg) }); setBusy(null); flash(r.ok, r.ok ? 'Gespeichert.' : r.data?.error || 'Fehler'); };
  const syncProducts = async () => { setBusy('sync'); const r = await botCall<{ synced?: number; error?: string }>('salenet', '/sync-products', { method: 'POST' }); setBusy(null); flash(r.ok, r.ok ? `${r.data.synced ?? 0} Produkte synchronisiert.` : r.data?.error || 'Fehler'); };
  if (!loaded) return <div className="glass-card rounded-2xl p-6 text-white/40 text-sm">Lade…</div>;
  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ChannelPicker label="Regeln — Kanal" value={cfg.content_rules_channel_id || ''} onChange={v => set('content_rules_channel_id', v)} dir={dir} />
        <ChannelPicker label="Produkte — Kanal" value={cfg.content_products_channel_id || ''} onChange={v => set('content_products_channel_id', v)} dir={dir} />
        <ChannelPicker label="Links — Kanal" value={cfg.content_links_channel_id || ''} onChange={v => set('content_links_channel_id', v)} dir={dir} />
        <ChannelPicker label="Systemstatus — Kanal" value={cfg.content_status_channel_id || ''} onChange={v => set('content_status_channel_id', v)} dir={dir} />
      </div>
      <div className="glass-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-white/70">Systemstatus automatisch aktualisieren (Sticky)</span>
          <Toggle checked={cfg.content_status_auto === '1'} onChange={v => set('content_status_auto', v ? '1' : '0')} />
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <SaveBtn busy={busy === 'save'} onSave={save} />
        <ActionBtn busy={busy === '/content/post-rules'} onClick={() => post('/content/post-rules', 'Regeln gepostet.')} icon={Send} label="Regeln" />
        <ActionBtn busy={busy === '/content/post-products'} onClick={() => post('/content/post-products', 'Produkte gepostet.')} icon={Send} label="Produkte" />
        <ActionBtn busy={busy === '/content/post-links'} onClick={() => post('/content/post-links', 'Links gepostet.')} icon={Send} label="Links" />
        <ActionBtn busy={busy === '/content/post-status'} onClick={() => post('/content/post-status', 'Status gepostet.')} icon={Send} label="Systemstatus" />
        <ActionBtn busy={busy === 'sync'} onClick={syncProducts} icon={RefreshCw} label="Produkte aus SaleNet holen" />
      </div>
    </div>
  );
}

// Slowmode-Stufen wie in Discord selbst, damit niemand Sekunden ausrechnen muss.
const SLOWMODE_STEPS: { value: number; label: string }[] = [
  { value: 0, label: 'Aus' },
  { value: 5, label: '5 Sekunden' },
  { value: 30, label: '30 Sekunden' },
  { value: 60, label: '1 Minute' },
  { value: 300, label: '5 Minuten' },
  { value: 900, label: '15 Minuten' },
  { value: 3600, label: '1 Stunde' },
  { value: 21600, label: '6 Stunden' },
];

function ModerationTab({ flash, dir }: { flash: (ok: boolean, m: string) => void; dir: Directory }) {
  const [actions, setActions] = useState<any[]>([]);
  const [form, setForm] = useState({ action: 'warn', target_user_id: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState({ channel_id: '', seconds: 30 });
  const load = useCallback(async () => { const r = await botCall<any[]>('salenet', '/mod-actions'); if (r.ok) setActions(Array.isArray(r.data) ? r.data : []); }, []);
  useEffect(() => { load(); }, [load]);

  const applySlowmode = async () => {
    if (!slow.channel_id) { flash(false, 'Kein Kanal gewählt'); return; }
    setBusy(true);
    const r = await botCall('salenet', '/mod/slowmode', { method: 'POST', body: JSON.stringify(slow) });
    setBusy(false);
    const label = SLOWMODE_STEPS.find(s => s.value === slow.seconds)?.label || `${slow.seconds}s`;
    flash(r.ok, r.ok ? (slow.seconds === 0 ? 'Slowmode abgeschaltet.' : `Slowmode auf ${label} gesetzt.`) : (r.data as any)?.error || 'Fehler');
    if (r.ok) load();
  };
  const exec = async () => {
    if (!form.target_user_id.trim()) { flash(false, 'User-ID fehlt'); return; }
    setBusy(true);
    const r = await botCall('salenet', '/mod/execute', { method: 'POST', body: JSON.stringify(form) });
    setBusy(false);
    flash(r.ok, r.ok ? 'Aktion ausgeführt.' : r.data?.error || 'Fehler');
    if (r.ok) { setForm({ ...form, target_user_id: '', reason: '' }); load(); }
  };
  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white/70">Aktion ausführen</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="block">
            <span className="text-[12px] text-white/45 mb-1.5 block">Aktion</span>
            <select value={form.action} onChange={e => setForm({ ...form, action: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-black/25 border border-white/[0.08] text-sm text-white/85 outline-none">
              <option value="warn">Verwarnen</option>
              <option value="kick">Kicken</option>
              <option value="ban">Bannen</option>
            </select>
          </label>
          <Field label="User-ID" value={form.target_user_id} onChange={v => setForm({ ...form, target_user_id: v })} mono />
          <Field label="Grund" value={form.reason} onChange={v => setForm({ ...form, reason: v })} />
        </div>
        <ActionBtn busy={busy} onClick={exec} icon={ShieldAlert} label="Ausführen" />
      </div>
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-white/70">Slowmode</h2>
          <p className="text-[12px] text-white/40 mt-0.5">Begrenzt, wie oft jemand in einem Kanal schreiben darf.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ChannelPicker label="Kanal" value={slow.channel_id} onChange={v => setSlow({ ...slow, channel_id: v })} dir={dir} />
          <label className="block">
            <span className="text-[12px] text-white/45 mb-1.5 block">Wartezeit</span>
            <select value={slow.seconds} onChange={e => setSlow({ ...slow, seconds: parseInt(e.target.value, 10) })}
              className="w-full px-3 py-2 rounded-xl bg-black/25 border border-white/[0.08] text-sm text-white/85 outline-none">
              {SLOWMODE_STEPS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <div className="flex items-end">
            <ActionBtn busy={busy} onClick={applySlowmode} icon={Clock} label="Setzen" />
          </div>
        </div>
      </div>
      <div className="glass-card rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white/70 mb-3">Letzte Aktionen</h2>
        {actions.length === 0 ? <div className="text-white/30 text-sm py-4 text-center">Keine Einträge.</div> : (
          <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-hide text-[13px]">
            {actions.map((a, i) => (
              <div key={a.id ?? i} className="flex gap-3 px-3 py-1.5 rounded-lg hover:bg-white/[0.03]">
                <span className="text-accent-light/70 w-16">{a.action}</span>
                <span className="text-white/60 flex-1 truncate">{a.target_username || a.target_user_id} — {a.reason || '—'}</span>
                <span className="text-white/30 text-[11px]">{(a.created_at || '').slice(5, 16)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TicketsTab({ flash }: { flash: (ok: boolean, m: string) => void }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const load = useCallback(async () => { const r = await botCall<any[]>('salenet', '/tickets'); if (r.ok) setTickets(Array.isArray(r.data) ? r.data : []); }, []);
  useEffect(() => { load(); }, [load]);
  const close = async (id: number) => { const r = await botCall('salenet', `/tickets/${id}/close`, { method: 'PATCH' }); flash(r.ok, r.ok ? 'Ticket geschlossen.' : r.data?.error || 'Fehler'); if (r.ok) load(); };
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white/70">Tickets</h2>
        <ActionBtn busy={false} onClick={load} icon={RefreshCw} label="Neu laden" small />
      </div>
      {tickets.length === 0 ? <div className="text-white/30 text-sm py-6 text-center">Keine Tickets.</div> : (
        <div className="space-y-1.5">
          {tickets.map(t => (
            <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] text-[13px]">
              <span className={`w-2 h-2 rounded-full ${t.status === 'open' ? 'bg-emerald-400' : 'bg-white/25'}`} />
              <span className="text-white/70 w-20 capitalize">{t.category || '—'}</span>
              <span className="text-white/55 flex-1 truncate">{t.username || t.user_id}</span>
              {t.status === 'open' && <button onClick={() => close(t.id)} className="text-[12px] text-red-300/80 hover:text-red-300">Schließen</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AutomodTab({ flash }: { flash: (ok: boolean, m: string) => void }) {
  const [rules, setRules] = useState<any[]>([]);
  const [form, setForm] = useState({ type: 'word', pattern: '', action: 'delete' });
  const load = useCallback(async () => { const r = await botCall<any[]>('salenet', '/automod'); if (r.ok) setRules(Array.isArray(r.data) ? r.data : []); }, []);
  useEffect(() => { load(); }, [load]);
  const create = async () => { const r = await botCall('salenet', '/automod', { method: 'POST', body: JSON.stringify(form) }); flash(r.ok, r.ok ? 'Regel erstellt.' : r.data?.error || 'Fehler'); if (r.ok) { setForm({ ...form, pattern: '' }); load(); } };
  const del = async (id: number) => { const r = await botCall('salenet', `/automod/${id}`, { method: 'DELETE' }); flash(r.ok, r.ok ? 'Regel gelöscht.' : 'Fehler'); if (r.ok) load(); };
  const toggle = async (r: any) => { const res = await botCall('salenet', `/automod/${r.id}`, { method: 'PUT', body: JSON.stringify({ is_active: r.is_active ? 0 : 1 }) }); if (res.ok) load(); };
  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white/70">Neue Regel</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="block">
            <span className="text-[12px] text-white/45 mb-1.5 block">Typ</span>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-black/25 border border-white/[0.08] text-sm text-white/85 outline-none">
              <option value="word">Wort-Filter</option>
              <option value="invite">Invite-Filter</option>
              <option value="spam">Spam-Filter</option>
            </select>
          </label>
          <Field label="Muster / Wort" value={form.pattern} onChange={v => setForm({ ...form, pattern: v })} />
          <label className="block">
            <span className="text-[12px] text-white/45 mb-1.5 block">Aktion</span>
            <select value={form.action} onChange={e => setForm({ ...form, action: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-black/25 border border-white/[0.08] text-sm text-white/85 outline-none">
              <option value="delete">Löschen</option>
              <option value="warn">Verwarnen</option>
              <option value="delete_and_warn">Löschen + Verwarnen</option>
            </select>
          </label>
        </div>
        <ActionBtn busy={false} onClick={create} icon={Plus} label="Regel hinzufügen" />
      </div>
      <div className="glass-card rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white/70 mb-3">Regeln</h2>
        {rules.length === 0 ? <div className="text-white/30 text-sm py-4 text-center">Keine Regeln.</div> : (
          <div className="space-y-1.5">
            {rules.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] text-[13px]">
                <span className="text-accent-light/70 w-16">{r.type}</span>
                <span className="text-white/60 flex-1 truncate">{r.pattern || '—'} → {r.action}</span>
                <Toggle checked={!!r.is_active} onChange={() => toggle(r)} />
                <button onClick={() => del(r.id)} className="text-white/30 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GithubTab({ flash }: { flash: (ok: boolean, m: string) => void }) {
  const [cfg, setCfg] = useState<Cfg>({});
  const [subs, setSubs] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [hook, setHook] = useState<any>(null);
  const load = useCallback(async () => {
    const c = await botCall<Cfg>('salenet', '/github/config'); if (c.ok) setCfg(c.data || {});
    const s = await botCall<any[]>('salenet', '/github/subscriptions'); if (s.ok) setSubs(Array.isArray(s.data) ? s.data : []);
    const w = await botCall<any>('salenet', '/github/webhook-info'); if (w.ok) setHook(w.data);
  }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: string, v: string) => setCfg(p => ({ ...p, [k]: v }));
  const save = async () => { setBusy(true); const r = await botCall('salenet', '/github/config', { method: 'PUT', body: JSON.stringify(cfg) }); setBusy(false); flash(r.ok, r.ok ? 'Gespeichert.' : r.data?.error || 'Fehler'); };
  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white/70">GitHub-Konfiguration</h2>
        <Field label="Personal Access Token (PAT)" value={cfg.github_pat || ''} onChange={v => set('github_pat', v)} type="password" placeholder="ghp_…" mono />
        <Field label="Organisation" value={cfg.github_org || ''} onChange={v => set('github_org', v)} placeholder="LawNet-Team" />
        <Field label="Webhook-Secret" value={cfg.github_webhook_secret || ''} onChange={v => set('github_webhook_secret', v)} type="password" mono />
        <SaveBtn busy={busy} onSave={save} />
      </div>
      {hook && (
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-white/40" />
            <h2 className="text-sm font-semibold text-white/70">Webhook bei GitHub eintragen</h2>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-xl bg-black/30 border border-white/[0.08] font-mono text-[12px] text-white/75 truncate">{hook.url}</code>
            <button
              type="button"
              onClick={() => { navigator.clipboard?.writeText(hook.url); flash(true, 'Adresse kopiert.'); }}
              className="px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-[13px] text-white/70 transition-colors"
            >
              Kopieren
            </button>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[12px] text-white/40">
            <span>Content-Type: <span className="text-white/60">{hook.content_type}</span></span>
            <span>Secret: <span className={hook.secret_configured ? 'text-emerald-300/80' : 'text-amber-300/80'}>{hook.secret_configured ? 'gesetzt' : 'fehlt'}</span></span>
            <span>Ereignisse: <span className="text-white/60">{(hook.events_supported || []).join(', ')}</span></span>
          </div>
        </div>
      )}
      <div className="glass-card rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white/70 mb-3">Repo-Abonnements ({subs.length})</h2>
        {subs.length === 0 ? <div className="text-white/30 text-sm py-4 text-center">Keine Abonnements.</div> : (
          <div className="space-y-1.5 text-[13px]">
            {subs.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02]">
                <span className="text-white/70 flex-1 truncate">{s.repo_full_name}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-md ${s.is_active ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/[0.05] text-white/40'}`}>{s.is_active ? 'aktiv' : 'aus'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { const r = await botCall<any[]>('salenet', '/logs?limit=100'); if (r.ok) setLogs(Array.isArray(r.data) ? r.data : []); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white/70">Bot-Logs</h2>
        <ActionBtn busy={false} onClick={load} icon={RefreshCw} label="Neu laden" small />
      </div>
      {loading ? <div className="text-white/40 text-sm py-6 text-center"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Lade…</div>
        : logs.length === 0 ? <div className="text-white/30 text-sm py-6 text-center">Keine Einträge.</div> : (
          <div className="max-h-[55vh] overflow-y-auto space-y-1 scrollbar-hide font-mono text-[12px]">
            {logs.map((l, i) => (
              <div key={l.id ?? i} className="flex gap-3 px-3 py-1.5 rounded-lg hover:bg-white/[0.03]">
                <span className="text-white/30 whitespace-nowrap">{(l.created_at || '').slice(5, 16)}</span>
                <span className="text-accent-light/70 whitespace-nowrap">{l.event_type}</span>
                <span className="text-white/55 truncate">{typeof l.payload === 'string' ? l.payload : JSON.stringify(l.payload)}</span>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
