/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal as TermIcon, Server, X, ShieldAlert } from 'lucide-react';
import { clsx } from 'clsx';
import { PageTransition } from '@/components/ui/PageTransition';
import { GlassCard } from '@/components/ui/GlassCard';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';

export default function TerminalPage() {
  const { servers } = useServerStore();
  const { accessToken } = useAuthStore();

  const [connectedId, setConnectedId] = useState<string>('');
  const [connectingId, setConnectingId] = useState<string>('');

  const termRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const xtermRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);

  const disconnect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'terminal-close' }));
      wsRef.current.close();
    }
    wsRef.current = null;
    setConnectedId('');
    setConnectingId('');
  }, []);

  const connect = useCallback(async (serverId: string) => {
    setConnectingId(serverId);
    const { Terminal } = await import('@xterm/xterm');
    const { FitAddon } = await import('@xterm/addon-fit');
    const { WebLinksAddon } = await import('@xterm/addon-web-links');

    if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
    if (xtermRef.current) { xtermRef.current.dispose(); xtermRef.current = null; }
    if (!termRef.current) return;
    termRef.current.innerHTML = '';

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Fira Code, monospace',
      theme: {
        background: '#0a0a1a', foreground: '#e4e4ef', cursor: '#818cf8', cursorAccent: '#0a0a1a',
        selectionBackground: '#818cf850', black: '#1a1a2e', red: '#f87171', green: '#34d399',
        yellow: '#fbbf24', blue: '#818cf8', magenta: '#c084fc', cyan: '#22d3ee', white: '#e4e4ef',
        brightBlack: '#4a4a6a', brightRed: '#fca5a5', brightGreen: '#6ee7b7', brightYellow: '#fde68a',
        brightBlue: '#a5b4fc', brightMagenta: '#d8b4fe', brightCyan: '#67e8f9', brightWhite: '#ffffff',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(termRef.current);
    fitAddon.fit();
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port ? `${window.location.hostname}:${window.location.port}` : window.location.hostname;
    const ws = new WebSocket(`${protocol}//${host}/ws?token=${encodeURIComponent(accessToken || '')}`);
    wsRef.current = ws;

    ws.onopen = () => {
      term.writeln('\x1b[90m--- Verbinde via SSH ...\x1b[0m');
      ws.send(JSON.stringify({ type: 'host-shell-open', serverId, cols: term.cols, rows: term.rows }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'terminal-opened') {
          setConnectedId(serverId);
          setConnectingId('');
          term.writeln(`\x1b[32m--- Verbunden: ${msg.name} ---\x1b[0m`);
          ws.send(JSON.stringify({ type: 'terminal-resize', cols: term.cols, rows: term.rows, serverId }));
        }
        if (msg.type === 'terminal-data') {
          term.write(Uint8Array.from(atob(msg.data), c => c.charCodeAt(0)));
        }
        if (msg.type === 'terminal-error') {
          term.writeln(`\r\n\x1b[31mFehler: ${msg.error}\x1b[0m`);
          setConnectingId('');
        }
        if (msg.type === 'terminal-closed') {
          term.writeln('\r\n\x1b[33m--- Verbindung geschlossen ---\x1b[0m');
          setConnectedId('');
        }
      } catch {}
    };

    ws.onclose = () => {
      term.writeln('\r\n\x1b[33m--- WebSocket getrennt ---\x1b[0m');
      setConnectedId('');
      setConnectingId('');
    };

    term.onData((input) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'terminal-input', data: btoa(unescape(encodeURIComponent(input))) }));
      }
    });

    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'terminal-resize', cols, rows, serverId }));
      }
    });
  }, [accessToken]);

  useEffect(() => {
    const handleResize = () => fitAddonRef.current?.fit();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      disconnect();
      if (xtermRef.current) { xtermRef.current.dispose(); xtermRef.current = null; }
    };
  }, [disconnect]);

  return (
    <PageTransition>
      <div className="flex flex-col gap-4 h-[calc(100dvh-11rem)] md:h-[calc(100dvh-9rem)]">
        {/* Header */}
        <div className="space-y-3">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <TermIcon className="w-5 h-5 text-cyan-400" />
              Terminal
            </h1>
            <p className="text-sm text-white/40 mt-0.5 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400/70" />
              Root-Shell direkt auf dem Server-Host
            </p>
          </div>

          {/* Server-Auswahl */}
          <div className="flex flex-wrap items-center gap-2">
            {servers.map(s => {
              const active = connectedId === s.id;
              const loading = connectingId === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => connect(s.id)}
                  disabled={loading}
                  className={clsx(
                    'flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm border transition-all',
                    active
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-white/[0.03] border-white/[0.08] text-white/60 hover:text-white/90 hover:bg-white/[0.06]'
                  )}
                >
                  <span className="relative flex-shrink-0">
                    <Server className="w-4 h-4" />
                    <span className={clsx('absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-[#0a0a1a]',
                      s.status === 'connected' ? 'bg-emerald-400' : 'bg-red-400')} />
                  </span>
                  <span className="truncate max-w-[160px]">{s.name}</span>
                  {loading && <span className="text-[10px] text-white/40">verbinde…</span>}
                </button>
              );
            })}
            {connectedId && (
              <button onClick={disconnect} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors ml-auto">
                <X className="w-4 h-4" /> Trennen
              </button>
            )}
          </div>
        </div>

        {/* Terminal */}
        <GlassCard padding={false} className="flex-1 overflow-hidden">
          <div className="relative z-10 h-full">
            {!connectedId && !connectingId && !xtermRef.current && (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-white/30 gap-4">
                <TermIcon className="w-16 h-16 text-white/10" />
                <p className="text-sm">Wähle einen Server, um eine Root-Shell zu öffnen</p>
              </div>
            )}
            <div
              ref={termRef}
              className="h-full min-h-[300px] p-2"
              style={{ display: connectedId || connectingId || xtermRef.current ? 'block' : 'none' }}
            />
          </div>
        </GlassCard>
      </div>
    </PageTransition>
  );
}
