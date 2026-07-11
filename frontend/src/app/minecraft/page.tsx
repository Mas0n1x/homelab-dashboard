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
  Map as MapIcon, ExternalLink, Layers, Folder, FileCode, ChevronRight, Home,
  Sun, Sunrise, Sunset, Moon, CloudRain, CloudLightning, Cloud, Heart, Drumstick,
  Gamepad2, LogOut,
} from 'lucide-react';
import { PageTransition } from '@/components/ui/PageTransition';
import { YamlFormEditor } from '@/components/dashboard/YamlFormEditor';
import { useAuthStore } from '@/stores/authStore';

const API_BASE = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:${window.location.port}/api`
  : '';

async function mcApi(endpoint: string, options?: RequestInit) {
  const { accessToken } = useAuthStore.getState();
  const res = await fetch(`${API_BASE}/minecraft${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...(options?.headers as Record<string, string> || {}) },
  });
  return res.json().catch(() => ({}));
}

const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '').replace(/\r/g, '');
function fmtSize(b: number): string { if (!b) return '0 B'; const u = ['B', 'KB', 'MB', 'GB']; const i = Math.floor(Math.log(b) / Math.log(1024)); return `${(b / Math.pow(1024, i)).toFixed(1)} ${u[i]}`; }
function fmtDate(iso: string): string { try { return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; } }

// server.properties Schema
type FieldType = 'text' | 'number' | 'bool' | 'select';
interface PropField { key: string; label: string; type: FieldType; options?: string[]; hint?: string }
const SCHEMA: { section: string; icon: any; fields: PropField[] }[] = [
  { section: 'Server', icon: ServerIcon, fields: [
    { key: 'motd', label: 'Server-Name (MOTD)', type: 'text' }, { key: 'max-players', label: 'Max. Spieler', type: 'number' },
    { key: 'online-mode', label: 'Online-Modus', type: 'bool', hint: 'Nur Premium-Accounts' }, { key: 'white-list', label: 'Whitelist aktiv', type: 'bool' },
  ]},
  { section: 'Welt', icon: Globe, fields: [
    { key: 'gamemode', label: 'Spielmodus', type: 'select', options: ['survival', 'creative', 'adventure', 'spectator'] },
    { key: 'difficulty', label: 'Schwierigkeit', type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'] },
    { key: 'level-seed', label: 'Welt-Seed', type: 'text', hint: 'leer = zufällig' }, { key: 'hardcore', label: 'Hardcore', type: 'bool' },
    { key: 'allow-nether', label: 'Nether erlauben', type: 'bool' }, { key: 'spawn-protection', label: 'Spawn-Schutz (Blöcke)', type: 'number' },
  ]},
  { section: 'Gameplay', icon: Swords, fields: [
    { key: 'pvp', label: 'PvP', type: 'bool' }, { key: 'allow-flight', label: 'Fliegen erlauben', type: 'bool' },
    { key: 'view-distance', label: 'Sichtweite (Chunks)', type: 'number' }, { key: 'spawn-monsters', label: 'Monster spawnen', type: 'bool' },
    { key: 'enable-command-block', label: 'Command-Blöcke', type: 'bool' },
  ]},
];
const PLAYER_FILES: Record<string, { add: string; remove: string; label: string; icon: any }> = {
  'whitelist.json': { add: 'whitelist add', remove: 'whitelist remove', label: 'Whitelist', icon: Users },
  'ops.json': { add: 'op', remove: 'deop', label: 'Operatoren', icon: Shield },
  'banned-players.json': { add: 'ban', remove: 'pardon', label: 'Gebannte Spieler', icon: Ban },
};
const GAMERULE_LABELS: Record<string, string> = {
  keep_inventory: 'Inventar nach Tod behalten', mob_griefing: 'Mob-Griefing', advance_time: 'Tag-/Nacht-Wechsel',
  fall_damage: 'Fallschaden', fire_damage: 'Feuerschaden', drowning_damage: 'Ertrinkungsschaden',
  freeze_damage: 'Kälteschaden', spawn_monsters: 'Monster spawnen', immediate_respawn: 'Sofort-Respawn',
  show_death_messages: 'Todesnachrichten', tnt_explodes: 'TNT-Explosionen',
};

function parseProps(text: string): Map<string, string> {
  const m = new Map<string, string>();
  text.split('\n').forEach(line => { const t = line.trim(); if (!t || t.startsWith('#')) return; const i = t.indexOf('='); if (i > 0) m.set(t.slice(0, i), t.slice(i + 1)); });
  return m;
}
function applyProps(original: string, changes: Map<string, string>): string {
  return original.split('\n').map(line => { const t = line.trim(); if (!t || t.startsWith('#')) return line; const i = t.indexOf('='); if (i <= 0) return line; const key = t.slice(0, i); return changes.has(key) ? `${key}=${changes.get(key)}` : line; }).join('\n');
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer ${checked ? 'bg-emerald-500/60' : 'bg-white/[0.12]'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 pointer-events-none ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}
function CodeEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const lines = value.split('\n').length;
  return (
    <div className="flex h-[46vh] overflow-hidden bg-black/30 rounded-b-2xl">
      <div ref={gutterRef} className="overflow-hidden py-4 pl-3 pr-2.5 text-right text-white/20 font-mono text-[12px] leading-[1.6] select-none border-r border-white/[0.05] bg-white/[0.015]">
        {Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}
      </div>
      <textarea value={value} onChange={e => onChange(e.target.value)} spellCheck={false}
        onScroll={e => { if (gutterRef.current) gutterRef.current.scrollTop = (e.target as HTMLTextAreaElement).scrollTop; }}
        className="flex-1 resize-none bg-transparent py-4 px-3 font-mono text-[12px] leading-[1.6] text-white/75 outline-none" />
    </div>
  );
}
function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const px = `${size}px`;
  if (err || !name) return <div style={{ width: px, height: px }} className="rounded-md bg-white/[0.05] border border-white/[0.08] flex items-center justify-center"><User className="w-1/2 h-1/2 text-white/30" /></div>;
  return <img src={`https://mc-heads.net/avatar/${encodeURIComponent(name)}/${size}`} alt={name} onError={() => setErr(true)} style={{ width: px, height: px }} className="rounded-md" />;
}

