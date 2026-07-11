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
  Server as ServerIcon, Globe, Swords, Code2, FileText,
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

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '').replace(/\r/g, '');
}

// ─── server.properties Schema (strukturierte Einstellungen) ───
type FieldType = 'text' | 'number' | 'bool' | 'select';
interface PropField { key: string; label: string; type: FieldType; options?: string[]; hint?: string }
const SCHEMA: { section: string; icon: any; fields: PropField[] }[] = [
  {
    section: 'Server', icon: ServerIcon, fields: [
      { key: 'motd', label: 'Server-Name (MOTD)', type: 'text' },
      { key: 'max-players', label: 'Max. Spieler', type: 'number' },
      { key: 'online-mode', label: 'Online-Modus', type: 'bool', hint: 'Nur Premium-Accounts' },
      { key: 'white-list', label: 'Whitelist aktiv', type: 'bool' },
    ],
  },
  {
    section: 'Welt', icon: Globe, fields: [
      { key: 'gamemode', label: 'Spielmodus', type: 'select', options: ['survival', 'creative', 'adventure', 'spectator'] },
      { key: 'difficulty', label: 'Schwierigkeit', type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'] },
      { key: 'level-seed', label: 'Welt-Seed', type: 'text', hint: 'leer = zufällig' },
      { key: 'hardcore', label: 'Hardcore-Modus', type: 'bool' },
      { key: 'allow-nether', label: 'Nether erlauben', type: 'bool' },
      { key: 'spawn-protection', label: 'Spawn-Schutz (Blöcke)', type: 'number' },
    ],
  },
  {
    section: 'Gameplay', icon: Swords, fields: [
      { key: 'pvp', label: 'PvP (Spieler vs. Spieler)', type: 'bool' },
      { key: 'allow-flight', label: 'Fliegen erlauben', type: 'bool' },
      { key: 'view-distance', label: 'Sichtweite (Chunks)', type: 'number' },
      { key: 'spawn-monsters', label: 'Monster spawnen', type: 'bool' },
      { key: 'enable-command-block', label: 'Command-Blöcke', type: 'bool' },
    ],
  },
];
const SCHEMA_KEYS = new Set(SCHEMA.flatMap(s => s.fields.map(f => f.key)));

function parseProps(text: string): Map<string, string> {
  const m = new Map<string, string>();
  text.split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const i = t.indexOf('=');
    if (i > 0) m.set(t.slice(0, i), t.slice(i + 1));
  });
  return m;
}
function applyProps(original: string, changes: Map<string, string>): string {
  return original.split('\n').map(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return line;
    const i = t.indexOf('=');
    if (i <= 0) return line;
    const key = t.slice(0, i);
    return changes.has(key) ? `${key}=${changes.get(key)}` : line;
  }).join('\n');
}

// ─── UI-Bausteine ───
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-emerald-500/50' : 'bg-white/[0.1]'}`}>
      <motion.span layout className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow"
        style={{ left: checked ? 'calc(100% - 22px)' : '2px' }} />
    </button>
  );
}

