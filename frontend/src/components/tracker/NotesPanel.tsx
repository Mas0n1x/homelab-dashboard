'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, FileText } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTrackerNotes, createTrackerNote, updateTrackerNote, deleteTrackerNote } from '@/lib/api';
import { useTrackerStore } from '@/stores/trackerStore';
import type { TrackerNote } from '@/lib/types';

export function NotesPanel() {
  const { selectedNoteId, setSelectedNoteId } = useTrackerStore();
  const queryClient = useQueryClient();
  const debounceRef = useRef<NodeJS.Timeout>();

  const { data: notes = [] } = useQuery<TrackerNote[]>({
    queryKey: ['tracker-notes'],
    queryFn: getTrackerNotes as () => Promise<TrackerNote[]>,
  });

  const createMutation = useMutation({
    mutationFn: createTrackerNote,
    onSuccess: (data: unknown) => {
      queryClient.invalidateQueries({ queryKey: ['tracker-notes'] });
      setSelectedNoteId((data as TrackerNote).id);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updateTrackerNote(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracker-notes'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTrackerNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tracker-notes'] });
      setSelectedNoteId(null);
    },
  });

  const selectedNote = notes.find(n => n.id === selectedNoteId);

  const handleContentChange = (field: 'title' | 'content', value: string) => {
    if (!selectedNoteId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateMutation.mutate({ id: selectedNoteId, data: { [field]: value } });
    }, 500);
  };

  return (
    <div className="flex gap-4 h-[500px]">
      {/* List */}
      <div className="w-64 shrink-0 rounded-2xl bg-white/[0.02] border border-white/[0.06] p-3 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Notizen</span>
          <button
            onClick={() => createMutation.mutate({ title: 'Neue Notiz' })}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <Plus className="w-4 h-4 text-white/50" />
          </button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {notes.map(note => (
            <button
              key={note.id}
              onClick={() => setSelectedNoteId(note.id)}
              className={`w-full text-left p-2.5 rounded-xl transition-all ${
                selectedNoteId === note.id ? 'bg-white/[0.08] border border-white/[0.12]' : 'hover:bg-white/[0.04] border border-transparent'
              }`}
            >
              <p className="text-sm font-medium truncate">{note.title}</p>
              <p className="text-[10px] text-white/30 mt-0.5">
                {new Date(note.updated_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </p>
            </button>
          ))}
          {notes.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-white/20">
              <FileText className="w-8 h-8" />
              <p className="text-xs">Keine Notizen</p>
            </div>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 flex flex-col">
        {selectedNote ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <input
                key={selectedNote.id + '-title'}
                type="text"
                defaultValue={selectedNote.title}
                onChange={(e) => handleContentChange('title', e.target.value)}
                className="bg-transparent text-lg font-semibold outline-none flex-1"
                placeholder="Titel..."
              />
              <button
                onClick={() => deleteMutation.mutate(selectedNote.id)}
                className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <textarea
              key={selectedNote.id + '-content'}
              defaultValue={selectedNote.content}
              onChange={(e) => handleContentChange('content', e.target.value)}
              className="flex-1 bg-transparent text-sm text-white/80 outline-none resize-none leading-relaxed"
              placeholder="Schreibe hier..."
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-white/20 text-sm">
            Wähle oder erstelle eine Notiz
          </div>
        )}
      </div>
    </div>
  );
}
