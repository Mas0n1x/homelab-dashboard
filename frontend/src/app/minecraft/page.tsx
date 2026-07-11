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
  Gamepad2, LogOut, Activity, Cpu, MemoryStick, Zap, MessageSquare, Package, Sparkles,
  MapPin, ChevronDown, Clock, CalendarClock, Repeat,
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

type Tab = 'console' | 'performance' | 'players' | 'world' | 'config' | 'files' | 'plugins' | 'backups' | 'automation' | 'map';
const MAP_URL = 'http://45.133.9.70:8123';

function StatCard({ icon: Icon, label, value, sub, percent, color }: { icon: any; label: string; value: string; sub?: string; percent?: number; color: string }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3"><Icon className="w-4 h-4" style={{ color }} /><span className="text-xs font-medium text-white/50">{label}</span></div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</span>
        {sub && <span className="text-[11px] text-white/30 mb-1">{sub}</span>}
      </div>
      {percent !== undefined && (
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden mt-3">
          <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${color}80, ${color})`, boxShadow: `0 0 8px ${color}40` }} initial={{ width: 0 }} animate={{ width: `${Math.min(percent, 100)}%` }} transition={{ duration: 0.8 }} />
        </div>
      )}
    </div>
  );
}

export default function MinecraftPage() {
  const [status, setStatus] = useState<any>({});
  const [tab, setTab] = useState<Tab>('console');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const [logs, setLogs] = useState('');
  const [command, setCommand] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const consoleWsRef = useRef<WebSocket | null>(null);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const histRef = useRef(-1);

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
  const [pluginSub, setPluginSub] = useState<'installed' | 'browse'>('installed');
  const [pluginUpdates, setPluginUpdates] = useState<any[]>([]);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [browseQuery, setBrowseQuery] = useState('');
  const [browseResults, setBrowseResults] = useState<any[]>([]);
  const [browsing, setBrowsing] = useState(false);
  const [pluginBusy, setPluginBusy] = useState('');
  const [world, setWorld] = useState<any>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [online, setOnline] = useState<{ online: string[]; count: number; max: number | null }>({ online: [], count: 0, max: null });
  const [gamerules, setGamerules] = useState<Record<string, string>>({});
  const [perf, setPerf] = useState<any>({});
  const [known, setKnown] = useState<any[]>([]);
  const [playersSub, setPlayersSub] = useState<'online' | 'known'>('online');
  const [expanded, setExpanded] = useState('');
  const [msg, setMsg] = useState('');
  const [item, setItem] = useState('');

  // Automatisierung
  const [autoBackup, setAutoBackup] = useState<{ enabled: boolean; intervalHours: number; retention: number }>({ enabled: false, intervalHours: 24, retention: 7 });
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(null);
  const [schedCmds, setSchedCmds] = useState<any[]>([]);
  const [newCmd, setNewCmd] = useState('');
  const [cmdType, setCmdType] = useState<'daily' | 'interval'>('daily');
  const [cmdTime, setCmdTime] = useState('04:00');
  const [cmdMinutes, setCmdMinutes] = useState(60);

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
  const appendLog = (s: string) => setLogs(p => { const n = p + s; return n.length > 80000 ? n.slice(n.length - 80000) : n; });

  useEffect(() => { refreshStatus(); const t = setInterval(refreshStatus, 5000); return () => clearInterval(t); }, [refreshStatus]);
  useEffect(() => {
    if (tab !== 'console') return;
    let closedByUs = false; let pollTimer: any = null; let ws: WebSocket | null = null;
    const startPolling = () => { if (pollTimer) return; refreshLogs(); pollTimer = setInterval(refreshLogs, 3000); };
    try {
      const { accessToken } = useAuthStore.getState();
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.port ? `${window.location.hostname}:${window.location.port}` : window.location.hostname;
      setLogs('');
      ws = new WebSocket(`${proto}//${host}/api/minecraft/console?token=${encodeURIComponent(accessToken || '')}`);
      consoleWsRef.current = ws;
      ws.onopen = () => setWsConnected(true);
      ws.onmessage = (ev) => {
        try {
          const m = JSON.parse(ev.data);
          if (m.type === 'log') appendLog(stripAnsi(m.data || ''));
          else if (m.type === 'response') appendLog((m.data ? stripAnsi(m.data) : '(ok)') + '\n');
          else if (m.type === 'error') appendLog(`[Fehler] ${m.data}\n`);
        } catch { /* */ }
      };
      ws.onclose = () => { setWsConnected(false); consoleWsRef.current = null; if (!closedByUs) startPolling(); };
      ws.onerror = () => { /* onclose folgt */ };
    } catch { startPolling(); }
    return () => { closedByUs = true; if (pollTimer) clearInterval(pollTimer); if (ws) { try { ws.close(); } catch { /* */ } } consoleWsRef.current = null; setWsConnected(false); };
  }, [tab, refreshLogs]);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);
  useEffect(() => {
    if (tab === 'config') mcApi('/configs').then(r => { const f: string[] = r.files || []; setConfigs(f); if (f.length && !activeConfig) loadConfig(f.includes('server.properties') ? 'server.properties' : f[0]); });
    else if (tab === 'plugins') loadPlugins();
    else if (tab === 'world') { mcApi('/world').then(setWorld); mcApi('/gamerules').then(setGamerules); }
    else if (tab === 'backups') loadBackups();
    else if (tab === 'files') loadFiles(fmPath);
    else if (tab === 'players') { loadPlayers(); loadKnown(); }
    else if (tab === 'performance') mcApi('/performance').then(setPerf);
    else if (tab === 'automation') loadAutomation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
  useEffect(() => { if (tab !== 'players') return; const t = setInterval(loadPlayers, 8000); return () => clearInterval(t); }, [tab]);
  useEffect(() => { if (tab !== 'performance') return; const t = setInterval(() => mcApi('/performance').then(setPerf), 4000); return () => clearInterval(t); }, [tab]);
  useEffect(() => { if (tab === 'plugins' && pluginSub === 'browse' && browseResults.length === 0) browsePlugins(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab, pluginSub]);

  const loadPlugins = () => mcApi('/plugins').then(r => setPlugins(r.plugins || []));
  const loadBackups = () => mcApi('/backups').then(r => setBackups(r.backups || []));
  const loadPlayers = () => mcApi('/players').then(r => setOnline({ online: r.online || [], count: r.count || 0, max: r.max ?? null }));
  const loadKnown = () => mcApi('/players/known').then(r => setKnown(r.players || []));
  const loadAutomation = () => mcApi('/automation').then(r => { if (r.autoBackup) setAutoBackup(r.autoBackup); setSchedCmds(r.commands || []); setLastBackupAt(r.lastBackupAt ?? null); });
  const saveAutoBackup = async (patch: Partial<{ enabled: boolean; intervalHours: number; retention: number }>) => { const next = { ...autoBackup, ...patch }; setAutoBackup(next); const r = await mcApi('/automation/backup', { method: 'PUT', body: JSON.stringify(next) }); if (r.lastBackupAt !== undefined) setLastBackupAt(r.lastBackupAt); };
  const addSchedCmd = async () => { const c = newCmd.trim(); if (!c) return; setBusy(true); const body = cmdType === 'daily' ? { command: c, type: 'daily', time: cmdTime } : { command: c, type: 'interval', minutes: cmdMinutes }; const r = await mcApi('/automation/commands', { method: 'POST', body: JSON.stringify(body) }); setBusy(false); if (r.ok) { setNewCmd(''); flash('Geplanter Befehl angelegt'); loadAutomation(); } else flash(r.error || 'Fehler'); };
  const toggleSchedCmd = async (c: any) => { await mcApi(`/automation/commands/${c.id}`, { method: 'PUT', body: JSON.stringify({ enabled: !c.enabled }) }); loadAutomation(); };
  const deleteSchedCmd = async (c: any) => { await mcApi(`/automation/commands/${c.id}`, { method: 'DELETE' }); loadAutomation(); };
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
  const sendCommand = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const c = command.trim(); if (!c) return;
    setCommand(''); setCmdHistory(h => [...h.filter(x => x !== c), c].slice(-50)); histRef.current = -1;
    appendLog(`\n> ${c}\n`);
    const ws = consoleWsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) { ws.send(JSON.stringify({ type: 'command', command: c })); }
    else { const r = await rcon(c); if (r.response) appendLog(stripAnsi(r.response) + '\n'); else if (r.error) appendLog(`[Fehler] ${r.error}\n`); setTimeout(refreshLogs, 500); }
  };
  const onCmdKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); if (!cmdHistory.length) return; histRef.current = histRef.current < 0 ? cmdHistory.length - 1 : Math.max(0, histRef.current - 1); setCommand(cmdHistory[histRef.current] || ''); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (histRef.current < 0) return; histRef.current += 1; if (histRef.current >= cmdHistory.length) { histRef.current = -1; setCommand(''); } else setCommand(cmdHistory[histRef.current]); }
  };
  const lineColor = (l: string) => /ERROR|SEVERE|Exception|\bFAILED\b|\bFAIL\b/i.test(l) ? 'text-red-400/90' : /WARN/i.test(l) ? 'text-amber-300/85' : /^>/.test(l) ? 'text-orange-300/90' : /\bINFO\b/.test(l) ? 'text-white/55' : 'text-white/45';

  // Welt-Quick-Actions
  const quick = async (cmd: string, msg: string) => { await rcon(cmd); flash(msg); };
  const setGamerule = async (g: string, val: boolean) => { setGamerules(p => ({ ...p, [g]: String(val) })); await rcon(`gamerule ${g} ${val}`); };


  const togglePlugin = async (p: any) => { await mcApi('/plugins/toggle', { method: 'POST', body: JSON.stringify({ name: p.name, enabled: !p.enabled }) }); loadPlugins(); };
  const deletePlugin = async (p: any) => { if (!confirm(`Plugin "${p.name}" löschen?`)) return; await mcApi(`/plugins/${encodeURIComponent(p.name)}`, { method: 'DELETE' }); loadPlugins(); };
  const installPlugin = async () => { if (!pluginUrl.trim()) return; setBusy(true); const r = await mcApi('/plugins/install', { method: 'POST', body: JSON.stringify({ url: pluginUrl.trim() }) }); setBusy(false); if (r.ok) { setPluginUrl(''); flash(`${r.name} installiert${r.note || ''} — Neustart nötig`); loadPlugins(); } else flash(r.error || 'Fehler'); };
  const checkUpdates = async () => { setCheckingUpdates(true); const r = await mcApi('/plugins/updates'); setCheckingUpdates(false); setPluginUpdates(r.updates || []); flash(r.updates?.length ? `${r.updates.length} Update${r.updates.length !== 1 ? 's' : ''} verfügbar` : 'Alles aktuell'); };
  const installBySlug = async (slug: string, label?: string) => { setPluginBusy(slug); const r = await mcApi('/plugins/install', { method: 'POST', body: JSON.stringify({ url: slug }) }); setPluginBusy(''); if (r.ok) { flash(`${label || r.name} installiert${r.note || ''} — Neustart nötig`); loadPlugins(); setPluginUpdates(u => u.filter(x => x.slug !== slug)); } else flash(r.error || 'Fehler'); };
  const browsePlugins = async () => { setBrowsing(true); const r = await mcApi(`/plugins/browse?q=${encodeURIComponent(browseQuery.trim())}`); setBrowsing(false); setBrowseResults(r.results || []); };
  const resetWorld = async () => { if (!confirm('Welt WIRKLICH zurücksetzen? Alles geht verloren! (Server startet neu)')) return; setBusy(true); await mcApi('/world/reset', { method: 'POST' }); setBusy(false); flash('Welt zurückgesetzt'); setTimeout(() => mcApi('/world').then(setWorld), 3000); };
  const createBackup = async () => { setBusy(true); const r = await mcApi('/backups', { method: 'POST' }); setBusy(false); if (r.ok) { flash(`Backup erstellt (${fmtSize(r.size)})`); loadBackups(); } else flash(r.error || 'Fehler'); };
  const restoreBackup = async (b: any) => { if (!confirm(`Backup "${b.name}" wiederherstellen? Aktuelle Welt wird überschrieben!`)) return; setBusy(true); await mcApi(`/backups/${encodeURIComponent(b.name)}/restore`, { method: 'POST' }); setBusy(false); flash('Backup wiederhergestellt'); };
  const deleteBackup = async (b: any) => { if (!confirm(`Backup "${b.name}" löschen?`)) return; await mcApi(`/backups/${encodeURIComponent(b.name)}`, { method: 'DELETE' }); loadBackups(); };

  const running = status.running;
  const statusColor = status.error ? '#6b7280' : running ? '#10b981' : '#ef4444';
  const statusText = status.error ? 'Agent nicht erreichbar' : running ? (status.health === 'healthy' ? 'Läuft' : 'Startet…') : 'Gestoppt';
  const TABS: [Tab, string, any][] = [
    ['console', 'Konsole', TerminalSquare], ['performance', 'Leistung', Activity], ['players', 'Spieler', Users], ['world', 'Welt', Globe],
    ['config', 'Konfiguration', SlidersHorizontal], ['files', 'Dateien', Folder], ['plugins', 'Plugins', Puzzle],
    ['backups', 'Backups', Archive], ['automation', 'Automatik', CalendarClock], ['map', 'Karte', MapIcon],
  ];
  const pcmd = (name: string, cmd: string, m: string) => { rcon(cmd).then(r => flash(m + (r?.response ? `: ${stripAnsi(r.response)}` : ''))); setTimeout(loadPlayers, 700); };
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
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <TerminalSquare className="w-4 h-4 text-white/40" />
                <span className="text-[12px] text-white/50">Live-Konsole</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`flex items-center gap-1.5 text-[11px] ${wsConnected ? 'text-emerald-300/80' : 'text-amber-300/70'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  {wsConnected ? 'Live' : 'Polling'}
                </span>
                <button onClick={() => setLogs('')} className="text-[11px] text-white/35 hover:text-white/70 transition">leeren</button>
              </div>
            </div>
            <div ref={logRef} className="h-[50vh] overflow-y-auto p-4 font-mono text-[12px] leading-relaxed bg-black/30">
              {logs ? logs.split('\n').map((line, i) => <div key={i} className={`whitespace-pre-wrap break-words ${lineColor(line)}`}>{line || ' '}</div>) : <span className="text-white/40">Verbinde…</span>}
            </div>
            <form onSubmit={sendCommand} className="flex items-center gap-2 border-t border-white/[0.06] p-3 bg-white/[0.02]">
              <span className="text-orange-400/70 font-mono text-sm pl-1">/</span>
              <input value={command} onChange={e => setCommand(e.target.value)} onKeyDown={onCmdKey} placeholder="Befehl (↑/↓ für Verlauf, z. B. give Spieler diamond 64)…" className="flex-1 bg-transparent outline-none text-sm text-white/80 placeholder:text-white/25 font-mono" />
              <button type="submit" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm bg-orange-500/15 border border-orange-500/25 text-orange-300 hover:bg-orange-500/25 transition"><Send className="w-3.5 h-3.5" /> Senden</button>
            </form>
          </div>
        )}

        {/* Leistung */}
        {tab === 'performance' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Zap} label="TPS (Ticks/Sek.)" value={perf.tps != null ? Number(perf.tps).toFixed(1) : '—'} sub={perf.tps >= 19.5 ? 'flüssig' : perf.tps >= 15 ? 'leichte Last' : perf.tps != null ? 'überlastet' : ''} percent={perf.tps != null ? (perf.tps / 20) * 100 : 0} color={perf.tps >= 19 ? '#10b981' : perf.tps >= 15 ? '#f59e0b' : '#ef4444'} />
              <StatCard icon={Clock} label="MSPT (ms/Tick)" value={perf.mspt != null ? Number(perf.mspt).toFixed(1) : '—'} sub="Ziel < 50" percent={perf.mspt != null ? (perf.mspt / 50) * 100 : 0} color={(perf.mspt ?? 0) < 40 ? '#10b981' : (perf.mspt ?? 0) < 50 ? '#f59e0b' : '#ef4444'} />
              <StatCard icon={MemoryStick} label="Arbeitsspeicher" value={perf.memUsage ? fmtSize(perf.memUsage) : '—'} sub={perf.memLimit ? `von ${fmtSize(perf.memLimit)}` : ''} percent={perf.memLimit ? (perf.memUsage / perf.memLimit) * 100 : 0} color="#8b5cf6" />
              <StatCard icon={Cpu} label="CPU-Auslastung" value={perf.cpuPercent != null ? `${perf.cpuPercent}%` : '—'} sub="des Servers" percent={perf.cpuPercent ?? 0} color="#06b6d4" />
            </div>
            <div className="glass-card rounded-2xl p-5 flex flex-wrap items-center gap-6 text-sm">
              <div className="flex items-center gap-2"><Users className="w-4 h-4 text-white/40" /><span className="text-white/60">{online.count}{online.max !== null ? ` / ${online.max}` : ''} Spieler</span></div>
              <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-white/40" /><span className="text-white/60">{status.health === 'healthy' ? 'Gesund' : status.running ? 'Startet' : 'Gestoppt'}</span></div>
              {status.startedAt && <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-white/40" /><span className="text-white/60">seit {fmtDate(status.startedAt)}</span></div>}
            </div>
            <p className="text-[11px] text-white/25">Aktualisiert alle 4 Sekunden · TPS 20 = perfekter Server-Takt, MSPT = Rechenzeit pro Tick (unter 50 ms ist gut).</p>
          </div>
        )}

        {/* Spieler */}
        {tab === 'players' && (
          <div className="space-y-3">
            <div className="flex items-center gap-1 bg-white/[0.03] rounded-xl p-1 w-fit">
              <button onClick={() => setPlayersSub('online')} className={`px-3 py-1.5 rounded-lg text-[13px] transition ${playersSub === 'online' ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/70'}`}>Online ({online.count})</button>
              <button onClick={() => setPlayersSub('known')} className={`px-3 py-1.5 rounded-lg text-[13px] transition ${playersSub === 'known' ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/70'}`}>Bekannt ({known.length})</button>
            </div>

            {playersSub === 'online' && (
              <div className="glass-card rounded-2xl divide-y divide-white/[0.04]">
                {online.online.length === 0 && <p className="text-sm text-white/30 p-6 text-center">Aktuell niemand online.</p>}
                {online.online.map(name => (
                  <div key={name}>
                    <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
                      <Avatar name={name} size={36} />
                      <span className="text-sm text-white/85 font-medium flex-1 min-w-[100px]">{name}</span>
                      <select onChange={e => { if (e.target.value) { pcmd(name, `gamemode ${e.target.value} ${name}`, `${name} → ${e.target.value}`); e.target.value = ''; } }} defaultValue="" className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[12px] text-white/70 outline-none focus:border-orange-400/40">
                        <option value="" className="bg-neutral-900">Spielmodus…</option>
                        {['survival', 'creative', 'adventure', 'spectator'].map(m => <option key={m} value={m} className="bg-neutral-900 capitalize">{m}</option>)}
                      </select>
                      <button onClick={() => pcmd(name, `op ${name}`, `${name} ist jetzt OP`)} title="OP geben" className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] text-amber-300/80 hover:bg-amber-500/10 transition"><Shield className="w-3.5 h-3.5" /> OP</button>
                      <button onClick={() => pcmd(name, `heal ${name}`, `${name} geheilt`)} title="Heilen" className="p-2 rounded-lg text-white/40 hover:text-emerald-400 hover:bg-emerald-500/10 transition"><Heart className="w-4 h-4" /></button>
                      <button onClick={() => pcmd(name, `feed ${name}`, `${name} gesättigt`)} title="Sättigen" className="p-2 rounded-lg text-white/40 hover:text-orange-300 hover:bg-orange-500/10 transition"><Drumstick className="w-4 h-4" /></button>
                      <button onClick={() => setExpanded(expanded === name ? '' : name)} title="Mehr" className={`p-2 rounded-lg transition ${expanded === name ? 'text-white bg-white/[0.06]' : 'text-white/40 hover:text-white/70'}`}><ChevronDown className={`w-4 h-4 transition-transform ${expanded === name ? 'rotate-180' : ''}`} /></button>
                      <button onClick={() => { if (confirm(`${name} kicken?`)) pcmd(name, `kick ${name}`, `${name} gekickt`); }} title="Kicken" className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition"><LogOut className="w-4 h-4" /></button>
                    </div>
                    {expanded === name && (
                      <div className="px-4 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-white/[0.01]">
                        <button onClick={() => pcmd(name, `spawn ${name}`, `${name} zum Spawn`)} className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-[13px] text-white/70 hover:bg-white/[0.05] transition"><MapPin className="w-4 h-4 text-cyan-400/70" /> Zum Spawn teleportieren</button>
                        <button onClick={() => pcmd(name, `xp add ${name} 100 levels`, `${name} +100 Level`)} className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2 text-[13px] text-white/70 hover:bg-white/[0.05] transition"><Sparkles className="w-4 h-4 text-emerald-400/70" /> +100 XP-Level</button>
                        <div className="flex items-center gap-1.5">
                          <input value={item} onChange={e => setItem(e.target.value)} placeholder="Item (z. B. diamond 64)" className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[12px] text-white/80 placeholder:text-white/25 outline-none focus:border-orange-400/40" />
                          <button onClick={() => { if (item.trim()) { pcmd(name, `give ${name} ${item.trim()}`, `Item an ${name}`); setItem(''); } }} className="p-2 rounded-lg text-orange-300/80 hover:bg-orange-500/10"><Package className="w-4 h-4" /></button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Private Nachricht…" className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[12px] text-white/80 placeholder:text-white/25 outline-none focus:border-orange-400/40" />
                          <button onClick={() => { if (msg.trim()) { pcmd(name, `tell ${name} ${msg.trim()}`, `Nachricht an ${name}`); setMsg(''); } }} className="p-2 rounded-lg text-orange-300/80 hover:bg-orange-500/10"><MessageSquare className="w-4 h-4" /></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {playersSub === 'known' && (
              <div className="glass-card rounded-2xl divide-y divide-white/[0.04]">
                {known.length === 0 && <p className="text-sm text-white/30 p-6 text-center">Noch keine bekannten Spieler.</p>}
                {known.map(p => (
                  <div key={p.uuid} className="flex items-center gap-3 px-4 py-3 flex-wrap">
                    <Avatar name={p.name} size={36} />
                    <div className="flex-1 min-w-[120px]">
                      <p className="text-sm text-white/85 font-medium">{p.name}</p>
                      <p className="text-[11px] text-white/30">{p.playtimeHours != null ? `${p.playtimeHours} h gespielt` : 'noch nicht gespielt'}</p>
                    </div>
                    {p.op && <span className="text-[10px] uppercase tracking-wider text-amber-300/70 bg-amber-500/10 rounded px-1.5 py-0.5">OP</span>}
                    {p.banned && <span className="text-[10px] uppercase tracking-wider text-red-300/70 bg-red-500/10 rounded px-1.5 py-0.5">Gebannt</span>}
                    <button onClick={() => pcmd(p.name, p.op ? `deop ${p.name}` : `op ${p.name}`, p.op ? `${p.name} kein OP mehr` : `${p.name} ist OP`)} className="rounded-lg px-2.5 py-1.5 text-[12px] text-amber-300/80 hover:bg-amber-500/10 transition">{p.op ? 'de-OP' : 'OP'}</button>
                    <button onClick={() => pcmd(p.name, p.whitelisted ? `whitelist remove ${p.name}` : `whitelist add ${p.name}`, p.whitelisted ? `${p.name} von Whitelist` : `${p.name} auf Whitelist`)} className="rounded-lg px-2.5 py-1.5 text-[12px] text-emerald-300/80 hover:bg-emerald-500/10 transition">{p.whitelisted ? 'Un-WL' : 'WL'}</button>
                    <button onClick={() => { const c = p.banned ? `pardon ${p.name}` : `ban ${p.name}`; if (p.banned || confirm(`${p.name} bannen?`)) pcmd(p.name, c, p.banned ? `${p.name} entbannt` : `${p.name} gebannt`); setTimeout(loadKnown, 900); }} className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition" title={p.banned ? 'Entbannen' : 'Bannen'}><Ban className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-white/25">Alle Aktionen wirken sofort über RCON (Server muss laufen).</p>
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
            <div className="flex items-center gap-1 bg-white/[0.03] rounded-xl p-1 w-fit">
              <button onClick={() => setPluginSub('installed')} className={`px-3 py-1.5 rounded-lg text-[13px] transition flex items-center gap-1.5 ${pluginSub === 'installed' ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/70'}`}><Puzzle className="w-3.5 h-3.5" /> Installiert ({plugins.length})</button>
              <button onClick={() => setPluginSub('browse')} className={`px-3 py-1.5 rounded-lg text-[13px] transition flex items-center gap-1.5 ${pluginSub === 'browse' ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/70'}`}><Sparkles className="w-3.5 h-3.5" /> Entdecken</button>
            </div>

            {pluginSub === 'installed' && (<>
              <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
                <Puzzle className="w-4 h-4 text-orange-400/70 flex-shrink-0" />
                <input value={pluginUrl} onChange={e => setPluginUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && installPlugin()} placeholder="Plugin-Name (z. B. luckperms) oder Modrinth-Link…" className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/25 outline-none focus:border-orange-400/40" />
                <button disabled={busy || !pluginUrl.trim()} onClick={installPlugin} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm bg-orange-500/15 border border-orange-500/25 text-orange-300 hover:bg-orange-500/25 disabled:opacity-30 transition"><Plus className="w-4 h-4" /> Installieren</button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-white/40">{plugins.length} Plugin{plugins.length !== 1 ? 's' : ''}{pluginUpdates.length ? ` · ${pluginUpdates.length} Update${pluginUpdates.length !== 1 ? 's' : ''}` : ''}</p>
                <button disabled={checkingUpdates} onClick={checkUpdates} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] bg-white/[0.04] border border-white/[0.08] text-white/60 hover:text-white/90 hover:bg-white/[0.07] disabled:opacity-40 transition"><RotateCw className={`w-3.5 h-3.5 ${checkingUpdates ? 'animate-spin' : ''}`} /> {checkingUpdates ? 'Prüfe…' : 'Nach Updates suchen'}</button>
              </div>
              <div className="glass-card rounded-2xl divide-y divide-white/[0.04]">
                {plugins.length === 0 && <p className="text-sm text-white/30 p-5 text-center">Keine Plugins installiert.</p>}
                {plugins.map(p => {
                  const upd = pluginUpdates.find(u => u.file === p.name);
                  return (
                    <div key={p.name} className="flex items-center gap-3 px-4 py-3 flex-wrap">
                      <Puzzle className={`w-4 h-4 flex-shrink-0 ${p.enabled ? 'text-emerald-400/70' : 'text-white/20'}`} />
                      <div className="flex-1 min-w-[120px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-mono truncate ${p.enabled ? 'text-white/80' : 'text-white/40'}`}>{p.name}</p>
                          {upd && <span className="text-[10px] uppercase tracking-wider text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">Update: {upd.latest}</span>}
                        </div>
                        <p className="text-[11px] text-white/25">{fmtSize(p.size)} · {p.enabled ? 'aktiv' : 'deaktiviert'}</p>
                      </div>
                      {upd && <button disabled={pluginBusy === upd.slug} onClick={() => installBySlug(upd.slug, p.name)} className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] text-amber-200 bg-amber-500/15 border border-amber-500/25 hover:bg-amber-500/25 disabled:opacity-40 transition">{pluginBusy === upd.slug ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />} Aktualisieren</button>}
                      <Toggle checked={p.enabled} onChange={() => togglePlugin(p)} />
                      <button onClick={() => deletePlugin(p)} className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-white/25">Gib den Modrinth-Namen (z. B. <span className="font-mono text-white/40">coreprotect</span>) oder einen direkten <span className="font-mono text-white/40">.jar</span>-Link an. Nach Installieren/Aktualisieren Neustart nötig. Plugin-Einstellungen im Tab „Dateien".</p>
            </>)}

            {pluginSub === 'browse' && (<>
              <div className="glass-card rounded-2xl p-4 flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-orange-400/70 flex-shrink-0" />
                <input value={browseQuery} onChange={e => setBrowseQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && browsePlugins()} placeholder="Modrinth durchsuchen (z. B. economy, protection, chat)…" className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/25 outline-none focus:border-orange-400/40" />
                <button disabled={browsing} onClick={browsePlugins} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm bg-orange-500/15 border border-orange-500/25 text-orange-300 hover:bg-orange-500/25 disabled:opacity-30 transition">{browsing ? <RotateCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Suchen</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {browseResults.length === 0 && !browsing && <p className="text-sm text-white/30 p-5 text-center md:col-span-2">Keine Treffer.</p>}
                {browseResults.map(r => {
                  const inst = plugins.some(p => p.name.toLowerCase().startsWith(r.slug.toLowerCase()));
                  return (
                    <div key={r.slug} className="glass-card rounded-2xl p-4 flex gap-3">
                      <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center overflow-hidden flex-shrink-0">
                        {r.icon ? <img src={r.icon} alt="" className="w-full h-full object-cover" /> : <Puzzle className="w-5 h-5 text-white/30" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-white/85 truncate">{r.title}</p>
                          {r.compatible && <span className="text-[10px] text-emerald-300/70 bg-emerald-500/10 rounded px-1.5 py-0.5">26.2 ✓</span>}
                        </div>
                        <p className="text-[11px] text-white/35 line-clamp-2 mt-0.5">{r.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] text-white/25">{r.downloads?.toLocaleString('de-DE')} Downloads</span>
                          {inst
                            ? <span className="ml-auto text-[12px] text-emerald-300/70 flex items-center gap-1"><Circle className="w-2 h-2 fill-current" /> installiert</span>
                            : <button disabled={pluginBusy === r.slug} onClick={() => installBySlug(r.slug, r.title)} className="ml-auto flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] text-orange-200 bg-orange-500/15 border border-orange-500/25 hover:bg-orange-500/25 disabled:opacity-40 transition">{pluginBusy === r.slug ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Installieren</button>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-white/25">Quelle: Modrinth · passende Version für MC 26.2 wird automatisch geholt. Nach dem Installieren Server neu starten.</p>
            </>)}
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

        {/* Automatik */}
        {tab === 'automation' && (
          <div className="space-y-4">
            {/* Auto-Backups */}
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2"><Archive className="w-4 h-4 text-emerald-400/80" /><h3 className="text-sm font-medium text-white/70">Automatische Backups</h3></div>
                <Toggle checked={autoBackup.enabled} onChange={v => saveAutoBackup({ enabled: v })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] text-white/45">Intervall (Stunden)</span>
                  <input type="number" min={1} max={720} value={autoBackup.intervalHours} onChange={e => setAutoBackup(p => ({ ...p, intervalHours: parseInt(e.target.value) || 1 }))} onBlur={() => saveAutoBackup({})} className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 outline-none focus:border-orange-400/40" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] text-white/45">Aufbewahren (Anzahl)</span>
                  <input type="number" min={1} max={100} value={autoBackup.retention} onChange={e => setAutoBackup(p => ({ ...p, retention: parseInt(e.target.value) || 1 }))} onBlur={() => saveAutoBackup({})} className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 outline-none focus:border-orange-400/40" />
                </label>
              </div>
              <p className="text-[11px] text-white/25 mt-3">
                {autoBackup.enabled
                  ? `Aktiv · alle ${autoBackup.intervalHours} h, ${autoBackup.retention} neueste behalten${lastBackupAt ? ` · nächstes ~ ${fmtDate(new Date(lastBackupAt + autoBackup.intervalHours * 3600000).toISOString())}` : ''}`
                  : 'Deaktiviert — Backups nur manuell im Tab „Backups".'}
              </p>
            </div>

            {/* Geplante Befehle */}
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4"><CalendarClock className="w-4 h-4 text-orange-400/80" /><h3 className="text-sm font-medium text-white/70">Geplante Befehle</h3></div>
              <div className="flex flex-col gap-2.5 mb-4">
                <input value={newCmd} onChange={e => setNewCmd(e.target.value)} placeholder="Befehl (z. B. say Server-Neustart in 5 Min)" className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 placeholder:text-white/25 outline-none focus:border-orange-400/40" />
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-1">
                    <button onClick={() => setCmdType('daily')} className={`px-3 py-1.5 rounded-md text-[12px] transition flex items-center gap-1.5 ${cmdType === 'daily' ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/70'}`}><Clock className="w-3.5 h-3.5" /> Täglich</button>
                    <button onClick={() => setCmdType('interval')} className={`px-3 py-1.5 rounded-md text-[12px] transition flex items-center gap-1.5 ${cmdType === 'interval' ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/70'}`}><Repeat className="w-3.5 h-3.5" /> Intervall</button>
                  </div>
                  {cmdType === 'daily'
                    ? <input type="time" value={cmdTime} onChange={e => setCmdTime(e.target.value)} className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 outline-none focus:border-orange-400/40" />
                    : <div className="flex items-center gap-1.5"><span className="text-[12px] text-white/40">alle</span><input type="number" min={1} max={10080} value={cmdMinutes} onChange={e => setCmdMinutes(parseInt(e.target.value) || 1)} className="w-24 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/80 outline-none focus:border-orange-400/40" /><span className="text-[12px] text-white/40">Min.</span></div>}
                  <button disabled={busy || !newCmd.trim()} onClick={addSchedCmd} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm bg-orange-500/15 border border-orange-500/25 text-orange-200 hover:bg-orange-500/25 disabled:opacity-30 transition ml-auto"><Plus className="w-4 h-4" /> Anlegen</button>
                </div>
              </div>
              <div className="rounded-xl divide-y divide-white/[0.04] bg-white/[0.01] border border-white/[0.04]">
                {schedCmds.length === 0 && <p className="text-sm text-white/30 p-5 text-center">Noch keine geplanten Befehle.</p>}
                {schedCmds.map(c => (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                    {c.type === 'daily' ? <Clock className="w-4 h-4 text-cyan-400/60 flex-shrink-0" /> : <Repeat className="w-4 h-4 text-violet-400/60 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-mono truncate ${c.enabled ? 'text-white/80' : 'text-white/35'}`}>/{c.command}</p>
                      <p className="text-[11px] text-white/25">{c.type === 'daily' ? `täglich um ${c.time} Uhr` : `alle ${c.minutes} Min.`}{c.lastRun ? ` · zuletzt ${fmtDate(new Date(c.lastRun).toISOString())}` : ''}</p>
                    </div>
                    <Toggle checked={c.enabled} onChange={() => toggleSchedCmd(c)} />
                    <button onClick={() => deleteSchedCmd(c)} className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-white/25 mt-3">Befehle laufen server-seitig über RCON — auch ohne offenen Browser. Der Server muss zur Ausführung laufen.</p>
            </div>
          </div>
        )}

        {/* Karte */}
        {tab === 'map' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2"><Layers className="w-4 h-4 text-cyan-400/80" /><h3 className="text-sm font-medium text-white/70">Live-Karte · BlueMap</h3></div>
              <a href={MAP_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] bg-cyan-500/15 border border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/25 transition"><ExternalLink className="w-3.5 h-3.5" /> In neuem Tab öffnen</a>
            </div>
            <div className="glass-card rounded-2xl overflow-hidden bg-black/40">
              <iframe src={MAP_URL} title="BlueMap" className="w-full h-[70vh] border-0" />
            </div>
            <p className="text-[11px] text-white/25">Interaktive 3D-/2D-Karte (Overworld, Nether, End). Bleibt die Einbettung leer, blockiert der Browser gemischte Inhalte (HTTPS-Dashboard ↔ HTTP-Karte) — dann „In neuem Tab öffnen" nutzen. Dauerhafte Lösung: BlueMap über eine eigene HTTPS-Subdomain (Cloudflare-Tunnel).</p>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
