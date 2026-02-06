'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, ExternalLink, Bookmark } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { getIcon } from '@/lib/constants';
import * as api from '@/lib/api';

interface BookmarkItem {
  id: string;
  name: string;
  url: string;
  icon: string;
  category: string;
}

export function BookmarksWidget() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', icon: 'link', category: '' });

  const { data: bookmarks = [] } = useQuery<BookmarkItem[]>({
    queryKey: ['bookmarks'],
    queryFn: () => api.getBookmarks() as Promise<BookmarkItem[]>,
    staleTime: 30000,
  });

  const addMutation = useMutation({
    mutationFn: () => api.addBookmark(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      setShowAdd(false);
      setForm({ name: '', url: '', icon: 'link', category: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteBookmark(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookmarks'] }),
  });

  // Group by category
  const categories = new Map<string, BookmarkItem[]>();
  bookmarks.forEach(b => {
    const cat = b.category || 'Allgemein';
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(b);
  });

  const ICONS = ['link', 'globe', 'server', 'database', 'shield', 'monitor', 'terminal', 'cloud', 'home', 'mail', 'lock', 'settings'];

  return (
    <GlassCard delay={0.25} hover>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-amber-400/50" />
            <span className="text-sm font-medium">Quick Links</span>
            <span className="text-[10px] text-white/20">{bookmarks.length}</span>
          </div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="p-1 rounded hover:bg-white/[0.06] text-white/40 hover:text-accent-light transition-colors"
          >
            {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>

        {/* Add Form */}
        {showAdd && (
          <div className="mb-3 pb-3 border-b border-white/[0.04] space-y-2">
            <div className="flex gap-2">
              <input className="glass-input flex-1 text-xs" placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
              <select className="glass-input text-xs w-20" value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}>
                {ICONS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <input className="glass-input w-full text-xs" placeholder="URL (https://...)" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
            <div className="flex gap-2">
              <input className="glass-input flex-1 text-xs" placeholder="Kategorie (optional)" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
              <button
                onClick={() => addMutation.mutate()}
                disabled={!form.name || !form.url}
                className="btn-primary text-xs px-3 py-1.5 disabled:opacity-30"
              >
                +
              </button>
            </div>
          </div>
        )}

        {/* Bookmarks list */}
        {bookmarks.length === 0 ? (
          <div className="py-4 text-center">
            <Bookmark className="w-6 h-6 mx-auto mb-1.5 text-white/10" />
            <p className="text-xs text-white/30">Keine Links gespeichert</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Array.from(categories.entries()).map(([cat, items]) => (
              <div key={cat}>
                {categories.size > 1 && (
                  <span className="text-[9px] text-white/25 uppercase tracking-wider">{cat}</span>
                )}
                <div className="grid grid-cols-2 gap-1 mt-1">
                  {items.map(bm => {
                    const Icon = getIcon(bm.icon);
                    return (
                      <a
                        key={bm.id}
                        href={bm.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors group"
                      >
                        <Icon className="w-3.5 h-3.5 text-white/30 group-hover:text-accent-light transition-colors flex-shrink-0" />
                        <span className="text-xs text-white/60 group-hover:text-white/90 truncate transition-colors">{bm.name}</span>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteMutation.mutate(bm.id); }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all ml-auto flex-shrink-0"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
