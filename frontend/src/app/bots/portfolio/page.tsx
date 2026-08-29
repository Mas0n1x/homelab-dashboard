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
  Bot, Circle, Play, Square, Save, Send, KeyRound, Hash, MessageSquare,
  Server as ServerIcon, Github, ScrollText, ArrowLeft, Users, Activity,
  RefreshCw, Trash2, Loader2, CheckCircle2, AlertTriangle, Ticket, Pickaxe,
} from 'lucide-react';
import { PageTransition } from '@/components/ui/PageTransition';
import { botCall } from '@/lib/api';
import {
  EmbedMessageEditor, RulesMessageEditor, ProductsMessageEditor,
  SocialMessageEditor, TicketCategoriesEditor, EmojiField,
} from '@/components/bots/ContentEditors';
import {
  useGuildDirectory, ChannelPicker, RolePicker, DirectoryStatus, type Directory,
} from '@/components/bots/IdPicker';

type Cfg = Record<string, string>;
type Tab = 'general' | 'channels' | 'messages' | 'tickets' | 'servers' | 'minecraft' | 'github' | 'logs';

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'general', label: 'Allgemein', icon: Bot },
  { id: 'channels', label: 'Kanäle', icon: Hash },
  { id: 'messages', label: 'Nachrichten', icon: MessageSquare },
  { id: 'tickets', label: 'Tickets', icon: Ticket },
  { id: 'servers', label: 'Meine Server', icon: ServerIcon },
  { id: 'minecraft', label: 'Minecraft', icon: Pickaxe },
  { id: 'github', label: 'GitHub', icon: Github },
  { id: 'logs', label: 'Logs', icon: ScrollText },
];

// Feinschalter des Moderation-Logs. Fehlender Wert = aktiv (der Bot prüft
// ausschließlich auf 'false'), darum unten Toggle checked={… !== 'false'}.
const MODLOG_EVENTS: { key: string; label: string }[] = [
  { key: 'modlog_message_delete', label: 'Gelöschte Nachrichten' },
  { key: 'modlog_message_edit', label: 'Bearbeitete Nachrichten' },
  { key: 'modlog_bans', label: 'Bans & Kicks' },
  { key: 'modlog_timeouts', label: 'Timeouts' },
  { key: 'modlog_role_changes', label: 'Rollenänderungen' },
  { key: 'modlog_nickname', label: 'Namensänderungen' },
  { key: 'modlog_channels', label: 'Kanäle erstellt / gelöscht' },
  { key: 'modlog_audit', label: 'Übrige Server-Aktionen' },
];

const CHANNELS: { key: string; label: string; kind?: 'text' | 'category' }[] = [
  { key: 'channel_welcome', label: 'Willkommen / Verabschiedung' },
  { key: 'channel_rules', label: 'Regeln' },
  { key: 'channel_products', label: 'Produkte / Services' },
  { key: 'channel_projects', label: 'Meine Projekte' },
  { key: 'channel_servers', label: 'Meine Server (Live-Status)' },
  { key: 'channel_social', label: 'Social Media' },
  { key: 'channel_github', label: 'GitHub-Benachrichtigungen' },
  { key: 'channel_tickets', label: 'Tickets (Kategorie)', kind: 'category' },
  { key: 'channel_ticket_logs', label: 'Ticket-Logs' },
  { key: 'channel_modlog', label: 'Moderation-Log' },
  { key: 'channel_requests', label: 'Anfragen / Benachrichtigungen' },
];

const ROLES: { key: string; label: string }[] = [
  { key: 'role_autorole', label: 'Auto-Rolle (nach Regel-Akzept)' },
  { key: 'role_support', label: 'Support-Rolle (Tickets)' },
  { key: 'requests_ping_role', label: 'Ping-Rolle (neue Anfragen)' },
];