type Tab = 'console' | 'players' | 'world' | 'config' | 'files' | 'plugins' | 'backups' | 'map';
const MAP_URL = 'http://45.133.9.70:8123';

export default function MinecraftPage() {
  const [status, setStatus] = useState<any>({});
  const [tab, setTab] = useState<Tab>('console');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

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
  const [online, setOnline] = useState<{ online: string[]; count: number; max: number | null }>({ online: [], count: 0, max: null });
  const [gamerules, setGamerules] = useState<Record<string, string>>({});

  // Datei-Manager
  const [fmPath, setFmPath] = useState('');
  const [fmEntries, setFmEntries] = useState<any[]>([]);
  const [fmFile, setFmFile] = useState('');
  const [fmContent, setFmContent] = useState('');
  const [fmDirty, setFmDirty] = useState(false);
  const [fmRawMode, setFmRawMode] = useState(false);
  const fmIsYaml = fmFile.endsWith('.yml') || fmFile.endsWith('.yaml');

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2600); };
  const rcon = (cmd: string) => mcApi('/command', { method: 'POST', body: JSON.stringify({ command: cmd }) });
  const refreshStatus = useCallback(async () => { setStatus(await mcApi('/status')); }, []);
  const refreshLogs = useCallback(async () => { const r = await mcApi('/logs?tail=300'); if (typeof r.logs === 'string') setLogs(stripAnsi(r.logs)); }, []);

  useEffect(() => { refreshStatus(); const t = setInterval(refreshStatus, 5000); return () => clearInterval(t); }, [refreshStatus]);
  useEffect(() => { if (tab !== 'console') return; refreshLogs(); const t = setInterval(refreshLogs, 3000); return () => clearInterval(t); }, [tab, refreshLogs]);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);
  useEffect(() => {
    if (tab === 'config') mcApi('/configs').then(r => { const f: string[] = r.files || []; setConfigs(f); if (f.length && !activeConfig) loadConfig(f.includes('server.properties') ? 'server.properties' : f[0]); });
    else if (tab === 'plugins') loadPlugins();
    else if (tab === 'world') { mcApi('/world').then(setWorld); mcApi('/gamerules').then(setGamerules); }
    else if (tab === 'backups') loadBackups();
    else if (tab === 'files') loadFiles(fmPath);
    else if (tab === 'players') loadPlayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
  useEffect(() => { if (tab !== 'players') return; const t = setInterval(loadPlayers, 8000); return () => clearInterval(t); }, [tab]);

  const loadPlugins = () => mcApi('/plugins').then(r => setPlugins(r.plugins || []));
  const loadBackups = () => mcApi('/backups').then(r => setBackups(r.backups || []));
  const loadPlayers = () => mcApi('/players').then(r => setOnline({ online: r.online || [], count: r.count || 0, max: r.max ?? null }));
  const loadFiles = (p: string) => { setFmFile(''); mcApi(`/files?path=${encodeURIComponent(p)}`).then(r => { setFmEntries(r.entries || []); setFmPath(r.path ?? p); }); };
  const openFile = async (p: string) => { const r = await mcApi(`/file?path=${encodeURIComponent(p)}`); if (typeof r.content === 'string') { setFmFile(p); setFmContent(r.content); setFmDirty(false); setFmRawMode(false); } else flash(r.error || 'Datei nicht lesbar'); };
  const saveFile = async () => { setBusy(true); await mcApi(`/file?path=${encodeURIComponent(fmFile)}`, { method: 'PUT', body: JSON.stringify({ content: fmContent }) }); setBusy(false); setFmDirty(false); flash('Datei gespeichert — evtl. Neustart nötig'); };

  const loadConfig = async (file: string) => { setActiveConfig(file); setRawMode(false); const r = await mcApi(`/config/${file}`); const c = r.content ?? ''; setRawContent(c); if (file === 'server.properties') setProps(parseProps(c)); setDirty(false); };
  const setProp = (k: string, v: string) => { setProps(prev => { const n = new Map(prev); n.set(k, v); return n; }); setDirty(true); };
  const saveConfig = async () => { setBusy(true); const c = isProps && !rawMode ? applyProps(rawContent, props) : rawContent; await mcApi(`/config/${activeConfig}`, { method: 'PUT', body: JSON.stringify({ content: c }) }); setRawContent(c); if (isProps) setProps(parseProps(c)); setBusy(false); setDirty(false); setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1500); };

  const playerList: string[] = (() => { if (!playerCfg) return []; try { const a = JSON.parse(rawContent || '[]'); return Array.isArray(a) ? a.map((p: any) => p.name || p.uuid || String(p)) : []; } catch { return []; } })();
  const addPlayer = async () => { const n = newPlayer.trim(); if (!n || !playerCfg) return; setBusy(true); setNewPlayer(''); const r = await rcon(`${playerCfg.add} ${n}`); setBusy(false); if (r.response) flash(stripAnsi(r.response)); setTimeout(() => loadConfig(activeConfig), 900); };
  const removePlayer = async (n: string) => { if (!playerCfg) return; await rcon(`${playerCfg.remove} ${n}`); setTimeout(() => loadConfig(activeConfig), 900); };

  const power = async (a: string) => { setBusy(true); await mcApi('/power', { method: 'POST', body: JSON.stringify({ action: a }) }); setTimeout(refreshStatus, 1500); setBusy(false); };
  const sendCommand = async (e?: React.FormEvent) => { e?.preventDefault(); const c = command.trim(); if (!c) return; setCommand(''); setLogs(p => p + `\n> ${c}`); const r = await rcon(c); if (r.response) setLogs(p => p + `\n${stripAnsi(r.response)}`); else if (r.error) setLogs(p => p + `\n[Fehler] ${r.error}`); setTimeout(refreshLogs, 500); };

  // Welt-Quick-Actions
  const quick = async (cmd: string, msg: string) => { await rcon(cmd); flash(msg); };
  const setGamerule = async (g: string, val: boolean) => { setGamerules(p => ({ ...p, [g]: String(val) })); await rcon(`gamerule ${g} ${val}`); };

  // Spieler-Aktionen
  const playerCmd = async (name: string, cmd: string, msg: string) => { const r = await rcon(cmd); flash(msg + (r.response ? `: ${stripAnsi(r.response)}` : '')); setTimeout(loadPlayers, 800); };

  const togglePlugin = async (p: any) => { await mcApi('/plugins/toggle', { method: 'POST', body: JSON.stringify({ name: p.name, enabled: !p.enabled }) }); loadPlugins(); };
  const deletePlugin = async (p: any) => { if (!confirm(`Plugin "${p.name}" löschen?`)) return; await mcApi(`/plugins/${encodeURIComponent(p.name)}`, { method: 'DELETE' }); loadPlugins(); };
  const installPlugin = async () => { if (!pluginUrl.trim()) return; setBusy(true); const r = await mcApi('/plugins/install', { method: 'POST', body: JSON.stringify({ url: pluginUrl.trim() }) }); setBusy(false); if (r.ok) { setPluginUrl(''); flash(`${r.name} installiert${r.note || ''} — Neustart nötig`); loadPlugins(); } else flash(r.error || 'Fehler'); };
  const resetWorld = async () => { if (!confirm('Welt WIRKLICH zurücksetzen? Alles geht verloren! (Server startet neu)')) return; setBusy(true); await mcApi('/world/reset', { method: 'POST' }); setBusy(false); flash('Welt zurückgesetzt'); setTimeout(() => mcApi('/world').then(setWorld), 3000); };
  const createBackup = async () => { setBusy(true); const r = await mcApi('/backups', { method: 'POST' }); setBusy(false); if (r.ok) { flash(`Backup erstellt (${fmtSize(r.size)})`); loadBackups(); } else flash(r.error || 'Fehler'); };
  const restoreBackup = async (b: any) => { if (!confirm(`Backup "${b.name}" wiederherstellen? Aktuelle Welt wird überschrieben!`)) return; setBusy(true); await mcApi(`/backups/${encodeURIComponent(b.name)}/restore`, { method: 'POST' }); setBusy(false); flash('Backup wiederhergestellt'); };
  const deleteBackup = async (b: any) => { if (!confirm(`Backup "${b.name}" löschen?`)) return; await mcApi(`/backups/${encodeURIComponent(b.name)}`, { method: 'DELETE' }); loadBackups(); };

  const running = status.running;
  const statusColor = status.error ? '#6b7280' : running ? '#10b981' : '#ef4444';
  const statusText = status.error ? 'Agent nicht erreichbar' : running ? (status.health === 'healthy' ? 'Läuft' : 'Startet…') : 'Gestoppt';
  const TABS: [Tab, string, any][] = [
    ['console', 'Konsole', TerminalSquare], ['players', 'Spieler', Users], ['world', 'Welt', Globe],
    ['config', 'Konfiguration', SlidersHorizontal], ['files', 'Dateien', Folder], ['plugins', 'Plugins', Puzzle],
    ['backups', 'Backups', Archive], ['map', 'Karte', MapIcon],
  ];
  const crumbs = fmPath ? fmPath.split('/').filter(Boolean) : [];

  const TimeBtn = ({ icon: Icon, label, cmd }: any) => <button onClick={() => quick(cmd, `Zeit: ${label}`)} className="flex flex-col items-center gap-1.5 rounded-xl bg-white/[0.02] border border-white/[0.06] px-3 py-3 hover:bg-white/[0.05] hover:border-amber-400/30 transition"><Icon className="w-5 h-5 text-amber-400/80" /><span className="text-[12px] text-white/60">{label}</span></button>;
  const WeatherBtn = ({ icon: Icon, label, cmd, color }: any) => <button onClick={() => quick(cmd, `Wetter: ${label}`)} className="flex flex-col items-center gap-1.5 rounded-xl bg-white/[0.02] border border-white/[0.06] px-3 py-3 hover:bg-white/[0.05] transition" style={{ borderColor: undefined }}><Icon className="w-5 h-5" style={{ color }} /><span className="text-[12px] text-white/60">{label}</span></button>;

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold">Minecraft <span className="text-gradient">Server</span></motion.h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-white/40 flex-wrap">
              <Circle className="w-2.5 h-2.5" style={{ fill: statusColor, color: statusColor }} /><span style={{ color: statusColor }}>{statusText}</span>
              <span className="text-white/20">·</span><span>45.133.9.70:25565</span><span className="text-white/20">·</span><span>Paper 26.2</span>
              {online.max !== null && <><span className="text-white/20">·</span><span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{online.count}/{online.max}</span></>}
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
              <input value={command} onChange={e => setCommand(e.target.value)} placeholder="Befehl (z. B. give Spieler diamond 64, xp add …)…" className="flex-1 bg-transparent outline-none text-sm text-white/80 placeholder:text-white/25 font-mono" />
              <button type="submit" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm bg-orange-500/15 border border-orange-500/25 text-orange-300 hover:bg-orange-500/25 transition"><Send className="w-3.5 h-3.5" /> Senden</button>
            </form>
          </div>
        )}

        {/* Spieler */}
        {tab === 'players' && (
          <div className="space-y-3">
            <p className="text-sm text-white/40">{online.count} Spieler online{online.max !== null ? ` (max ${online.max})` : ''}</p>
            <div className="glass-card rounded-2xl divide-y divide-white/[0.04]">
              {online.online.length === 0 && <p className="text-sm text-white/30 p-6 text-center">Aktuell niemand online.</p>}
              {online.online.map(name => (
                <div key={name} className="flex items-center gap-3 px-4 py-3 flex-wrap">
                  <Avatar name={name} size={36} />
                  <span className="text-sm text-white/85 font-medium flex-1 min-w-[100px]">{name}</span>
                  <select onChange={e => { if (e.target.value) { playerCmd(name, `gamemode ${e.target.value} ${name}`, `${name} → ${e.target.value}`); e.target.value = ''; } }} defaultValue="" className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[12px] text-white/70 outline-none focus:border-orange-400/40">
                    <option value="" className="bg-neutral-900">Spielmodus…</option>
                    {['survival', 'creative', 'adventure', 'spectator'].map(m => <option key={m} value={m} className="bg-neutral-900 capitalize">{m}</option>)}
                  </select>
                  <button onClick={() => playerCmd(name, `op ${name}`, `${name} ist jetzt OP`)} title="OP geben" className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] text-amber-300/80 hover:bg-amber-500/10 transition"><Shield className="w-3.5 h-3.5" /> OP</button>
                  <button onClick={() => playerCmd(name, `heal ${name}`, `${name} geheilt`)} title="Heilen" className="p-2 rounded-lg text-white/40 hover:text-emerald-400 hover:bg-emerald-500/10 transition"><Heart className="w-4 h-4" /></button>
                  <button onClick={() => playerCmd(name, `feed ${name}`, `${name} gesättigt`)} title="Sättigen" className="p-2 rounded-lg text-white/40 hover:text-orange-300 hover:bg-orange-500/10 transition"><Drumstick className="w-4 h-4" /></button>
                  <button onClick={() => { if (confirm(`${name} kicken?`)) playerCmd(name, `kick ${name}`, `${name} gekickt`); }} title="Kicken" className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition"><LogOut className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-white/25">Spieler-Verwaltung wirkt sofort über RCON. Whitelist/Bans im Tab „Konfiguration".</p>
          </div>
        )}

        {/* Welt */}
        {tab === 'world' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4"><Sun className="w-4 h-4 text-amber-400/80" /><h3 className="text-sm font-medium text-white/70">Tageszeit</h3></div>
                <div className="grid grid-cols-4 gap-2">
                  <TimeBtn icon={Sunrise} label="Morgen" cmd="minecraft:time set 0" /><TimeBtn icon={Sun} label="Mittag" cmd="minecraft:time set noon" />
                  <TimeBtn icon={Sunset} label="Abend" cmd="minecraft:time set 12000" /><TimeBtn icon={Moon} label="Nacht" cmd="minecraft:time set midnight" />
                </div>
              </div>
              <div className="glass-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4"><Cloud className="w-4 h-4 text-cyan-400/80" /><h3 className="text-sm font-medium text-white/70">Wetter</h3></div>
                <div className="grid grid-cols-3 gap-2">
                  <WeatherBtn icon={Sun} label="Klar" cmd="minecraft:weather clear" color="#fbbf24" /><WeatherBtn icon={CloudRain} label="Regen" cmd="minecraft:weather rain" color="#60a5fa" /><WeatherBtn icon={CloudLightning} label="Gewitter" cmd="minecraft:weather thunder" color="#a78bfa" />
                </div>
              </div>
            </div>
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4"><Gamepad2 className="w-4 h-4 text-orange-400/80" /><h3 className="text-sm font-medium text-white/70">Spielregeln (Gamerules)</h3></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {Object.keys(GAMERULE_LABELS).map(g => (
                  <div key={g} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.02] border border-white/[0.05] px-3.5 py-2.5">
                    <span className="text-[13px] text-white/70">{GAMERULE_LABELS[g]}</span>
                    <Toggle checked={gamerules[g] === 'true'} onChange={v => setGamerule(g, v)} />
                  </div>
                ))}
              </div>
            </div>
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
                <p className="text-[13px] text-white/40 mb-4">Löscht die Welt komplett. <span className="text-red-400/70">Nicht umkehrbar!</span> Vorher Backup.</p>
                <button disabled={busy} onClick={resetWorld} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm bg-red-500/10 border border-red-500/25 text-red-300 hover:bg-red-500/20 disabled:opacity-30 transition"><RotateCcw className="w-4 h-4" /> Zurücksetzen</button>
              </div>
            </div>
          </div>
        )}

        {/* Konfiguration */}
        {tab === 'config' && (
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
            <div className="glass-card rounded-2xl p-3 space-y-1 h-fit">
              <p className="text-[10px] uppercase tracking-widest text-white/25 px-3 pt-1 pb-2">Dateien</p>
              {configs.map(f => { const pf = PLAYER_FILES[f]; const Icon = pf ? pf.icon : FileText; return (
                <button key={f} onClick={() => loadConfig(f)} className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-[13px] font-mono truncate transition ${activeConfig === f ? 'bg-white/[0.06] text-white' : 'text-white/50 hover:bg-white/[0.03]'}`}><Icon className="w-3.5 h-3.5 opacity-40" /> {f}</button>
              ); })}
              {!configs.length && <p className="text-xs text-white/25 px-3 py-2">Lade…</p>}
            </div>
            <div className="glass-card rounded-2xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-white/60">{activeConfig || '—'}</span>
                  {isYaml && <span className="text-[10px] uppercase tracking-wider text-cyan-300/60 bg-cyan-500/10 border border-cyan-500/15 rounded px-1.5 py-0.5">YAML</span>}
                  {(isProps || isYaml) && <button onClick={() => setRawMode(m => !m)} className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/60 transition"><Code2 className="w-3 h-3" /> {rawMode ? 'Formular' : 'Rohtext'}</button>}
                </div>
                {!playerCfg && <button disabled={busy || !dirty} onClick={saveConfig} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-30 transition"><Save className="w-3.5 h-3.5" /> {savedFlash ? 'Gespeichert!' : 'Speichern'}</button>}
              </div>
              {isProps && !rawMode ? (
                <div className="max-h-[52vh] overflow-y-auto p-5 space-y-6">
                  {SCHEMA.map(sec => { const Icon = sec.icon; return (
                    <div key={sec.section}>
                      <div className="flex items-center gap-2 mb-3"><Icon className="w-4 h-4 text-orange-400/70" /><h3 className="text-xs uppercase tracking-widest text-white/40 font-medium">{sec.section}</h3></div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {sec.fields.map(field => { const val = props.get(field.key) ?? ''; return (
                          <div key={field.key} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.02] border border-white/[0.05] px-3.5 py-2.5">
                            <div className="min-w-0"><p className="text-[13px] text-white/70 truncate">{field.label}</p>{field.hint && <p className="text-[10px] text-white/25">{field.hint}</p>}</div>
                            {field.type === 'bool' ? <Toggle checked={val === 'true'} onChange={v => setProp(field.key, v ? 'true' : 'false')} />
                              : field.type === 'select' ? <select value={val} onChange={e => setProp(field.key, e.target.value)} className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-1 text-[13px] text-white/80 outline-none focus:border-orange-400/40 capitalize">{field.options!.map(o => <option key={o} value={o} className="bg-neutral-900">{o}</option>)}</select>
                              : <input type={field.type === 'number' ? 'number' : 'text'} value={val} onChange={e => setProp(field.key, e.target.value)} className="w-32 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-1 text-[13px] text-white/80 outline-none focus:border-orange-400/40 text-right" />}
                          </div>
                        ); })}
                      </div>
                    </div>
                  ); })}
                </div>
              ) : playerCfg ? (
                <div className="p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <input value={newPlayer} onChange={e => setNewPlayer(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPlayer()} placeholder="Spielername…" className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/25 outline-none focus:border-orange-400/40" />
                    <button disabled={busy || !newPlayer.trim()} onClick={addPlayer} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-30 transition"><UserPlus className="w-4 h-4" /> Hinzufügen</button>
                  </div>
                  <div className="space-y-2">
                    {playerList.length === 0 && <p className="text-sm text-white/30 py-6 text-center">Keine Einträge in {playerCfg.label}.</p>}
                    {playerList.map(name => (
                      <div key={name} className="flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/[0.05] px-3 py-2">
                        <Avatar name={name} /><span className="flex-1 text-sm text-white/80 font-medium truncate">{name}</span>
                        <button onClick={() => removePlayer(name)} className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : isYaml && !rawMode ? (
                <YamlFormEditor key={activeConfig} content={rawContent} onChange={v => { setRawContent(v); setDirty(true); }} />
              ) : (
                <><CodeEditor value={rawContent} onChange={v => { setRawContent(v); setDirty(true); }} /><p className="text-[11px] text-white/25 px-4 py-2 border-t border-white/[0.06]">Änderungen wirken je nach Datei erst nach einem Neustart.</p></>
              )}
            </div>
          </div>
        )}

        {/* Dateien (Manager) */}
        {tab === 'files' && (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-4 py-2.5 text-[13px] overflow-x-auto">
              <button onClick={() => { setFmFile(''); loadFiles(''); }} className="flex items-center gap-1 text-white/50 hover:text-white transition"><Home className="w-3.5 h-3.5" /> data</button>
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <ChevronRight className="w-3 h-3 text-white/20" />
                  <button onClick={() => { setFmFile(''); loadFiles(crumbs.slice(0, i + 1).join('/')); }} className="text-white/50 hover:text-white transition font-mono">{c}</button>
                </span>
              ))}
              {fmFile && <><ChevronRight className="w-3 h-3 text-white/20" /><span className="text-orange-300/80 font-mono">{fmFile.split('/').pop()}</span></>}
              {fmFile && (
                <div className="ml-auto flex items-center gap-3">
                  {fmIsYaml && <button onClick={() => setFmRawMode(m => !m)} className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/60 transition"><Code2 className="w-3 h-3" /> {fmRawMode ? 'Formular' : 'Rohtext'}</button>}
                  <button disabled={busy || !fmDirty} onClick={saveFile} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-30 transition"><Save className="w-3.5 h-3.5" /> Speichern</button>
                </div>
              )}
            </div>
            {fmFile ? (
              fmIsYaml && !fmRawMode ? (
                <YamlFormEditor key={fmFile} content={fmContent} onChange={v => { setFmContent(v); setFmDirty(true); }} />
              ) : (
                <CodeEditor value={fmContent} onChange={v => { setFmContent(v); setFmDirty(true); }} />
              )
            ) : (
              <div className="max-h-[52vh] overflow-y-auto divide-y divide-white/[0.03]">
                {fmEntries.length === 0 && <p className="text-sm text-white/30 p-6 text-center">Leerer Ordner.</p>}
                {fmEntries.map(e => (
                  <button key={e.name} onClick={() => e.type === 'dir' ? loadFiles(fmPath ? `${fmPath}/${e.name}` : e.name) : e.editable ? openFile(fmPath ? `${fmPath}/${e.name}` : e.name) : null}
                    disabled={e.type === 'file' && !e.editable}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${e.type === 'dir' || e.editable ? 'hover:bg-white/[0.02]' : 'opacity-40 cursor-default'}`}>
                    {e.type === 'dir' ? <Folder className="w-4 h-4 text-amber-400/70 flex-shrink-0" /> : e.editable ? <FileCode className="w-4 h-4 text-cyan-400/60 flex-shrink-0" /> : <FileText className="w-4 h-4 text-white/25 flex-shrink-0" />}
                    <span className={`flex-1 text-[13px] font-mono truncate ${e.type === 'dir' ? 'text-white/80' : 'text-white/60'}`}>{e.name}</span>
                    {e.type === 'file' && <span className="text-[11px] text-white/25 tabular-nums">{fmtSize(e.size)}</span>}
                    {e.type === 'dir' && <ChevronRight className="w-4 h-4 text-white/20" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Plugins */}
        {tab === 'plugins' && (
          <div className="space-y-4">
            <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
              <Puzzle className="w-4 h-4 text-orange-400/70 flex-shrink-0" />
              <input value={pluginUrl} onChange={e => setPluginUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && installPlugin()} placeholder="Plugin-Name (z. B. luckperms) oder Modrinth-Link…" className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/25 outline-none focus:border-orange-400/40" />
              <button disabled={busy || !pluginUrl.trim()} onClick={installPlugin} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm bg-orange-500/15 border border-orange-500/25 text-orange-300 hover:bg-orange-500/25 disabled:opacity-30 transition"><Plus className="w-4 h-4" /> Installieren</button>
            </div>
            <div className="glass-card rounded-2xl divide-y divide-white/[0.04]">
              {plugins.length === 0 && <p className="text-sm text-white/30 p-5 text-center">Keine Plugins installiert.</p>}
              {plugins.map(p => (
                <div key={p.name} className="flex items-center gap-3 px-4 py-3">
                  <Puzzle className={`w-4 h-4 flex-shrink-0 ${p.enabled ? 'text-emerald-400/70' : 'text-white/20'}`} />
                  <div className="flex-1 min-w-0"><p className={`text-sm font-mono truncate ${p.enabled ? 'text-white/80' : 'text-white/40'}`}>{p.name}</p><p className="text-[11px] text-white/25">{fmtSize(p.size)} · {p.enabled ? 'aktiv' : 'deaktiviert'}</p></div>
                  <Toggle checked={p.enabled} onChange={() => togglePlugin(p)} />
                  <button onClick={() => deletePlugin(p)} className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-white/25">Gib den Modrinth-Namen (z. B. <span className="font-mono text-white/40">coreprotect</span>) oder einen direkten <span className="font-mono text-white/40">.jar</span>-Link an — passende Version für MC 26.2 wird automatisch geholt. Nach Installieren Neustart nötig. Plugin-Einstellungen im Tab „Dateien".</p>
          </div>
        )}

        {/* Backups */}
        {tab === 'backups' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/40">{backups.length} Backup{backups.length !== 1 ? 's' : ''} · auf dem VPS</p>
              <button disabled={busy} onClick={createBackup} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-30 transition"><Plus className="w-4 h-4" /> {busy ? 'Erstelle…' : 'Backup erstellen'}</button>
            </div>
            <div className="glass-card rounded-2xl divide-y divide-white/[0.04]">
              {backups.length === 0 && <p className="text-sm text-white/30 p-5 text-center">Noch keine Backups.</p>}
              {backups.map(b => (
                <div key={b.name} className="flex items-center gap-3 px-4 py-3">
                  <Archive className="w-4 h-4 text-white/30 flex-shrink-0" />
                  <div className="flex-1 min-w-0"><p className="text-sm font-mono text-white/75 truncate">{b.name}</p><p className="text-[11px] text-white/25">{fmtDate(b.created)} · {fmtSize(b.size)}</p></div>
                  <button onClick={() => restoreBackup(b)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] text-amber-300/80 hover:bg-amber-500/10 transition"><RotateCcw className="w-3.5 h-3.5" /> Wiederherstellen</button>
                  <button onClick={() => deleteBackup(b)} className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Karte */}
        {tab === 'map' && (
          <div className="glass-card rounded-2xl p-8 md:p-12 text-center flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center"><Layers className="w-8 h-8 text-cyan-400" /></div>
            <div><h3 className="text-lg font-semibold">Live-Karte · BlueMap</h3><p className="text-sm text-white/40 mt-1.5 max-w-md mx-auto">Interaktive 3D-/2D-Webkarte deiner Welt — Overworld, Nether und End.</p></div>
            <a href={MAP_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-medium bg-cyan-500/15 border border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/25 transition"><ExternalLink className="w-4 h-4" /> Karte öffnen</a>
            <p className="text-[11px] text-white/25 max-w-md">Öffnet <span className="font-mono text-white/40">{MAP_URL}</span> in einem neuen Tab.</p>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
