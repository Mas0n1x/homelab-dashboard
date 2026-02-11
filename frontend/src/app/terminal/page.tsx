'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Terminal as TermIcon, ChevronDown, Circle, X } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useServerStore } from '@/stores/serverStore';
import type { Container } from '@/lib/types';

export default function TerminalPage() {
  const { activeServerId } = useServerStore();
  const { data: containers } = useQuery<Container[]>({
    queryKey: ['containers', activeServerId],
    enabled: false,
  });

  const [selectedContainer, setSelectedContainer] = useState<string>('');
  const [connectedTo, setConnectedTo] = useState<string>('');
  const [showSelector, setShowSelector] = useState(false);

  const termRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const xtermRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);

  const runningContainers = (containers || []).filter(c => c.state === 'running');

  const connect = useCallback(async (containerId: string) => {
    // Dynamic imports for xterm (client-side only)
    const { Terminal } = await import('@xterm/xterm');
    const { FitAddon } = await import('@xterm/addon-fit');
    const { WebLinksAddon } = await import('@xterm/addon-web-links');

    // Clean up previous terminal
    if (xtermRef.current) {
      xtermRef.current.dispose();
      xtermRef.current = null;
    }

    if (!termRef.current) return;
    termRef.current.innerHTML = '';

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Fira Code, monospace',
      theme: {
        background: '#0a0a1a',
        foreground: '#e4e4ef',
        cursor: '#818cf8',
        cursorAccent: '#0a0a1a',
        selectionBackground: '#818cf850',
        black: '#1a1a2e',
        red: '#f87171',
        green: '#34d399',
        yellow: '#fbbf24',
        blue: '#818cf8',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#e4e4ef',
        brightBlack: '#4a4a6a',
        brightRed: '#fca5a5',
        brightGreen: '#6ee7b7',
        brightYellow: '#fde68a',
        brightBlue: '#a5b4fc',
        brightMagenta: '#d8b4fe',
        brightCyan: '#67e8f9',
        brightWhite: '#ffffff',
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(termRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Connect via existing WebSocket or create new one
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port
      ? `${window.location.hostname}:${window.location.port}`
      : window.location.hostname;
    const ws = new WebSocket(`${protocol}//${host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'terminal-open',
        containerId,
        serverId: activeServerId,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'terminal-opened') {
          setConnectedTo(msg.name);
          term.writeln(`\x1b[32m--- Verbunden mit ${msg.name} ---\x1b[0m\r\n`);

          // Send initial resize
          ws.send(JSON.stringify({
            type: 'terminal-resize',
            cols: term.cols,
            rows: term.rows,
            serverId: activeServerId,
          }));
        }

        if (msg.type === 'terminal-data') {
          const bytes = Uint8Array.from(atob(msg.data), c => c.charCodeAt(0));
          term.write(bytes);
        }

        if (msg.type === 'terminal-error') {
          term.writeln(`\x1b[31mFehler: ${msg.error}\x1b[0m`);
        }

        if (msg.type === 'terminal-closed') {
          term.writeln('\r\n\x1b[33m--- Verbindung geschlossen ---\x1b[0m');
          setConnectedTo('');
        }
      } catch {}
    };

    ws.onclose = () => {
      term.writeln('\r\n\x1b[33m--- WebSocket getrennt ---\x1b[0m');
      setConnectedTo('');
    };

    // Send terminal input
    term.onData((input) => {
      if (ws.readyState === WebSocket.OPEN) {
        const encoded = btoa(unescape(encodeURIComponent(input)));
        ws.send(JSON.stringify({ type: 'terminal-input', data: encoded }));
      }
    });

    // Handle resize
    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'terminal-resize',
          cols,
          rows,
          serverId: activeServerId,
        }));
      }
    });
  }, [activeServerId]);

  const disconnect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'terminal-close' }));
      wsRef.current.close();
    }
    wsRef.current = null;
    setConnectedTo('');
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => fitAddonRef.current?.fit();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      disconnect();
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
    };
  }, [disconnect]);

  const handleConnect = () => {
    if (!selectedContainer) return;
    connect(selectedContainer);
  };

  return (
    <div className="space-y-4 h-[calc(100vh-10rem)] mb-20 md:mb-0">
      {/* Header */}
      <div className="space-y-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <TermIcon className="w-5 h-5 text-cyan-400" />
            Terminal
          </h1>
          <p className="text-sm text-white/40 mt-0.5">Shell-Zugriff auf Docker Container</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Container selector */}
          <div className="relative min-w-0 w-full sm:w-auto">
            <button
              onClick={() => setShowSelector(!showSelector)}
              className="glass-input flex items-center gap-2 pr-8 w-full sm:min-w-[220px] text-left"
            >
              <Circle className={`w-2 h-2 flex-shrink-0 ${connectedTo ? 'text-emerald-400' : 'text-white/20'}`} />
              <span className="truncate text-sm">
                {connectedTo || 'Container wählen...'}
              </span>
              <ChevronDown className="w-4 h-4 text-white/30 absolute right-2" />
            </button>

            {showSelector && (
              <div className="absolute right-0 top-full mt-1 w-72 glass-card p-1 z-50 max-h-80 overflow-y-auto">
                {runningContainers.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-white/40">Keine laufenden Container</p>
                ) : (
                  runningContainers.map(c => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedContainer(c.id);
                        setShowSelector(false);
                        connect(c.id);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/[0.06] transition-colors"
                    >
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-white/30 font-mono truncate">{c.image}</p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {connectedTo && (
            <button onClick={disconnect} className="btn-glass text-red-400 hover:bg-red-500/10 flex items-center gap-1.5">
              <X className="w-4 h-4" />
              Trennen
            </button>
          )}
        </div>
      </div>


      {/* Terminal */}
      <GlassCard padding={false} className="flex-1 h-full overflow-hidden">
        <div className="relative z-10 h-full">
          {!connectedTo && !xtermRef.current && (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-white/30 gap-4">
              <TermIcon className="w-16 h-16 text-white/10" />
              <p className="text-sm">Wähle einen Container um eine Shell zu öffnen</p>
            </div>
          )}
          <div
            ref={termRef}
            className="h-full min-h-[400px] p-2"
            style={{ display: connectedTo || xtermRef.current ? 'block' : 'none' }}
          />
        </div>
      </GlassCard>
    </div>
  );
}