function fmtUptime(ms?: number): string {
  if (!ms || ms <= 0) return '—';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

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
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 rounded-xl bg-black/25 border border-white/[0.08] text-sm text-white/85 outline-none focus:border-accent/40 transition-colors ${mono ? 'font-mono text-[12px]' : ''}`}
      />
    </label>
  );
}

export default function PortfolioBotPage() {
  const [tab, setTab] = useState<Tab>('general');
  const [cfg, setCfg] = useState<Cfg>({});
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const flash = (ok: boolean, msg: string) => { setToast({ ok, msg }); setTimeout(() => setToast(null), 3500); };

  const loadStatus = useCallback(async () => {
    const r = await botCall('portfolio', '/status');
    if (r.ok) setStatus(r.data);
  }, []);

  const loadConfig = useCallback(async () => {
    const r = await botCall<Cfg>('portfolio', '/config');
    if (r.ok) setCfg(r.data || {});
    setLoading(false);
  }, []);

  useEffect(() => {
    loadConfig();
    loadStatus();
    const t = setInterval(loadStatus, 15000);
    return () => clearInterval(t);
  }, [loadConfig, loadStatus]);

  const set = (k: string, v: string) => setCfg(prev => ({ ...prev, [k]: v }));

  const saveConfig = async (partial?: Cfg) => {
    setBusy('save');
    const body = partial || cfg;
    const r = await botCall('portfolio', '/config', { method: 'POST', body: JSON.stringify(body) });
    setBusy(null);
    flash(r.ok, r.ok ? 'Gespeichert.' : r.data?.error || 'Speichern fehlgeschlagen');
  };

  const power = async (on: boolean) => {
    setBusy('power');
    const r = await botCall('portfolio', on ? '/connect' : '/disconnect', { method: 'POST' });
    setBusy(null);
    flash(r.ok, r.ok ? (on ? 'Bot verbunden.' : 'Bot getrennt.') : r.data?.error || 'Fehler');
    loadStatus();
  };

  const action = async (path: string, okMsg: string, body?: any) => {
    setBusy(path);
    const r = await botCall('portfolio', path, { method: 'POST', body: JSON.stringify(body || {}) });
    setBusy(null);
    flash(r.ok, r.ok ? okMsg : r.data?.error || 'Fehler');
  };

  const connected = !!status?.connected;
  // Kanal-/Rollenlisten kommen aus dem laufenden Bot — deshalb erst, wenn er verbunden ist.
  const dir = useGuildDirectory('portfolio', connected);

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto md:py-2">
        {/* Breadcrumb + header */}
        <Link href="/bots" className="inline-flex items-center gap-1.5 text-[13px] text-white/40 hover:text-white/70 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Alle Bots
        </Link>

        <div className="glass-card rounded-2xl p-5 mb-5 flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {status?.avatar ? (
              <img src={status.avatar} alt="" className="w-12 h-12 rounded-2xl" />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-accent/15 border border-accent/25 flex items-center justify-center">
                <Bot className="w-6 h-6 text-accent-light" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold">Portfolio-Bot</h1>
                <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-medium ${connected ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300/80'}`}>
                  <Circle className={`w-2 h-2 ${connected ? 'fill-emerald-400 text-emerald-400' : 'fill-red-400 text-red-400'}`} />
                  {connected ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="text-[12px] text-white/40 truncate">
                {connected && status?.guild ? `${status.guild.name} · ` : ''}
                {status?.username || 'Mas0n1x Development'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {connected && (
              <div className="hidden sm:flex items-center gap-4 text-[12px] text-white/45">
                <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> {status?.memberCount ?? 0}</span>
                <span className="flex items-center gap-1.5"><Activity className="w-4 h-4" /> {status?.ping ?? 0} ms</span>
                <span>↑ {fmtUptime(status?.uptime)}</span>
              </div>
            )}
            <button
              onClick={() => power(!connected)}
              disabled={busy === 'power'}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${connected ? 'bg-red-500/15 text-red-300 hover:bg-red-500/25' : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25'} disabled:opacity-50`}
            >
              {busy === 'power' ? <Loader2 className="w-4 h-4 animate-spin" /> : connected ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {connected ? 'Trennen' : 'Verbinden'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 overflow-x-auto scrollbar-hide">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] whitespace-nowrap transition-colors ${tab === t.id ? 'bg-white/[0.08] text-white' : 'text-white/45 hover:text-white/75 hover:bg-white/[0.04]'}`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="glass-card rounded-2xl p-8 flex items-center justify-center text-white/40">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Lade Konfiguration…
          </div>
        ) : (
          <>
            {tab === 'general' && (
              <div className="space-y-4">
                <div className="glass-card rounded-2xl p-5 space-y-4">
                  <h2 className="text-sm font-semibold text-white/70">Verbindung</h2>
                  <Field label="Bot-Token (nur schreiben; leer lassen = unverändert)" value={cfg.bot_token || ''} onChange={v => set('bot_token', v)} type="password" placeholder={cfg.has_token ? '•••••••• (gesetzt)' : 'Token einfügen'} />
                  {Array.isArray(status?.availableGuilds) && status.availableGuilds.length > 0 ? (
                    <label className="block">
                      <span className="text-[12px] text-white/45 mb-1.5 block">Server</span>
                      <select
                        value={cfg.guild_id || ''}
                        onChange={e => set('guild_id', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-black/25 border border-white/[0.08] text-sm text-white/85 outline-none focus:border-accent/40"
                      >
                        <option value="">Server wählen…</option>
                        {status.availableGuilds.map((g: any) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                        {cfg.guild_id && !status.availableGuilds.some((g: any) => g.id === cfg.guild_id) && (
                          <option value={cfg.guild_id}>Unbekannt ({cfg.guild_id})</option>
                        )}
                      </select>
                    </label>
                  ) : (
                    <Field label="Guild-ID (Server)" value={cfg.guild_id || ''} onChange={v => set('guild_id', v)} placeholder="123456789012345678" />
                  )}
                </div>
                <div className="glass-card rounded-2xl p-5 space-y-3">
                  <h2 className="text-sm font-semibold text-white/70 mb-1">Funktionen</h2>
                  {[
                    { key: 'welcome_enabled', label: 'Willkommensnachrichten' },
                    { key: 'leave_enabled', label: 'Verabschiedungen' },
                    { key: 'modlog_enabled', label: 'Moderation-Log' },
                    { key: 'modlog_member_join', label: 'Mod-Log: Beitritte' },
                    { key: 'modlog_member_leave', label: 'Mod-Log: Verlassen' },
                    { key: 'modlog_audit', label: 'Mod-Log: Server-Aktionen (Audit)' },
                    { key: 'requests_enabled', label: 'Anfragen-Benachrichtigungen' },
                  ].map(row => (
                    <div key={row.key} className="flex items-center justify-between py-1">
                      <span className="text-[13px] text-white/70">{row.label}</span>
                      <Toggle checked={cfg[row.key] !== 'false'} onChange={v => set(row.key, v ? 'true' : 'false')} />
                    </div>
                  ))}
                </div>
                <div className={`glass-card rounded-2xl p-5 space-y-3 transition-opacity ${cfg.modlog_enabled === 'false' ? 'opacity-40' : ''}`}>
                  <div className="mb-1">
                    <h2 className="text-sm font-semibold text-white/70">Was das Moderation-Log erfasst</h2>
                    <p className="text-[12px] text-white/40 mt-0.5">
                      {cfg.modlog_enabled === 'false'
                        ? 'Das Moderation-Log ist oben abgeschaltet — diese Schalter greifen erst danach.'
                        : 'Gilt für den Kanal unter „Kanäle → Moderation-Log".'}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
                    {MODLOG_EVENTS.map(row => (
                      <div key={row.key} className="flex items-center justify-between py-1">
                        <span className="text-[13px] text-white/70">{row.label}</span>
                        <Toggle checked={cfg[row.key] !== 'false'} onChange={v => set(row.key, v ? 'true' : 'false')} />
                      </div>
                    ))}
                  </div>
                </div>
                <SaveBar busy={busy === 'save'} onSave={() => saveConfig()} />
              </div>
            )}

            {tab === 'channels' && (
              <div className="space-y-4">
                <div className="glass-card rounded-2xl p-5 space-y-4">
                  <DirectoryStatus dir={dir} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {CHANNELS.map(c => (
                      <ChannelPicker key={c.key} label={c.label} kind={c.kind || 'text'} value={cfg[c.key] || ''} onChange={v => set(c.key, v)} dir={dir} />
                    ))}
                  </div>
                </div>
                <div className="glass-card rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {ROLES.map(r => (
                    <RolePicker key={r.key} label={r.label} value={cfg[r.key] || ''} onChange={v => set(r.key, v)} dir={dir} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-3">
                  <SaveBar busy={busy === 'save'} onSave={() => saveConfig()} inline />
                  <ActionBtn busy={busy === '/send-active-projects'} onClick={() => action('/send-active-projects', 'Projekte gepostet.')} icon={Send} label="Projekte posten" />
                </div>
              </div>
            )}

            {tab === 'messages' && (
              <div className="space-y-4">
                <div className="glass-card rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                  <div>
                    <EmojiField label="Regel-Reaktion (vergibt die Auto-Rolle)" value={cfg.rules_reaction_emoji || ''} onChange={v => set('rules_reaction_emoji', v)} />
                  </div>
                  <Field label="ID der geposteten Regel-Nachricht" value={cfg.rules_message_id || ''} onChange={v => set('rules_message_id', v)} placeholder="wird beim Posten gesetzt" mono />
                </div>

                <EmbedMessageEditor
                  title="Willkommen"
                  subtitle="Wird beim Beitritt im Willkommens-Kanal gepostet."
                  headerEmoji="👋"
                  withFooter
                  footerLabel="Fußzeile"
                  placeholders={['{user}', '{username}', '{server}', '{memberCount}']}
                  value={cfg.msg_welcome || ''}
                  onChange={v => set('msg_welcome', v)}
                  action={<ActionBtn busy={busy === '/send-welcome-test'} onClick={() => action('/send-welcome-test', 'Willkommen gesendet.')} icon={Send} label="Test senden" small />}
                />

                <EmbedMessageEditor
                  title="Verabschiedung"
                  subtitle="Wird gepostet, wenn jemand den Server verlässt."
                  headerEmoji="👋"
                  placeholders={['{username}', '{server}', '{memberCount}']}
                  value={cfg.msg_leave || ''}
                  onChange={v => set('msg_leave', v)}
                />

                <RulesMessageEditor
                  title="Regeln"
                  value={cfg.msg_rules || ''}
                  onChange={v => set('msg_rules', v)}
                  action={<ActionBtn busy={busy === '/send-rules'} onClick={() => action('/send-rules', 'Regeln gepostet.')} icon={Send} label="Regeln posten" small />}
                />

                <ProductsMessageEditor
                  title="Produkte"
                  value={cfg.msg_products || ''}
                  onChange={v => set('msg_products', v)}
                  action={<ActionBtn busy={busy === '/send-products'} onClick={() => action('/send-products', 'Produkte gepostet.')} icon={Send} label="Produkte posten" small />}
                />

                <SocialMessageEditor
                  title="Social Media"
                  value={cfg.msg_social || ''}
                  onChange={v => set('msg_social', v)}
                  action={<ActionBtn busy={busy === '/send-social'} onClick={() => action('/send-social', 'Social gepostet.')} icon={Send} label="Social posten" small />}
                />

                <SaveBar busy={busy === 'save'} onSave={() => saveConfig()} />
              </div>
            )}

            {tab === 'tickets' && (
              <div className="space-y-4">
                <div className="glass-card rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ChannelPicker label="Ticket-Kategorie" kind="category" value={cfg.channel_tickets || ''} onChange={v => set('channel_tickets', v)} dir={dir} />
                  <RolePicker label="Support-Rolle" value={cfg.role_support || ''} onChange={v => set('role_support', v)} dir={dir} />
                </div>
                <div className="glass-card rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-white/70 mb-2">Text im neuen Ticket</h3>
                  <textarea
                    value={cfg.ticket_welcome_msg || ''}
                    onChange={e => set('ticket_welcome_msg', e.target.value)}
                    rows={3}
                    placeholder="Beschreibe dein Anliegen so detailliert wie möglich."
                    className="w-full px-3 py-2.5 rounded-xl bg-black/30 border border-white/[0.08] text-[13px] leading-relaxed text-white/80 outline-none focus:border-accent/40 resize-y"
                  />
                </div>
                <TicketCategoriesEditor
                  title="Kategorien im Ticket-Panel"
                  value={cfg.ticket_categories || ''}
                  onChange={v => set('ticket_categories', v)}
                />
                <TicketPanelPoster
                  dir={dir}
                  busy={busy === '/send-ticket-panel'}
                  onPost={channelId => action('/send-ticket-panel', 'Ticket-Panel gepostet.', { channelId })}
                />
                <SaveBar busy={busy === 'save'} onSave={() => saveConfig()} />
              </div>
            )}

            {tab === 'servers' && (
              <div className="space-y-4">
                <div className="glass-card rounded-2xl p-5 space-y-4">
                  <h2 className="text-sm font-semibold text-white/70">Homelab-Anbindung (Serverstatus)</h2>
                  <p className="text-[12px] text-white/40">Läuft die Bot-Runtime im selben Compose-Netz, reicht die interne URL (z.B. <code className="text-white/60">http://backend:3001</code>).</p>
                  <Field label="Dashboard-API-URL" value={cfg.homelab_api_url || ''} onChange={v => set('homelab_api_url', v)} placeholder="http://backend:3001" mono />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Benutzer" value={cfg.homelab_user || ''} onChange={v => set('homelab_user', v)} />
                    <Field label="Passwort (leer = unverändert)" value={cfg.homelab_password || ''} onChange={v => set('homelab_password', v)} type="password" placeholder={cfg.has_homelab_password ? '•••••••• (gesetzt)' : ''} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Auto-Refresh (Sekunden)" value={cfg.servers_refresh_seconds || ''} onChange={v => set('servers_refresh_seconds', v)} type="number" placeholder="60" />
                    <div className="flex items-center justify-between pt-6">
                      <span className="text-[13px] text-white/70">Auto-Refresh aktiv</span>
                      <Toggle checked={cfg.servers_autorefresh_enabled !== 'false'} onChange={v => set('servers_autorefresh_enabled', v ? 'true' : 'false')} />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <SaveBar busy={busy === 'save'} onSave={() => saveConfig()} inline />
                  <ActionBtn busy={busy === 'servers-test'} onClick={async () => { setBusy('servers-test'); const r = await botCall('portfolio', '/servers-test'); setBusy(null); flash(r.ok, r.ok ? `Anbindung OK — ${r.data?.count ?? 0} Server gefunden.` : r.data?.error || 'Anbindung fehlgeschlagen'); }} icon={RefreshCw} label="Anbindung testen" />
                  <ActionBtn busy={busy === '/send-servers'} onClick={() => action('/send-servers', 'Server-Status gepostet.')} icon={Send} label="Jetzt posten" />
                </div>
              </div>
            )}

            {tab === 'minecraft' && (
              <div className="space-y-4">
                <div className="glass-card rounded-2xl p-5 space-y-4">
                  <div>
                    <h2 className="text-sm font-semibold text-white/70">Server-Status im Discord</h2>
                    <p className="text-[12px] text-white/40 mt-0.5">
                      Der Status kommt von mcstatus.io. Die gepostete Nachricht aktualisiert sich selbst — im Discord geht das auch mit <code className="text-white/60">/minecraft</code>.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Server-Adresse" value={cfg.mc_server_ip || ''} onChange={v => set('mc_server_ip', v)} placeholder="mas0n1x.online" mono />
                    <ChannelPicker label="Kanal für den Status" value={cfg.mc_channel || ''} onChange={v => set('mc_channel', v)} dir={dir} />
                  </div>
                  <Field label="Live-Karte (optional, erscheint als Button)" value={cfg.mc_map_url || ''} onChange={v => set('mc_map_url', v)} placeholder="https://map.example.com" mono />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Auto-Refresh (Sekunden, min. 60)" value={cfg.mc_refresh_seconds || ''} onChange={v => set('mc_refresh_seconds', v)} type="number" placeholder="120" />
                    <div className="flex items-center justify-between pt-6">
                      <span className="text-[13px] text-white/70">Auto-Refresh aktiv</span>
                      <Toggle checked={cfg.mc_autorefresh_enabled !== 'false'} onChange={v => set('mc_autorefresh_enabled', v ? 'true' : 'false')} />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <SaveBar busy={busy === 'save'} onSave={() => saveConfig()} inline />
                  <ActionBtn
                    busy={busy === 'mc-test'}
                    onClick={async () => {
                      setBusy('mc-test');
                      const r = await botCall<any>('portfolio', '/minecraft-test');
                      setBusy(null);
                      flash(r.ok, r.ok
                        ? (r.data?.online ? `Server ist online — ${r.data.players} Spieler${r.data.version ? `, ${r.data.version}` : ''}.` : 'Abruf hat geklappt, der Server ist offline.')
                        : r.data?.error || 'Abruf fehlgeschlagen');
                    }}
                    icon={RefreshCw}
                    label="Abruf testen"
                  />
                  <ActionBtn busy={busy === '/send-minecraft'} onClick={() => action('/send-minecraft', 'Minecraft-Status gepostet.')} icon={Send} label="Jetzt posten" />
                </div>
              </div>
            )}

            {tab === 'github' && <GithubTab cfg={cfg} set={set} saveConfig={saveConfig} busy={busy} setBusy={setBusy} flash={flash} />}

            {tab === 'logs' && <LogsTab flash={flash} />}
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className={`fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm shadow-lg border ${toast.ok ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-200' : 'bg-red-500/15 border-red-500/25 text-red-200'}`}
        >
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </motion.div>
      )}
    </PageTransition>
  );
}

function SaveBar({ busy, onSave, inline }: { busy: boolean; onSave: () => void; inline?: boolean }) {
  return (
    <button
      onClick={onSave}
      disabled={busy}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-accent/20 border border-accent/25 text-accent-light hover:bg-accent/30 transition-colors disabled:opacity-50 ${inline ? '' : 'w-full justify-center'}`}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
      Speichern
    </button>
  );
}

function ActionBtn({ busy, onClick, icon: Icon, label, small }: { busy: boolean; onClick: () => void; icon: any; label: string; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`flex items-center gap-2 rounded-xl font-medium bg-white/[0.05] border border-white/[0.08] text-white/70 hover:bg-white/[0.09] hover:text-white transition-colors disabled:opacity-50 ${small ? 'px-3 py-1.5 text-[12px]' : 'px-4 py-2.5 text-sm'}`}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {label}
    </button>
  );
}

/** Ticket-Panel in einen Kanal posten — vorher fragte ein prompt() nach der ID. */
function TicketPanelPoster({ dir, busy, onPost }: { dir: Directory; busy: boolean; onPost: (channelId: string) => void }) {
  const [channelId, setChannelId] = useState('');
  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-white/70 mb-1">Ticket-Panel posten</h3>
      <p className="text-[12px] text-white/40 mb-4">Postet die Auswahl mit den Kategorie-Buttons in einen Kanal.</p>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
        <ChannelPicker label="Ziel-Kanal" value={channelId} onChange={setChannelId} dir={dir} />
        <ActionBtn busy={busy} onClick={() => channelId && onPost(channelId)} icon={Send} label="Panel posten" />
      </div>
    </div>
  );
}

function GithubTab({ cfg, set, saveConfig, busy, setBusy, flash }: {
  cfg: Cfg; set: (k: string, v: string) => void; saveConfig: (p?: Cfg) => void;
  busy: string | null; setBusy: (v: string | null) => void; flash: (ok: boolean, msg: string) => void;
}) {
  const [repos, setRepos] = useState<any[]>([]);
  const [reposLoading, setReposLoading] = useState(false);

  const loadRepos = async () => {
    setReposLoading(true);
    const r = await botCall<{ repos?: any[]; error?: string }>('portfolio', '/github-repos');
    setReposLoading(false);
    if (r.ok) setRepos(r.data.repos || []);
    else flash(false, r.data?.error || 'Repos konnten nicht geladen werden');
  };

  const setupAll = async () => {
    setBusy('gh-all');
    const r = await botCall('portfolio', '/github-setup-all', { method: 'POST', body: JSON.stringify({ token: cfg.github_token || '' }) });
    setBusy(null);
    flash(r.ok, r.ok ? `Webhooks: ${r.data?.added?.length || 0} neu, ${r.data?.skipped?.length || 0} vorhanden.` : r.data?.error || 'Fehler');
  };

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white/70">GitHub-Benachrichtigungen</h2>
        <Field label="GitHub-Token (PAT)" value={cfg.github_token || ''} onChange={v => set('github_token', v)} type="password" placeholder="ghp_…" mono />
        <Field label="Webhook-Secret" value={cfg.github_webhook_secret || ''} onChange={v => set('github_webhook_secret', v)} type="password" mono />
        <Field label="Organisationen (Komma-getrennt)" value={cfg.github_orgs_input || ''} onChange={v => set('github_orgs_input', v)} placeholder="LawNet-Team" />
        <div className="flex flex-wrap gap-3">
          <SaveBar busy={busy === 'save'} onSave={() => saveConfig()} inline />
          <ActionBtn busy={busy === 'gh-all'} onClick={setupAll} icon={Github} label="Webhooks für alle eigenen Repos einrichten" />
          <ActionBtn busy={reposLoading} onClick={loadRepos} icon={RefreshCw} label="Repos laden" />
        </div>
      </div>

      {repos.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white/70 mb-3">Repositories ({repos.length})</h3>
          <div className="max-h-72 overflow-y-auto space-y-1 scrollbar-hide">
            {repos.map(r => (
              <div key={r.full_name} className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-white/[0.03] text-[13px]">
                <span className="text-white/70 truncate">{r.full_name}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-md ${r.selected ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/[0.05] text-white/40'}`}>
                  {r.selected ? 'aktiv' : 'aus'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LogsTab({ flash }: { flash: (ok: boolean, msg: string) => void }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const r = await botCall<any[]>('portfolio', '/logs?limit=100');
    if (r.ok) setLogs(Array.isArray(r.data) ? r.data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const clear = async () => {
    const r = await botCall('portfolio', '/logs', { method: 'DELETE' });
    flash(r.ok, r.ok ? 'Logs gelöscht.' : 'Fehler');
    if (r.ok) setLogs([]);
  };

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white/70">Aktivität</h2>
        <div className="flex gap-2">
          <ActionBtn busy={false} onClick={load} icon={RefreshCw} label="Neu laden" small />
          <ActionBtn busy={false} onClick={clear} icon={Trash2} label="Leeren" small />
        </div>
      </div>
      {loading ? (
        <div className="text-white/40 text-sm py-6 text-center"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Lade…</div>
      ) : logs.length === 0 ? (
        <div className="text-white/30 text-sm py-6 text-center">Keine Einträge.</div>
      ) : (
        <div className="max-h-[55vh] overflow-y-auto space-y-1 scrollbar-hide font-mono text-[12px]">
          {logs.map((l, i) => (
            <div key={l.id ?? i} className="flex gap-3 px-3 py-1.5 rounded-lg hover:bg-white/[0.03]">
              <span className="text-white/30 whitespace-nowrap">{l.created_at?.slice(5, 16) || ''}</span>
              <span className="text-accent-light/70 whitespace-nowrap">{l.type}</span>
              <span className="text-white/55 truncate">{typeof l.details === 'string' ? l.details : JSON.stringify(l.details)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
