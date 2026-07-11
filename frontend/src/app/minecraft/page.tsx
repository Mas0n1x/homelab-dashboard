/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Play, Square, RotateCw, TerminalSquare, SlidersHorizontal, Save, Send, Circle } from 'lucide-react';
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
  // ANSI-Escape-Codes entfernen
  return s.replace(/\x1b\[[0-9;]*m/g, '').replace(/\r/g, '');
}

interface Status {
  state?: string;
  running?: boolean;
  health?: string | null;
  startedAt?: string;
  error?: string;
}

export default function MinecraftPage() {
  const [status, setStatus] = useState<Status>({});
  const [tab, setTab] = useState<'console' | 'config'>('console');
  const [logs, setLogs] = useState('');
  const [command, setCommand] = useState('');
  const [busy, setBusy] = useState(false);
  const [configs, setConfigs] = useState<string[]>([]);
  const [activeConfig, setActiveConfig] = useState('');
  const [configContent, setConfigContent] = useState('');
  const [configDirty, setConfigDirty] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const refreshStatus = useCallback(async () => {
    setStatus(await mcApi('/status'));
  }, []);

  const refreshLogs = useCallback(async () => {
    const r = await mcApi('/logs?tail=300');
    if (typeof r.logs === 'string') setLogs(stripAnsi(r.logs));
  }, []);

  // Status-Poll
  useEffect(() => {
    refreshStatus();
    const t = setInterval(refreshStatus, 5000);
    return () => clearInterval(t);
  }, [refreshStatus]);

  // Log-Poll (nur im Konsolen-Tab)
  useEffect(() => {
    if (tab !== 'console') return;
    refreshLogs();
    const t = setInterval(refreshLogs, 3000);
    return () => clearInterval(t);
  }, [tab, refreshLogs]);

  // Auto-Scroll
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  // Configs laden
  useEffect(() => {
    if (tab !== 'config') return;
    mcApi('/configs').then(r => {
      const files: string[] = r.files || [];
      setConfigs(files);
      if (files.length && !activeConfig) loadConfig(files[0]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const loadConfig = async (file: string) => {
    setActiveConfig(file);
    const r = await mcApi(`/config/${file}`);
    setConfigContent(r.content ?? '');
    setConfigDirty(false);
  };

  const saveConfig = async () => {
    setBusy(true);
    await mcApi(`/config/${activeConfig}`, { method: 'PUT', body: JSON.stringify({ content: configContent }) });
    setBusy(false);
    setConfigDirty(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const power = async (action: string) => {
    setBusy(true);
    await mcApi('/power', { method: 'POST', body: JSON.stringify({ action }) });
    setTimeout(refreshStatus, 1500);
    setBusy(false);
  };

  const sendCommand = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const cmd = command.trim();
    if (!cmd) return;
    setCommand('');
    setLogs(prev => prev + `\n> ${cmd}`);
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
              <input value={command} onChange={e => setCommand(e.target.value)} placeholder="Befehl eingeben (z. B. say Hallo, time set day, op Spieler)…"
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
            <div className="glass-card rounded-2xl p-3 space-y-1 h-fit">
              {configs.map(f => (
                <button key={f} onClick={() => loadConfig(f)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[13px] font-mono truncate transition ${activeConfig === f ? 'bg-white/[0.06] text-white' : 'text-white/50 hover:bg-white/[0.03]'}`}>
                  {f}
                </button>
              ))}
              {!configs.length && <p className="text-xs text-white/25 px-3 py-2">Lade…</p>}
            </div>
            <div className="glass-card rounded-2xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
                <span className="text-sm font-mono text-white/60">{activeConfig || '—'}</span>
                <button disabled={busy || !configDirty} onClick={saveConfig}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-30 transition">
                  <Save className="w-3.5 h-3.5" /> {savedFlash ? 'Gespeichert!' : 'Speichern'}
                </button>
              </div>
              <textarea value={configContent} onChange={e => { setConfigContent(e.target.value); setConfigDirty(true); }} spellCheck={false}
                className="h-[46vh] w-full resize-none bg-black/30 p-4 font-mono text-[12px] leading-relaxed text-white/75 outline-none" />
              <p className="text-[11px] text-white/25 px-4 py-2 border-t border-white/[0.06]">
                Änderungen wirken je nach Datei erst nach einem Neustart des Servers.
              </p>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
