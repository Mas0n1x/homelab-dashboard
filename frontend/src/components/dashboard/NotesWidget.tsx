'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Pin, StickyNote, Check } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import * as api from '@/lib/api';

interface Note {
  id: string;
  title: string;
  content: string;
  pinned: number;
  color: string;
  updated_at: string;
}

const NOTE_COLORS: Record<string, string> = {
  default: 'border-white/[0.06]',
  indigo: 'border-indigo-500/30',
  emerald: 'border-emerald-500/30',
  amber: 'border-amber-500/30',
  red: 'border-red-500/30',
  cyan: 'border-cyan-500/30',
};

const NOTE_ACCENT: Record<string, string> = {
  default: 'bg-white/[0.02]',
  indigo: 'bg-indigo-500/[0.04]',
  emerald: 'bg-emerald-500/[0.04]',
  amber: 'bg-amber-500/[0.04]',
  red: 'bg-red-500/[0.04]',
  cyan: 'bg-cyan-500/[0.04]',
};

export function NotesWidget() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [form, setForm] = useState({ title: '', content: '', color: 'default' });

  const { data: notes = [] } = useQuery<Note[]>({
    queryKey: ['notes'],
    queryFn: () => api.getNotes() as Promise<Note[]>,
    staleTime: 10000,
  });

  const addMutation = useMutation({
    mutationFn: () => api.addNote(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      setShowAdd(false);
      setForm({ title: '', content: '', color: 'default' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.updateNote(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteNote(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notes'] }),
  });

  return (
    <GlassCard delay={0.35} hover>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-amber-400/50" />
            <span className="text-sm font-medium">Notizen</span>
            <span className="text-[10px] text-white/20">{notes.length}</span>
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
            <input className="glass-input w-full text-xs" placeholder="Titel" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
            <textarea className="glass-input w-full text-xs min-h-[60px] resize-none" placeholder="Inhalt..." value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {Object.keys(NOTE_COLORS).map(c => (
                  <button
                    key={c}
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`w-4 h-4 rounded-full border-2 transition-all ${NOTE_COLORS[c]} ${NOTE_ACCENT[c]} ${form.color === c ? 'ring-1 ring-white/30 scale-110' : 'opacity-50'}`}
                  />
                ))}
              </div>
              <button onClick={() => addMutation.mutate()} disabled={!form.title} className="btn-primary text-xs px-3 py-1 disabled:opacity-30">
                Speichern
              </button>
            </div>
          </div>
        )}

        {/* Notes list */}
        {notes.length === 0 ? (
          <div className="py-4 text-center">
            <StickyNote className="w-6 h-6 mx-auto mb-1.5 text-white/10" />
            <p className="text-xs text-white/30">Keine Notizen</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {notes.map(note => (
              <div
                key={note.id}
                className={`p-2.5 rounded-xl border transition-all ${NOTE_COLORS[note.color] || NOTE_COLORS.default} ${NOTE_ACCENT[note.color] || NOTE_ACCENT.default}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {note.pinned ? <Pin className="w-2.5 h-2.5 text-amber-400 flex-shrink-0" /> : null}
                      <span className="text-xs font-medium truncate">{note.title}</span>
                    </div>
                    {editingId === note.id ? (
                      <div className="mt-1.5">
                        <textarea
                          className="glass-input w-full text-[11px] min-h-[40px] resize-none"
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          autoFocus
                        />
                        <div className="flex gap-1 mt-1">
                          <button onClick={() => updateMutation.mutate({ id: note.id, data: { content: editContent } })} className="p-1 rounded hover:bg-accent/20 text-accent-light">
                            <Check className="w-3 h-3" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1 rounded hover:bg-white/[0.06] text-white/30">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      note.content && (
                        <p
                          className="text-[11px] text-white/40 mt-1 line-clamp-3 cursor-pointer hover:text-white/60 transition-colors whitespace-pre-wrap"
                          onClick={() => { setEditingId(note.id); setEditContent(note.content); }}
                        >
                          {note.content}
                        </p>
                      )
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => updateMutation.mutate({ id: note.id, data: { pinned: !note.pinned } })}
                      className={`p-1 rounded transition-all ${note.pinned ? 'text-amber-400 hover:bg-amber-500/10' : 'text-white/20 hover:text-white/40 hover:bg-white/[0.04]'}`}
                    >
                      <Pin className="w-3 h-3" />
                    </button>
                    <button onClick={() => deleteMutation.mutate(note.id)} className="p-1 rounded hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-all">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
