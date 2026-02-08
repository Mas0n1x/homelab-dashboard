'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Search, ArrowRight, Globe, Box, Settings, LogOut, Zap, Command } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { NAV_ITEMS, getIcon } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';
import * as api from '@/lib/api';
import type { Service, Container } from '@/lib/types';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  category: string;
  icon: React.ReactNode;
  action: () => void;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { logout } = useAuthStore();

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

  // Build commands list
  const commands = useMemo((): CommandItem[] => {
    const items: CommandItem[] = [];

    // Navigation pages
    NAV_ITEMS.forEach(nav => {
      const Icon = getIcon(nav.icon);
      items.push({
        id: `nav-${nav.href}`,
        label: nav.label,
        description: `Zu ${nav.label} navigieren`,
        category: 'Seiten',
        icon: <Icon className="w-4 h-4" />,
        action: () => { router.push(nav.href); setOpen(false); },
      });
    });

    // Services from React Query cache
    const servicesData = queryClient.getQueryData<{ services: Service[] }>(['services', 'local']);
    if (servicesData?.services) {
      servicesData.services.forEach(s => {
        if (s.url) {
          const Icon = getIcon(s.icon);
          items.push({
            id: `svc-${s.id}`,
            label: s.name,
            description: s.url,
            category: 'Services',
            icon: <Icon className="w-4 h-4" />,
            action: () => { window.open(s.url!, '_blank'); setOpen(false); },
          });
        }
      });
    }

    // Containers from React Query cache
    const containers = queryClient.getQueryData<Container[]>(['containers', 'local']);
    if (containers) {
      containers.forEach(c => {
        if (c.state === 'running') {
          items.push({
            id: `ctr-stop-${c.id}`,
            label: `${c.name} stoppen`,
            description: c.image,
            category: 'Container',
            icon: <Box className="w-4 h-4 text-red-400" />,
            action: async () => { await api.containerAction(c.id, 'stop'); setOpen(false); },
          });
          items.push({
            id: `ctr-restart-${c.id}`,
            label: `${c.name} neustarten`,
            description: c.image,
            category: 'Container',
            icon: <Box className="w-4 h-4 text-amber-400" />,
            action: async () => { await api.containerAction(c.id, 'restart'); setOpen(false); },
          });
        } else {
          items.push({
            id: `ctr-start-${c.id}`,
            label: `${c.name} starten`,
            description: c.image,
            category: 'Container',
            icon: <Box className="w-4 h-4 text-emerald-400" />,
            action: async () => { await api.containerAction(c.id, 'start'); setOpen(false); },
          });
        }
      });
    }

    // Actions
    items.push({
      id: 'action-speedtest',
      label: 'Speedtest starten',
      category: 'Aktionen',
      icon: <Zap className="w-4 h-4 text-cyan-400" />,
      action: async () => { await api.runSpeedtest(); setOpen(false); },
    });
    items.push({
      id: 'action-settings',
      label: 'Einstellungen',
      category: 'Aktionen',
      icon: <Settings className="w-4 h-4" />,
      action: () => { router.push('/settings'); setOpen(false); },
    });
    items.push({
      id: 'action-logout',
      label: 'Abmelden',
      category: 'Aktionen',
      icon: <LogOut className="w-4 h-4 text-red-400" />,
      action: () => { logout(); router.push('/login'); setOpen(false); },
    });

    return items;
  }, [queryClient, router, logout]);

  // Filter by query
  const filtered = useMemo(() => {
    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  }, [commands, query]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    filtered.forEach(item => {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    });
    return map;
  }, [filtered]);

  // Reset selection on filter change
  useEffect(() => { setSelectedIndex(0); }, [query]);

  // Scroll selected item into view
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
        className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
        onClick={() => setOpen(false)}
      >
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.15 }}
          className="relative z-10 w-full max-w-lg mx-4 glass-card overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
            <Search className="w-4 h-4 text-white/30 flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Suche nach Seiten, Services, Container..."
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
            />
            <kbd className="text-[10px] text-white/20 border border-white/10 rounded px-1.5 py-0.5">ESC</kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-white/30 text-center py-6">Keine Ergebnisse</p>
            ) : (
              Array.from(grouped.entries()).map(([category, items]) => (
                <div key={category} className="mb-2 last:mb-0">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider px-3 py-1.5">{category}</p>
                  {items.map(item => {
                    const idx = flatIndex++;
                    return (
                      <button
                        key={item.id}
                        data-index={idx}
                        onClick={item.action}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                          idx === selectedIndex ? 'bg-white/[0.08] text-white' : 'text-white/60 hover:bg-white/[0.04]'
                        }`}
                      >
                        <span className="flex-shrink-0 text-white/40">{item.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{item.label}</p>
                          {item.description && (
                            <p className="text-xs text-white/25 truncate">{item.description}</p>
                          )}
                        </div>
                        {idx === selectedIndex && <ArrowRight className="w-3 h-3 text-white/30 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-white/[0.06] text-[10px] text-white/20">
            <span className="flex items-center gap-1"><Command className="w-3 h-3" />K zum Öffnen</span>
            <span>↑↓ Navigieren</span>
            <span>↵ Ausführen</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