export default function MinecraftPage() {
  const [status, setStatus] = useState<any>({});
  const [tab, setTab] = useState<'console' | 'config'>('console');
  const [logs, setLogs] = useState('');
  const [command, setCommand] = useState('');
  const [busy, setBusy] = useState(false);
  const [configs, setConfigs] = useState<string[]>([]);
  const [activeConfig, setActiveConfig] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [props, setProps] = useState<Map<string, string>>(new Map());
  const [dirty, setDirty] = useState(false);
  const [rawMode, setRawMode] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const isProps = activeConfig === 'server.properties';

  const refreshStatus = useCallback(async () => { setStatus(await mcApi('/status')); }, []);
  const refreshLogs = useCallback(async () => {
    const r = await mcApi('/logs?tail=300');
    if (typeof r.logs === 'string') setLogs(stripAnsi(r.logs));
  }, []);

  useEffect(() => { refreshStatus(); const t = setInterval(refreshStatus, 5000); return () => clearInterval(t); }, [refreshStatus]);
  useEffect(() => {
    if (tab !== 'console') return;
    refreshLogs(); const t = setInterval(refreshLogs, 3000); return () => clearInterval(t);
  }, [tab, refreshLogs]);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);
  useEffect(() => {
    if (tab !== 'config') return;
    mcApi('/configs').then(r => {
      const files: string[] = r.files || [];
      setConfigs(files);
      if (files.length && !activeConfig) loadConfig(files.includes('server.properties') ? 'server.properties' : files[0]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const loadConfig = async (file: string) => {
    setActiveConfig(file);
    setRawMode(false);
    const r = await mcApi(`/config/${file}`);
    const content = r.content ?? '';
    setRawContent(content);
    if (file === 'server.properties') setProps(parseProps(content));
    setDirty(false);
  };

  const setProp = (key: string, value: string) => {
    setProps(prev => { const n = new Map(prev); n.set(key, value); return n; });
    setDirty(true);
  };

  const saveConfig = async () => {
    setBusy(true);
    const content = isProps && !rawMode ? applyProps(rawContent, props) : rawContent;
    await mcApi(`/config/${activeConfig}`, { method: 'PUT', body: JSON.stringify({ content }) });
    setRawContent(content);
    if (isProps) setProps(parseProps(content));
    setBusy(false); setDirty(false);
    setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1500);
  };

  const power = async (action: string) => {
    setBusy(true);
    await mcApi('/power', { method: 'POST', body: JSON.stringify({ action }) });
    setTimeout(refreshStatus, 1500); setBusy(false);
  };

  const sendCommand = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cmd = command.trim(); if (!cmd) return;
    setCommand(''); setLogs(prev => prev + `\n> ${cmd}`);
    const r = await mcApi('/command', { method: 'POST', body: JSON.stringify({ command: cmd }) });
    if (r.response) setLogs(prev => prev + `\n${stripAnsi(r.response)}`);
    else if (r.error) setLogs(prev => prev + `\n[Fehler] ${r.error}`);
    setTimeout(refreshLogs, 500);
  };

  const running = status.running;
  const statusColor = status.error ? '#6b7280' : running ? '#10b981' : '#ef4444';
  const statusText = status.error ? 'Agent nicht erreichbar' : running ? (status.health === 'healthy' ? 'Läuft' : 'Startet…') : 'Gestoppt';

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold">
              Minecraft <span className="text-gradient">Server</span>
            </motion.h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-white/40">
              <Circle className="w-2.5 h-2.5" style={{ fill: statusColor, color: statusColor }} />
              <span style={{ color: statusColor }}>{statusText}</span>
              <span className="text-white/20">·</span>
              <span>45.133.9.70:25565</span>
              <span className="text-white/20">·</span>
              <span>Paper</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button disabled={busy || running} onClick={() => power('start')}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-30 transition">
              <Play className="w-4 h-4" /> Start
            </button>
            <button disabled={busy || !running} onClick={() => power('restart')}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 disabled:opacity-30 transition">
              <RotateCw className="w-4 h-4" /> Neustart
            </button>
            <button disabled={busy || !running} onClick={() => power('stop')}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 disabled:opacity-30 transition">
              <Square className="w-4 h-4" /> Stopp
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-white/[0.06]">
          {([['console', 'Konsole', TerminalSquare], ['config', 'Konfiguration', SlidersHorizontal]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 -mb-px transition ${tab === id ? 'border-orange-400 text-white' : 'border-transparent text-white/40 hover:text-white/70'}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* Konsole */}
        {tab === 'console' && (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div ref={logRef} className="h-[52vh] overflow-y-auto p-4 font-mono text-[12px] leading-relaxed text-white/70 whitespace-pre-wrap bg-black/30">
              {logs || 'Lade Konsole…'}
            </div>
            <form onSubmit={sendCommand} className="flex items-center gap-2 border-t border-white/[0.06] p-3 bg-white/[0.02]">
              <span className="text-orange-400/70 font-mono text-sm pl-1">/</span>
              <input value={command} onChange={e => setCommand(e.target.value)} placeholder="Befehl (z. B. say Hallo, time set day, op Spieler, weather clear)…"
                className="flex-1 bg-transparent outline-none text-sm text-white/80 placeholder:text-white/25 font-mono" />
              <button type="submit" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm bg-orange-500/15 border border-orange-500/25 text-orange-300 hover:bg-orange-500/25 transition">
                <Send className="w-3.5 h-3.5" /> Senden
              </button>
            </form>
          </div>
        )}

        {/* Konfiguration */}
        {tab === 'config' && (
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
            {/* Datei-Liste */}
            <div className="glass-card rounded-2xl p-3 space-y-1 h-fit">
              <p className="text-[10px] uppercase tracking-widest text-white/25 px-3 pt-1 pb-2">Dateien</p>
              {configs.map(f => (
                <button key={f} onClick={() => loadConfig(f)}
                  className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-[13px] font-mono truncate transition ${activeConfig === f ? 'bg-white/[0.06] text-white' : 'text-white/50 hover:bg-white/[0.03]'}`}>
                  <FileText className="w-3.5 h-3.5 opacity-40" /> {f}
                </button>
              ))}
              {!configs.length && <p className="text-xs text-white/25 px-3 py-2">Lade…</p>}
            </div>

            {/* Editor */}
            <div className="glass-card rounded-2xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-white/60">{activeConfig || '—'}</span>
                  {isProps && (
                    <button onClick={() => setRawMode(m => !m)}
                      className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/60 transition">
                      <Code2 className="w-3 h-3" /> {rawMode ? 'Formular' : 'Rohtext'}
                    </button>
                  )}
                </div>
                <button disabled={busy || !dirty} onClick={saveConfig}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-30 transition">
                  <Save className="w-3.5 h-3.5" /> {savedFlash ? 'Gespeichert!' : 'Speichern'}
                </button>
              </div>

              {/* Strukturierte Form (nur server.properties, nicht Rohtext) */}
              {isProps && !rawMode ? (
                <div className="max-h-[52vh] overflow-y-auto p-5 space-y-6">
                  {SCHEMA.map(sec => {
                    const Icon = sec.icon;
                    return (
                      <div key={sec.section}>
                        <div className="flex items-center gap-2 mb-3">
                          <Icon className="w-4 h-4 text-orange-400/70" />
                          <h3 className="text-xs uppercase tracking-widest text-white/40 font-medium">{sec.section}</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {sec.fields.map(field => {
                            const val = props.get(field.key) ?? '';
                            return (
                              <div key={field.key} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.02] border border-white/[0.05] px-3.5 py-2.5">
                                <div className="min-w-0">
                                  <p className="text-[13px] text-white/70 truncate">{field.label}</p>
                                  {field.hint && <p className="text-[10px] text-white/25">{field.hint}</p>}
                                </div>
                                {field.type === 'bool' ? (
                                  <Toggle checked={val === 'true'} onChange={v => setProp(field.key, v ? 'true' : 'false')} />
                                ) : field.type === 'select' ? (
                                  <select value={val} onChange={e => setProp(field.key, e.target.value)}
                                    className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-1 text-[13px] text-white/80 outline-none focus:border-orange-400/40 capitalize">
                                    {field.options!.map(o => <option key={o} value={o} className="bg-neutral-900">{o}</option>)}
                                  </select>
                                ) : (
                                  <input type={field.type === 'number' ? 'number' : 'text'} value={val}
                                    onChange={e => setProp(field.key, e.target.value)}
                                    className="w-32 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-1 text-[13px] text-white/80 outline-none focus:border-orange-400/40 text-right" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-[11px] text-white/25 pt-2 border-t border-white/[0.05]">
                    Weitere Optionen im Rohtext-Modus. Änderungen wirken nach einem Server-Neustart.
                  </p>
                </div>
              ) : (
                <>
                  <textarea value={rawContent} onChange={e => { setRawContent(e.target.value); setDirty(true); }} spellCheck={false}
                    className="h-[46vh] w-full resize-none bg-black/30 p-4 font-mono text-[12px] leading-relaxed text-white/75 outline-none" />
                  <p className="text-[11px] text-white/25 px-4 py-2 border-t border-white/[0.06]">
                    Änderungen wirken je nach Datei erst nach einem Neustart des Servers.
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
