/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, TerminalSquare } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { type Api, stripAnsi } from './shared';

const lineColor = (l: string) =>
  /ERROR|SEVERE|Exception|\bFAILED\b|\bFAIL\b|Fehler/i.test(l) ? 'text-red-400/90'
    : /WARN/i.test(l) ? 'text-amber-300/85'
    : /^>/.test(l) ? 'text-orange-300/90'
    : /\bINFO\b/.test(l) ? 'text-white/55' : 'text-white/45';

export function ConsolePanel({ serverId, api, running }: { serverId: string; api: Api; running: boolean }) {
  const [logs, setLogs] = useState('');
  const [command, setCommand] = useState('');
  const [live, setLive] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const histRef = useRef(-1);
  const wsRef = useRef<WebSocket | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  const append = useCallback((s: string) => setLogs(p => { const n = p + s; return n.length > 120000 ? n.slice(n.length - 120000) : n; }), []);

  useEffect(() => {
    let closedByUs = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    let ws: WebSocket | null = null;
    const refresh = async () => { const r = await api('/logs?tail=300'); if (typeof r.logs === 'string') setLogs(stripAnsi(r.logs)); };
    const startPolling = () => { if (poll) return; refresh(); poll = setInterval(refresh, 3000); };
    setLogs('');
    try {
      const { accessToken } = useAuthStore.getState();
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${proto}//${window.location.host}/api/gameservers/console?token=${encodeURIComponent(accessToken || '')}&server=${encodeURIComponent(serverId)}`);
      wsRef.current = ws;
      ws.onopen = () => setLive(true);
      ws.onmessage = (ev) => {
        try {
          const m = JSON.parse(ev.data);
          if (m.type === 'log') append(stripAnsi(m.data || ''));
          else if (m.type === 'error') append(`[Fehler] ${m.data}\n`);
        } catch { /* ungültige Nachricht */ }
      };
      ws.onclose = () => { setLive(false); wsRef.current = null; if (!closedByUs) startPolling(); };
    } catch { startPolling(); }
    return () => {
      closedByUs = true;
      if (poll) clearInterval(poll);
      try { ws?.close(); } catch { /* */ }
      wsRef.current = null; setLive(false);
    };
  }, [serverId, api, append]);

  // Nur mitscrollen, solange der Nutzer unten klebt — sonst lässt sich nichts nachlesen.
  useEffect(() => { const el = logRef.current; if (el && stickRef.current) el.scrollTop = el.scrollHeight; }, [logs]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const c = command.trim();
    if (!c) return;
    setCommand(''); setHistory(h => [...h.filter(x => x !== c), c].slice(-50)); histRef.current = -1;
    append(`> ${c}\n`);
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'command', command: c }));
    else { const r = await api('/command', { method: 'POST', body: JSON.stringify({ command: c }) }); if (r.error) append(`[Fehler] ${r.error}\n`); }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); if (!history.length) return; histRef.current = histRef.current < 0 ? history.length - 1 : Math.max(0, histRef.current - 1); setCommand(history[histRef.current] || ''); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (histRef.current < 0) return; histRef.current += 1; if (histRef.current >= history.length) { histRef.current = -1; setCommand(''); } else setCommand(history[histRef.current]); }
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2 text-xs text-white/40"><TerminalSquare className="w-3.5 h-3.5" /> Live-Konsole</div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className={`flex items-center gap-1 ${live ? 'text-emerald-400' : 'text-amber-400/80'}`}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: live ? '#10b981' : '#f59e0b' }} />{live ? 'Live' : 'Polling'}
          </span>
          <button onClick={() => setLogs('')} className="text-white/30 hover:text-white/60 transition">leeren</button>
        </div>
      </div>
      <div ref={logRef}
        onScroll={e => { const el = e.currentTarget; stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }}
        className="h-[52vh] overflow-y-auto p-4 font-mono text-[12px] leading-[1.55] bg-black/25">
        {logs ? logs.split('\n').map((l, i) => <div key={i} className={`${lineColor(l)} whitespace-pre-wrap break-all`}>{l || ' '}</div>)
          : <p className="text-white/25">{running ? 'Warte auf Ausgabe…' : 'Server gestoppt — noch keine Ausgabe.'}</p>}
      </div>
      <form onSubmit={send} className="flex items-center gap-2 p-3 border-t border-white/[0.06]">
        <span className="text-orange-400/70 font-mono text-sm pl-1">/</span>
        <input value={command} onChange={e => setCommand(e.target.value)} onKeyDown={onKey} disabled={!running}
          placeholder={running ? 'Befehl (↑/↓ für Verlauf) …' : 'Server ist gestoppt'}
          className="flex-1 bg-transparent outline-none text-sm font-mono text-white/80 placeholder:text-white/25 disabled:opacity-40" />
        <button type="submit" disabled={!running || !command.trim()}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] bg-orange-500/15 border border-orange-500/25 text-orange-300 hover:bg-orange-500/25 disabled:opacity-30 transition">
          <Send className="w-3.5 h-3.5" /> Senden
        </button>
      </form>
    </div>
  );
}
