/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Play, Square, RotateCw, TerminalSquare, SlidersHorizontal, Save, Send, Circle,
  Server as ServerIcon, Globe, Swords, Code2, FileText, Puzzle, Archive,
  Trash2, RotateCcw, Plus, AlertTriangle, Users, Shield, Ban, UserPlus, User,
  Map as MapIcon, ExternalLink, Layers,
} from 'lucide-react';
import { PageTransition } from '@/components/ui/PageTransition';
import { useAuthStore } from '@/stores/authStore';

const API_BASE = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:${window.location.port}/api`
  : '';

async function mcApi(endpoint: string, options?: RequestInit) {
  const { accessToken } = useAuthStore.getState();
  const res = await fetch(`${API_BASE}/minecraft${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options?.headers as Record<string, string> || {}),
    },
  });
  return res.json().catch(() => ({}));
}

const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '').replace(/\r/g, '');
function fmtSize(b: number): string {
  if (!b) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB']; const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(1)} ${u[i]}`;
}
function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; }
}

// ─── server.properties Schema ───
type FieldType = 'text' | 'number' | 'bool' | 'select';
interface PropField { key: string; label: string; type: FieldType; options?: string[]; hint?: string }
const SCHEMA: { section: string; icon: any; fields: PropField[] }[] = [
  { section: 'Server', icon: ServerIcon, fields: [
    { key: 'motd', label: 'Server-Name (MOTD)', type: 'text' },
    { key: 'max-players', label: 'Max. Spieler', type: 'number' },
    { key: 'online-mode', label: 'Online-Modus', type: 'bool', hint: 'Nur Premium-Accounts' },
    { key: 'white-list', label: 'Whitelist aktiv', type: 'bool' },
  ]},
  { section: 'Welt', icon: Globe, fields: [
    { key: 'gamemode', label: 'Spielmodus', type: 'select', options: ['survival', 'creative', 'adventure', 'spectator'] },
    { key: 'difficulty', label: 'Schwierigkeit', type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'] },
    { key: 'level-seed', label: 'Welt-Seed', type: 'text', hint: 'leer = zufällig' },
    { key: 'hardcore', label: 'Hardcore-Modus', type: 'bool' },
    { key: 'allow-nether', label: 'Nether erlauben', type: 'bool' },
    { key: 'spawn-protection', label: 'Spawn-Schutz (Blöcke)', type: 'number' },
  ]},
  { section: 'Gameplay', icon: Swords, fields: [
    { key: 'pvp', label: 'PvP (Spieler vs. Spieler)', type: 'bool' },
    { key: 'allow-flight', label: 'Fliegen erlauben', type: 'bool' },
    { key: 'view-distance', label: 'Sichtweite (Chunks)', type: 'number' },
    { key: 'spawn-monsters', label: 'Monster spawnen', type: 'bool' },
    { key: 'enable-command-block', label: 'Command-Blöcke', type: 'bool' },
  ]},
];

// Spieler-Dateien → RCON-Befehle
const PLAYER_FILES: Record<string, { add: string; remove: string; label: string; icon: any }> = {
  'whitelist.json': { add: 'whitelist add', remove: 'whitelist remove', label: 'Whitelist', icon: Users },
  'ops.json': { add: 'op', remove: 'deop', label: 'Operatoren', icon: Shield },
  'banned-players.json': { add: 'ban', remove: 'pardon', label: 'Gebannte Spieler', icon: Ban },
};

function parseProps(text: string): Map<string, string> {
  const m = new Map<string, string>();
  text.split('\n').forEach(line => {
    const t = line.trim(); if (!t || t.startsWith('#')) return;
    const i = t.indexOf('='); if (i > 0) m.set(t.slice(0, i), t.slice(i + 1));
  });
  return m;
}
function applyProps(original: string, changes: Map<string, string>): string {
  return original.split('\n').map(line => {
    const t = line.trim(); if (!t || t.startsWith('#')) return line;
    const i = t.indexOf('='); if (i <= 0) return line;
    const key = t.slice(0, i);
    return changes.has(key) ? `${key}=${changes.get(key)}` : line;
  }).join('\n');
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer ${checked ? 'bg-emerald-500/60' : 'bg-white/[0.12]'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 pointer-events-none ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

// Code-Editor mit Zeilennummern + Scroll-Sync
function CodeEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const lines = value.split('\n').length;
  return (
    <div className="flex h-[46vh] overflow-hidden bg-black/30">
      <div ref={gutterRef} className="overflow-hidden py-4 pl-3 pr-2.5 text-right text-white/20 font-mono text-[12px] leading-[1.6] select-none border-r border-white/[0.05] bg-white/[0.015]">
        {Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}
      </div>
      <textarea value={value} onChange={e => onChange(e.target.value)} spellCheck={false}
        onScroll={e => { if (gutterRef.current) gutterRef.current.scrollTop = (e.target as HTMLTextAreaElement).scrollTop; }}
        className="flex-1 resize-none bg-transparent py-4 px-3 font-mono text-[12px] leading-[1.6] text-white/75 outline-none" />
    </div>
  );
}

// Spieler-Avatar mit Fallback
function Avatar({ name }: { name: string }) {
  const [err, setErr] = useState(false);
  if (err || !name) return <div className="w-8 h-8 rounded-md bg-white/[0.05] border border-white/[0.08] flex items-center justify-center"><User className="w-4 h-4 text-white/30" /></div>;
  return <img src={`https://mc-heads.net/avatar/${encodeURIComponent(name)}/32`} alt={name} onError={() => setErr(true)} className="w-8 h-8 rounded-md" />;
}

type Tab = 'console' | 'config' | 'plugins' | 'world' | 'backups' | 'map';
const MAP_URL = 'http://45.133.9.70:8123';

export default function MinecraftPage() {
  const [status, setStatus] = useState<any>({});
  const [tab, setTab] = useState<Tab>('console');
  const [busy, setBusy] = useState(false);

  const [logs, setLogs] = useState('');
  const [command, setCommand] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  const [configs, setConfigs] = useState<string[]>([]);
  const [activeConfig, setActiveConfig] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [props, setProps] = useState<Map<string, string>>(new Map());
  const [dirty, setDirty] = useState(false);
  const [rawMode, setRawMode] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [newPlayer, setNewPlayer] = useState('');

  const isProps = activeConfig === 'server.properties';
  const playerCfg = PLAYER_FILES[activeConfig];
  const isYaml = activeConfig.endsWith('.yml') || activeConfig.endsWith('.yaml');

  const [plugins, setPlugins] = useState<any[]>([]);
  const [pluginUrl, setPluginUrl] = useState('');
  const [world, setWorld] = useState<any>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [toast, setToast] = useState('');

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2600); };
  const refreshStatus = useCallback(async () => { setStatus(await mcApi('/status')); }, []);
  const refreshLogs = useCallback(async () => { const r = await mcApi('/logs?tail=300'); if (typeof r.logs === 'string') setLogs(stripAnsi(r.logs)); }, []);

  useEffect(() => { refreshStatus(); const t = setInterval(refreshStatus, 5000); return () => clearInterval(t); }, [refreshStatus]);
  useEffect(() => { if (tab !== 'console') return; refreshLogs(); const t = setInterval(refreshLogs, 3000); return () => clearInterval(t); }, [tab, refreshLogs]);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);
  useEffect(() => {
    if (tab === 'config') {
      mcApi('/configs').then(r => {
        const files: string[] = r.files || []; setConfigs(files);
        if (files.length && !activeConfig) loadConfig(files.includes('server.properties') ? 'server.properties' : files[0]);
      });
    } else if (tab === 'plugins') loadPlugins();
    else if (tab === 'world') mcApi('/world').then(setWorld);
    else if (tab === 'backups') loadBackups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const loadPlugins = () => mcApi('/plugins').then(r => setPlugins(r.plugins || []));
  const loadBackups = () => mcApi('/backups').then(r => setBackups(r.backups || []));
  const loadConfig = async (file: string) => {
    setActiveConfig(file); setRawMode(false);
    const r = await mcApi(`/config/${file}`); const content = r.content ?? '';
    setRawContent(content);
    if (file === 'server.properties') setProps(parseProps(content));
    setDirty(false);
  };
  const setProp = (key: string, value: string) => { setProps(prev => { const n = new Map(prev); n.set(key, value); return n; }); setDirty(true); };
  const saveConfig = async () => {
    setBusy(true);
    const content = isProps && !rawMode ? applyProps(rawContent, props) : rawContent;
    await mcApi(`/config/${activeConfig}`, { method: 'PUT', body: JSON.stringify({ content }) });
    setRawContent(content); if (isProps) setProps(parseProps(content));
    setBusy(false); setDirty(false); setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1500);
  };

  // Spieler-Liste (whitelist/ops/banned)
  const playerList: string[] = (() => {
    if (!playerCfg) return [];
    try { const arr = JSON.parse(rawContent || '[]'); return Array.isArray(arr) ? arr.map((p: any) => p.name || p.uuid || String(p)) : []; } catch { return []; }
  })();
  const addPlayer = async () => {
    const name = newPlayer.trim(); if (!name || !playerCfg) return;
    setBusy(true); setNewPlayer('');
    const r = await mcApi('/command', { method: 'POST', body: JSON.stringify({ command: `${playerCfg.add} ${name}` }) });
    setBusy(false); if (r.response) flash(stripAnsi(r.response));
    setTimeout(() => loadConfig(activeConfig), 900);
  };
  const removePlayer = async (name: string) => {
    if (!playerCfg) return;
    await mcApi('/command', { method: 'POST', body: JSON.stringify({ command: `${playerCfg.remove} ${name}` }) });
    setTimeout(() => loadConfig(activeConfig), 900);
  };

  const power = async (action: string) => { setBusy(true); await mcApi('/power', { method: 'POST', body: JSON.stringify({ action }) }); setTimeout(refreshStatus, 1500); setBusy(false); };
  const sendCommand = async (e?: React.FormEvent) => {
    e?.preventDefault(); const cmd = command.trim(); if (!cmd) return;
    setCommand(''); setLogs(prev => prev + `\n> ${cmd}`);
    const r = await mcApi('/command', { method: 'POST', body: JSON.stringify({ command: cmd }) });
    if (r.response) setLogs(prev => prev + `\n${stripAnsi(r.response)}`); else if (r.error) setLogs(prev => prev + `\n[Fehler] ${r.error}`);
    setTimeout(refreshLogs, 500);
  };

  const togglePlugin = async (p: any) => { await mcApi('/plugins/toggle', { method: 'POST', body: JSON.stringify({ name: p.name, enabled: !p.enabled }) }); loadPlugins(); };
  const deletePlugin = async (p: any) => { if (!confirm(`Plugin "${p.name}" löschen?`)) return; await mcApi(`/plugins/${encodeURIComponent(p.name)}`, { method: 'DELETE' }); loadPlugins(); };
  const installPlugin = async () => {
    if (!pluginUrl.trim()) return; setBusy(true);
    const r = await mcApi('/plugins/install', { method: 'POST', body: JSON.stringify({ url: pluginUrl.trim() }) }); setBusy(false);
    if (r.ok) { setPluginUrl(''); flash(`${r.name} installiert — Neustart nötig`); loadPlugins(); } else flash(r.error || 'Fehler');
  };
  const resetWorld = async () => {
    if (!confirm('Welt WIRKLICH zurücksetzen? Alle Gebäude/Fortschritte gehen verloren! (Server startet neu)')) return;
    setBusy(true); await mcApi('/world/reset', { method: 'POST' }); setBusy(false);
    flash('Welt zurückgesetzt — neue Welt wird generiert'); setTimeout(() => mcApi('/world').then(setWorld), 3000);
  };
  const createBackup = async () => { setBusy(true); const r = await mcApi('/backups', { method: 'POST' }); setBusy(false); if (r.ok) { flash(`Backup erstellt (${fmtSize(r.size)})`); loadBackups(); } else flash(r.error || 'Fehler'); };
  const restoreBackup = async (b: any) => { if (!confirm(`Backup "${b.name}" wiederherstellen? Aktuelle Welt wird überschrieben! (Server startet neu)`)) return; setBusy(true); await mcApi(`/backups/${encodeURIComponent(b.name)}/restore`, { method: 'POST' }); setBusy(false); flash('Backup wiederhergestellt — Server startet neu'); };
  const deleteBackup = async (b: any) => { if (!confirm(`Backup "${b.name}" löschen?`)) return; await mcApi(`/backups/${encodeURIComponent(b.name)}`, { method: 'DELETE' }); loadBackups(); };

  const running = status.running;
  const statusColor = status.error ? '#6b7280' : running ? '#10b981' : '#ef4444';
  const statusText = status.error ? 'Agent nicht erreichbar' : running ? (status.health === 'healthy' ? 'Läuft' : 'Startet…') : 'Gestoppt';
  const TABS: [Tab, string, any][] = [
    ['console', 'Konsole', TerminalSquare], ['config', 'Konfiguration', SlidersHorizontal],
    ['plugins', 'Plugins', Puzzle], ['world', 'Welt', Globe], ['backups', 'Backups', Archive],
    ['map', 'Karte', MapIcon],
  ];

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold">Minecraft <span className="text-gradient">Server</span></motion.h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-white/40">
              <Circle className="w-2.5 h-2.5" style={{ fill: statusColor, color: statusColor }} />
              <span style={{ color: statusColor }}>{statusText}</span>
              <span className="text-white/20">·</span><span>45.133.9.70:25565</span>
              <span className="text-white/20">·</span><span>Paper 26.2</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button disabled={busy || running} onClick={() => power('start')} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-30 transition"><Play className="w-4 h-4" /> Start</button>
            <button disabled={busy || !running} onClick={() => power('restart')} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 disabled:opacity-30 transition"><RotateCw className="w-4 h-4" /> Neustart</button>
            <button disabled={busy || !running} onClick={() => power('stop')} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 disabled:opacity-30 transition"><Square className="w-4 h-4" /> Stopp</button>
          </div>
        </div>

        {toast && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-orange-500/10 border border-orange-500/25 px-4 py-2.5 text-sm text-orange-200">{toast}</motion.div>}

        <div className="flex items-center gap-1 border-b border-white/[0.06] overflow-x-auto">
          {TABS.map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 -mb-px whitespace-nowrap transition ${tab === id ? 'border-orange-400 text-white' : 'border-transparent text-white/40 hover:text-white/70'}`}><Icon className="w-4 h-4" /> {label}</button>
          ))}
        </div>

        {/* Konsole */}
        {tab === 'console' && (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div ref={logRef} className="h-[52vh] overflow-y-auto p-4 font-mono text-[12px] leading-relaxed text-white/70 whitespace-pre-wrap bg-black/30">{logs || 'Lade Konsole…'}</div>
            <form onSubmit={sendCommand} className="flex items-center gap-2 border-t border-white/[0.06] p-3 bg-white/[0.02]">
              <span className="text-orange-400/70 font-mono text-sm pl-1">/</span>
              <input value={command} onChange={e => setCommand(e.target.value)} placeholder="Befehl (z. B. say Hallo, time set day, gamerule keepInventory true)…" className="flex-1 bg-transparent outline-none text-sm text-white/80 placeholder:text-white/25 font-mono" />
              <button type="submit" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm bg-orange-500/15 border border-orange-500/25 text-orange-300 hover:bg-orange-500/25 transition"><Send className="w-3.5 h-3.5" /> Senden</button>
            </form>
          </div>
        )}

        {/* Konfiguration */}
        {tab === 'config' && (
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
            <div className="glass-card rounded-2xl p-3 space-y-1 h-fit">
              <p className="text-[10px] uppercase tracking-widest text-white/25 px-3 pt-1 pb-2">Dateien</p>
              {configs.map(f => {
                const pf = PLAYER_FILES[f]; const Icon = pf ? pf.icon : FileText;
                return (
                  <button key={f} onClick={() => loadConfig(f)} className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-[13px] font-mono truncate transition ${activeConfig === f ? 'bg-white/[0.06] text-white' : 'text-white/50 hover:bg-white/[0.03]'}`}><Icon className="w-3.5 h-3.5 opacity-40" /> {f}</button>
                );
              })}
              {!configs.length && <p className="text-xs text-white/25 px-3 py-2">Lade…</p>}
            </div>

            <div className="glass-card rounded-2xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-white/60">{activeConfig || '—'}</span>
                  {isYaml && <span className="text-[10px] uppercase tracking-wider text-cyan-300/60 bg-cyan-500/10 border border-cyan-500/15 rounded px-1.5 py-0.5">YAML</span>}
                  {isProps && <button onClick={() => setRawMode(m => !m)} className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/60 transition"><Code2 className="w-3 h-3" /> {rawMode ? 'Formular' : 'Rohtext'}</button>}
                </div>
                {!playerCfg && <button disabled={busy || !dirty} onClick={saveConfig} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-30 transition"><Save className="w-3.5 h-3.5" /> {savedFlash ? 'Gespeichert!' : 'Speichern'}</button>}
              </div>

              {/* server.properties → Form */}
              {isProps && !rawMode ? (
                <div className="max-h-[52vh] overflow-y-auto p-5 space-y-6">
                  {SCHEMA.map(sec => {
                    const Icon = sec.icon;
                    return (
                      <div key={sec.section}>
                        <div className="flex items-center gap-2 mb-3"><Icon className="w-4 h-4 text-orange-400/70" /><h3 className="text-xs uppercase tracking-widest text-white/40 font-medium">{sec.section}</h3></div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {sec.fields.map(field => {
                            const val = props.get(field.key) ?? '';
                            return (
                              <div key={field.key} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.02] border border-white/[0.05] px-3.5 py-2.5">
                                <div className="min-w-0"><p className="text-[13px] text-white/70 truncate">{field.label}</p>{field.hint && <p className="text-[10px] text-white/25">{field.hint}</p>}</div>
                                {field.type === 'bool' ? <Toggle checked={val === 'true'} onChange={v => setProp(field.key, v ? 'true' : 'false')} />
                                  : field.type === 'select' ? <select value={val} onChange={e => setProp(field.key, e.target.value)} className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-1 text-[13px] text-white/80 outline-none focus:border-orange-400/40 capitalize">{field.options!.map(o => <option key={o} value={o} className="bg-neutral-900">{o}</option>)}</select>
                                  : <input type={field.type === 'number' ? 'number' : 'text'} value={val} onChange={e => setProp(field.key, e.target.value)} className="w-32 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-1 text-[13px] text-white/80 outline-none focus:border-orange-400/40 text-right" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-[11px] text-white/25 pt-2 border-t border-white/[0.05]">Weitere Optionen im Rohtext-Modus. Änderungen wirken nach einem Server-Neustart.</p>
                </div>
              ) : playerCfg ? (
                /* Spieler-Listen */
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <input value={newPlayer} onChange={e => setNewPlayer(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPlayer()} placeholder="Spielername…" className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/25 outline-none focus:border-orange-400/40" />
                    <button disabled={busy || !newPlayer.trim()} onClick={addPlayer} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-30 transition"><UserPlus className="w-4 h-4" /> Hinzufügen</button>
                  </div>
                  <div className="space-y-2">
                    {playerList.length === 0 && <p className="text-sm text-white/30 py-6 text-center">Keine Einträge in {playerCfg.label}.</p>}
                    {playerList.map(name => (
                      <div key={name} className="flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/[0.05] px-3 py-2">
                        <Avatar name={name} />
                        <span className="flex-1 text-sm text-white/80 font-medium truncate">{name}</span>
                        <button onClick={() => removePlayer(name)} className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-white/25">Wirkt sofort über den laufenden Server (RCON). Der Server muss dafür laufen.</p>
                </div>
              ) : (
                /* YAML / sonstige → Code-Editor mit Zeilennummern */
                <>
                  <CodeEditor value={rawContent} onChange={v => { setRawContent(v); setDirty(true); }} />
                  <p className="text-[11px] text-white/25 px-4 py-2 border-t border-white/[0.06]">Änderungen wirken je nach Datei erst nach einem Neustart des Servers.</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Plugins */}
        {tab === 'plugins' && (
          <div className="space-y-4">
            <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
              <Puzzle className="w-4 h-4 text-orange-400/70 flex-shrink-0" />
              <input value={pluginUrl} onChange={e => setPluginUrl(e.target.value)} placeholder="Plugin-URL (.jar, z. B. von Modrinth/Spigot) einfügen…" className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/25 outline-none focus:border-orange-400/40" />
              <button disabled={busy || !pluginUrl.trim()} onClick={installPlugin} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm bg-orange-500/15 border border-orange-500/25 text-orange-300 hover:bg-orange-500/25 disabled:opacity-30 transition"><Plus className="w-4 h-4" /> Installieren</button>
            </div>
            <div className="glass-card rounded-2xl divide-y divide-white/[0.04]">
              {plugins.length === 0 && <p className="text-sm text-white/30 p-5 text-center">Keine Plugins installiert. Füge oben eine .jar-URL ein.</p>}
              {plugins.map(p => (
                <div key={p.name} className="flex items-center gap-3 px-4 py-3">
                  <Puzzle className={`w-4 h-4 flex-shrink-0 ${p.enabled ? 'text-emerald-400/70' : 'text-white/20'}`} />
                  <div className="flex-1 min-w-0"><p className={`text-sm font-mono truncate ${p.enabled ? 'text-white/80' : 'text-white/40'}`}>{p.name}</p><p className="text-[11px] text-white/25">{fmtSize(p.size)} · {p.enabled ? 'aktiv' : 'deaktiviert'}</p></div>
                  <Toggle checked={p.enabled} onChange={() => togglePlugin(p)} />
                  <button onClick={() => deletePlugin(p)} className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-white/25">Nach Installieren/Aktivieren ist ein Server-Neustart nötig.</p>
          </div>
        )}

        {/* Welt */}
        {tab === 'world' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4"><Globe className="w-4 h-4 text-cyan-400/70" /><h3 className="text-sm font-medium text-white/70">Aktuelle Welt</h3></div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-white/40">Name</span><span className="text-white/80 font-mono">{world?.name ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Größe</span><span className="text-white/80 tabular-nums">{world ? fmtSize(world.size) : '—'}</span></div>
                <div className="flex justify-between"><span className="text-white/40">Dimensionen</span><span className="text-white/80">{world?.dimensions?.length ?? 0}</span></div>
              </div>
            </div>
            <div className="glass-card rounded-2xl p-5 border border-red-500/10">
              <div className="flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4 text-red-400/70" /><h3 className="text-sm font-medium text-white/70">Welt zurücksetzen</h3></div>
              <p className="text-[13px] text-white/40 mb-4">Löscht die aktuelle Welt komplett — eine neue wird beim Neustart generiert. <span className="text-red-400/70">Nicht umkehrbar!</span> Vorher ein Backup erstellen.</p>
              <button disabled={busy} onClick={resetWorld} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm bg-red-500/10 border border-red-500/25 text-red-300 hover:bg-red-500/20 disabled:opacity-30 transition"><RotateCcw className="w-4 h-4" /> Welt zurücksetzen</button>
            </div>
          </div>
        )}

        {/* Backups */}
        {tab === 'backups' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/40">{backups.length} Backup{backups.length !== 1 ? 's' : ''} · auf dem VPS gespeichert</p>
              <button disabled={busy} onClick={createBackup} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-30 transition"><Plus className="w-4 h-4" /> {busy ? 'Erstelle…' : 'Backup erstellen'}</button>
            </div>
            <div className="glass-card rounded-2xl divide-y divide-white/[0.04]">
              {backups.length === 0 && <p className="text-sm text-white/30 p-5 text-center">Noch keine Backups. Klick oben auf „Backup erstellen".</p>}
              {backups.map(b => (
                <div key={b.name} className="flex items-center gap-3 px-4 py-3">
                  <Archive className="w-4 h-4 text-white/30 flex-shrink-0" />
                  <div className="flex-1 min-w-0"><p className="text-sm font-mono text-white/75 truncate">{b.name}</p><p className="text-[11px] text-white/25">{fmtDate(b.created)} · {fmtSize(b.size)}</p></div>
                  <button onClick={() => restoreBackup(b)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] text-amber-300/80 hover:bg-amber-500/10 transition"><RotateCcw className="w-3.5 h-3.5" /> Wiederherstellen</button>
                  <button onClick={() => deleteBackup(b)} className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-white/25">Backups sichern alle Welt-Dimensionen (Overworld, Nether, End) als komprimiertes Archiv.</p>
          </div>
        )}

        {/* Karte (BlueMap) */}
        {tab === 'map' && (
          <div className="glass-card rounded-2xl p-8 md:p-12 text-center flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center"><Layers className="w-8 h-8 text-cyan-400" /></div>
            <div>
              <h3 className="text-lg font-semibold">Live-Karte · BlueMap</h3>
              <p className="text-sm text-white/40 mt-1.5 max-w-md mx-auto">Interaktive 3D-/2D-Webkarte deiner Welt — rendert automatisch, während gespielt wird. Overworld, Nether und End.</p>
            </div>
            <a href={MAP_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium bg-cyan-500/15 border border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/25 transition">
              <ExternalLink className="w-4 h-4" /> Karte öffnen
            </a>
            <p className="text-[11px] text-white/25 max-w-md">Öffnet <span className="font-mono text-white/40">{MAP_URL}</span> in einem neuen Tab. Für die Einbettung direkt hier (HTTPS) kann ich BlueMap über den Cloudflare-Tunnel bereitstellen — sag Bescheid.</p>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
