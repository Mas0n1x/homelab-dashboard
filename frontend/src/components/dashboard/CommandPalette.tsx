/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  Search, ArrowRight, Box, Settings, LogOut, Zap, Command,
  Server, Terminal, FileText, Wrench, LayoutDashboard, Mail, Activity,
  Cpu, HardDrive
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';
import { useFleetStore } from '@/stores/fleetStore';
import * as api from '@/lib/api';
import type { Container } from '@/lib/types';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  category: string;
  icon: React.ReactNode;
  serverName?: string;
  serverColor?: string;
  action: () => void;
  score?: number;
}

function fuzzyMatch(text: string, query: string): number {
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 60;
  // Simple character-by-character fuzzy
  let qi = 0;
  let consecutive = 0;
  let maxConsecutive = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      consecutive++;
      maxConsecutive = Math.max(maxConsecutive, consecutive);
    } else {
      consecutive = 0;
    }
  }
  if (qi === q.length) return 20 + maxConsecutive * 5;
  return 0;
}

const SERVER_COLORS = ['text-emerald-400', 'text-blue-400', 'text-purple-400', 'text-amber-400', 'text-cyan-400'];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { logout } = useAuthStore();
  const { servers } = useServerStore();
  const { serverData } = useFleetStore();

  // Keyboard shortcut to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Build commands list from ALL servers
  const commands = useMemo((): CommandItem[] => {
    const items: CommandItem[] = [];

    // Navigation
    const navItems = [
      { href: '/', label: 'Fleet Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
      { href: '/docker', label: 'Docker (Alle Server)', icon: <Box className="w-4 h-4" /> },
      { href: '/mail', label: 'Mail', icon: <Mail className="w-4 h-4" /> },
      { href: '/tracker', label: 'Tracker', icon: <Activity className="w-4 h-4" /> },
      { href: '/settings', label: 'Einstellungen', icon: <Settings className="w-4 h-4" /> },
    ];

    navItems.forEach(nav => {
      items.push({
        id: `nav-${nav.href}`,
        label: nav.label,
        description: `Navigiere zu ${nav.label}`,
        category: 'Navigation',
        icon: nav.icon,
        action: () => { router.push(nav.href); setOpen(false); },
      });
    });

    // Per-server navigation + containers
    servers.forEach((server, si) => {
      const color = SERVER_COLORS[si % SERVER_COLORS.length];
      const data = serverData[server.id];

      // Server navigation
      items.push({
        id: `srv-${server.id}`,
        label: server.name,
        description: `Server Overview - ${server.host}`,
        category: 'Server',
        icon: <Server className="w-4 h-4" />,
        serverName: server.name,
        serverColor: color,
        action: () => { router.push(`/server/${server.id}`); setOpen(false); },
      });

      // Server sub-pages
      const subPages = [
        { path: '/docker', label: 'Docker', icon: <Box className="w-4 h-4" /> },
        { path: '/terminal', label: 'Terminal', icon: <Terminal className="w-4 h-4" /> },
        { path: '/logs', label: 'Logs', icon: <FileText className="w-4 h-4" /> },
        { path: '/maintenance', label: 'Wartung', icon: <Wrench className="w-4 h-4" /> },
      ];

      subPages.forEach(page => {
        items.push({
          id: `srv-${server.id}-${page.path}`,
          label: `${page.label} - ${server.name}`,
          description: `${page.label} auf ${server.name} oeffnen`,
          category: 'Server',
          icon: page.icon,
          serverName: server.name,
          serverColor: color,
          action: () => { router.push(`/server/${server.id}${page.path}`); setOpen(false); },
        });
      });

      // Containers from fleet store
      const containers = data?.containers || [];
      containers.forEach(c => {
        if (c.state === 'running') {
          items.push({
            id: `ctr-stop-${server.id}-${c.id}`,
            label: `${c.name} stoppen`,
            description: c.image,
            category: 'Container',
            icon: <Box className="w-4 h-4 text-red-400" />,
            serverName: server.name,
            serverColor: color,
            action: async () => { await api.containerAction(c.id, 'stop'); setOpen(false); },
          });
          items.push({
            id: `ctr-restart-${server.id}-${c.id}`,
            label: `${c.name} neustarten`,
            description: c.image,
            category: 'Container',
            icon: <Box className="w-4 h-4 text-amber-400" />,
            serverName: server.name,
            serverColor: color,
            action: async () => { await api.containerAction(c.id, 'restart'); setOpen(false); },
          });
        } else {
          items.push({
            id: `ctr-start-${server.id}-${c.id}`,
            label: `${c.name} starten`,
            description: c.image,
            category: 'Container',
            icon: <Box className="w-4 h-4 text-emerald-400" />,
            serverName: server.name,
            serverColor: color,
            action: async () => { await api.containerAction(c.id, 'start'); setOpen(false); },
          });
        }
      });

      // Also check React Query cache for containers (fallback)
      if (containers.length === 0) {
        const cached = queryClient.getQueryData<Container[]>(['containers', server.id]);
        cached?.forEach(c => {
          const actionLabel = c.state === 'running' ? 'stoppen' : 'starten';
          const actionColor = c.state === 'running' ? 'text-red-400' : 'text-emerald-400';
          items.push({
            id: `ctr-${server.id}-${c.id}`,
            label: `${c.name} ${actionLabel}`,
            description: c.image,
            category: 'Container',
            icon: <Box className={`w-4 h-4 ${actionColor}`} />,
            serverName: server.name,
            serverColor: color,
            action: async () => {
              const action = c.state === 'running' ? 'stop' : 'start';
              await api.containerAction(c.id, action);
              setOpen(false);
            },
          });
        });
      }
    });

    // Quick actions
    items.push({
      id: 'action-speedtest',
      label: 'Speedtest starten',
      category: 'Aktionen',
      icon: <Zap className="w-4 h-4 text-cyan-400" />,
      action: async () => { await api.runSpeedtest(); setOpen(false); },
    });
    items.push({
      id: 'action-logout',
      label: 'Abmelden',
      category: 'Aktionen',
      icon: <LogOut className="w-4 h-4 text-red-400" />,
      action: () => { logout(); router.push('/login'); setOpen(false); },
    });

    return items;
  }, [queryClient, router, logout, servers, serverData]);

  // Filter and score by query with fuzzy matching
  const filtered = useMemo(() => {
    if (!query) return commands.slice(0, 20); // Show top 20 when no query

    // Check for server prefix filter (e.g. "pi5:" filters to that server)
    let serverFilter: string | null = null;
    let searchQuery = query;
    const colonIdx = query.indexOf(':');
    if (colonIdx > 0) {
      const prefix = query.substring(0, colonIdx).toLowerCase();
      const matchingServer = servers.find(s => s.name.toLowerCase().includes(prefix));
      if (matchingServer) {
        serverFilter = matchingServer.name;
        searchQuery = query.substring(colonIdx + 1).trim();
      }
    }

    return commands
      .map(cmd => {
        if (serverFilter && cmd.serverName !== serverFilter) return null;
        if (!searchQuery) return { ...cmd, score: 50 };

        const labelScore = fuzzyMatch(cmd.label, searchQuery);
        const descScore = cmd.description ? fuzzyMatch(cmd.description, searchQuery) * 0.5 : 0;
        const catScore = fuzzyMatch(cmd.category, searchQuery) * 0.3;
        const score = Math.max(labelScore, descScore, catScore);

        if (score === 0) return null;
        return { ...cmd, score };
      })
      .filter(Boolean)
      .sort((a, b) => (b!.score || 0) - (a!.score || 0))
      .slice(0, 30) as CommandItem[];
  }, [commands, query, servers]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    filtered.forEach(item => {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    });
    return map;
  }, [filtered]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault();
      filtered[selectedIndex].action();
    }
  }, [filtered, selectedIndex]);

  if (!open) return null;

  let flatIndex = 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-start justify-center pt-[12vh]"
        onClick={() => setOpen(false)}
      >
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.15 }}
          className="relative z-10 w-full max-w-xl mx-4 glass-card overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
            <Search className="w-4.5 h-4.5 text-accent-light/50 flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Suche Server, Container, Aktionen... (server: fuer Filter)"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 outline-none"
            />
            <kbd className="text-[10px] text-white/15 border border-white/[0.08] rounded px-1.5 py-0.5 font-mono">ESC</kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[55vh] overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-white/20 text-center py-8">Keine Ergebnisse</p>
            ) : (
              Array.from(grouped.entries()).map(([category, items]) => (
                <div key={category} className="mb-2 last:mb-0">
                  <p className="text-[10px] text-white/20 uppercase tracking-widest px-3 py-1.5 font-medium">{category}</p>
                  {items.map(item => {
                    const idx = flatIndex++;
                    return (
                      <button
                        key={item.id}
                        data-index={idx}
                        onClick={item.action}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all duration-150 ${
                          idx === selectedIndex ? 'bg-white/[0.08] text-white' : 'text-white/50 hover:bg-white/[0.04] hover:text-white/70'
                        }`}
                      >
                        <span className="flex-shrink-0 text-white/30">{item.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{item.label}</p>
                          {item.description && (
                            <p className="text-[11px] text-white/20 truncate">{item.description}</p>
                          )}
                        </div>
                        {item.serverName && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] ${item.serverColor || 'text-white/30'} flex-shrink-0`}>
                            {item.serverName}
                          </span>
                        )}
                        {idx === selectedIndex && <ArrowRight className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-white/[0.04] text-[10px] text-white/15">
            <span className="flex items-center gap-1"><Command className="w-3 h-3" />K oeffnen</span>
            <span>↑↓ navigieren</span>
            <span>↵ ausfuehren</span>
            <span className="ml-auto">server: fuer Filter</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
