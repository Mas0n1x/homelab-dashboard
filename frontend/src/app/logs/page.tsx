'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Search, Pause, Play, Trash2, ChevronDown, Wifi, WifiOff } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import type { Container } from '@/lib/types';

interface LogLine {
  container: string;
  text: string;
  timestamp: number;
}

export default function LogsPage() {
  const { activeServerId } = useServerStore();
  const { data: containers } = useQuery<Container[]>({
    queryKey: ['containers', activeServerId],
    enabled: false,
  });

  const [selectedContainers, setSelectedContainers] = useState<Set<string>>(new Set());
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [filter, setFilter] = useState('');
  const [paused, setPaused] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pausedRef = useRef(false);
  const containersRef = useRef<Container[]>([]);
  const reconnectTimerRef = useRef<NodeJS.Timeout>();
  const selectedRef = useRef<Set<string>>(new Set());

  const runningContainers = (containers || []).filter(c => c.state === 'running');

  useEffect(() => {
    containersRef.current = runningContainers;
  }, [runningContainers]);

  useEffect(() => {
    selectedRef.current = selectedContainers;
  }, [selectedContainers]);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;

    const { accessToken } = useAuthStore.getState();
    if (!accessToken) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port
      ? `${window.location.hostname}:${window.location.port}`
      : window.location.hostname;
    const ws = new WebSocket(`${protocol}//${host}/ws?token=${encodeURIComponent(accessToken)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      // Re-subscribe to any previously selected containers
      Array.from(selectedRef.current).forEach(containerId => {
        ws.send(JSON.stringify({
          type: 'log-stream-start',
          containerId,
          serverId: useServerStore.getState().activeServerId,
          tail: 50,
        }));
      });
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'log-data' && !pausedRef.current) {
          const container = containersRef.current.find(c => c.id === msg.containerId);
          const lines = msg.data.split('\n').filter((l: string) => l.trim());
          const newLines: LogLine[] = lines.map((text: string) => ({
            container: container?.name || msg.containerId.substring(0, 12),
            text: text.replace(/[\x00-\x08]/g, ''),
            timestamp: Date.now(),
          }));
          setLogs(prev => [...prev, ...newLines].slice(-2000));
        }
      } catch {}
    };

    ws.onclose = () => {
      setWsConnected(false);
      reconnectTimerRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Auto-scroll
  useEffect(() => {
    if (!paused && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, paused]);

  const toggleContainer = (containerId: string) => {
    setSelectedContainers(prev => {
      const next = new Set(prev);
      if (next.has(containerId)) {
        next.delete(containerId);
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'log-stream-stop', containerId }));
        }
      } else {
        next.add(containerId);
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'log-stream-start',
            containerId,
            serverId: activeServerId,
            tail: 50,
          }));
        }
      }
      return next;
    });
  };

  const CONTAINER_COLORS = [
    'text-cyan-400', 'text-emerald-400', 'text-amber-400', 'text-purple-400',
    'text-rose-400', 'text-blue-400', 'text-lime-400', 'text-orange-400',
  ];

  const containerColorMap = new Map<string, string>();
  let colorIdx = 0;
  const getContainerColor = (name: string) => {
    if (!containerColorMap.has(name)) {
      containerColorMap.set(name, CONTAINER_COLORS[colorIdx % CONTAINER_COLORS.length]);
      colorIdx++;
    }
    return containerColorMap.get(name)!;
  };

  const filteredLogs = filter
    ? logs.filter(l => l.text.toLowerCase().includes(filter.toLowerCase()) || l.container.toLowerCase().includes(filter.toLowerCase()))
    : logs;

  return (
    <div className="space-y-4 h-[calc(100vh-10rem)] mb-20 md:mb-0">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-400" />
              Log Viewer
            </h1>
            <p className="text-sm text-white/40 mt-0.5 flex items-center gap-2">
              Live-Streaming Container Logs
              {wsConnected ? (
                <span className="flex items-center gap-1 text-emerald-400">
                  <Wifi className="w-3 h-3" /> Verbunden
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-400">
                  <WifiOff className="w-3 h-3" /> Verbinde...
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Container selector */}
          <div className="relative min-w-0 w-full sm:w-auto">
            <button
              onClick={() => setShowSelector(!showSelector)}
              className="glass-input flex items-center gap-2 pr-8 w-full sm:min-w-[200px] text-left"
            >
              <span className="truncate text-sm">
                {selectedContainers.size === 0 ? 'Container wählen...' : `${selectedContainers.size} ausgewählt`}
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
                      onClick={() => toggleContainer(c.id)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/[0.06] transition-colors flex items-center gap-2"
                    >
                      <div className={`w-3 h-3 rounded border ${selectedContainers.has(c.id) ? 'bg-accent border-accent' : 'border-white/20'}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <p className="text-xs text-white/30 font-mono truncate">{c.image}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Filter */}
          <div className="relative w-full sm:w-48">
            <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter..."
              className="glass-input pl-9 w-full"
            />
          </div>

          <button
            onClick={() => setPaused(!paused)}
            className={`btn-glass flex items-center gap-1.5 ${paused ? 'text-amber-400' : ''}`}
          >
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            {paused ? 'Fortsetzen' : 'Pause'}
          </button>

          <button onClick={() => setLogs([])} className="btn-glass text-white/40">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <GlassCard padding={false} className="flex-1 h-full overflow-hidden">
        <div
          ref={logRef}
          className="relative z-10 h-full min-h-[400px] overflow-y-auto p-3 font-mono text-xs leading-5"
        >
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/20 gap-3">
              <FileText className="w-12 h-12" />
              <p className="text-sm">Wähle Container um Logs zu streamen</p>
            </div>
          ) : (
            filteredLogs.map((line, i) => (
              <div key={i} className="flex hover:bg-white/[0.02] px-1 rounded">
                <span className={`${getContainerColor(line.container)} w-32 flex-shrink-0 truncate mr-3 opacity-70`}>
                  {line.container}
                </span>
                <span className="text-white/70 whitespace-pre-wrap break-all">{line.text}</span>
              </div>
            ))
          )}
        </div>
      </GlassCard>
    </div>
  );
}
