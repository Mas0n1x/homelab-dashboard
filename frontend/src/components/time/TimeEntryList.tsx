/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Plus, Trash2, Pencil, Check, X, Receipt, Ban } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { formatHours } from '@/hooks/useTimer';
import * as api from '@/lib/api';
import type { TimeEntry } from '@/lib/types';

function tagLabel(iso: string) {
  const d = new Date(iso);
  const heute = new Date();
  const gestern = new Date(Date.now() - 86400000);
  if (d.toDateString() === heute.toDateString()) return 'Heute';
  if (d.toDateString() === gestern.toDateString()) return 'Gestern';
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}

const uhrzeit = (iso: string) =>
  new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

/** Für datetime-local: lokale Zeit ohne Zeitzonen-Anhang. */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export function TimeEntryList({ von, bis }: { von: string; bis: string }) {
  const queryClient = useQueryClient();
  const [nachtragOffen, setNachtragOffen] = useState(false);
  const [bearbeite, setBearbeite] = useState<string | null>(null);

  const { data: entries = [], isLoading } = useQuery<TimeEntry[]>({
    queryKey: ['time-entries', von, bis],
    queryFn: () => api.getTimeEntries({ from: von, to: bis }),
    staleTime: 15000,
  });

  const { data: taskData } = useQuery({ queryKey: ['tasks'], queryFn: api.getTasks, staleTime: 30000 });
  const projekte = taskData?.projects ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['time-entries'] });
    queryClient.invalidateQueries({ queryKey: ['time-summary'] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  const loeschen = useMutation({ mutationFn: api.deleteTimeEntry, onSuccess: invalidate });
  const aendern = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.updateTimeEntry(id, data),
    onSuccess: () => { invalidate(); setBearbeite(null); },
  });
  const anlegen = useMutation({
    mutationFn: api.addTimeEntry,
    onSuccess: () => { invalidate(); setNachtragOffen(false); },
  });

  // Nach Tagen gruppieren — so liest sich der Stundenzettel wie ein Kalender.
  const nachTag = useMemo(() => {
    const map = new Map<string, TimeEntry[]>();
    for (const e of entries) {
      const key = e.startedAt.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-white/35">
          {entries.length} {entries.length === 1 ? 'Eintrag' : 'Einträge'} ·{' '}
          {formatHours(entries.reduce((s, e) => s + e.seconds, 0))}
        </p>
        <button
          onClick={() => setNachtragOffen(v => !v)}
          className="btn-glass flex items-center gap-1.5 px-3 py-2 text-[13px]"
        >
          <Plus className="w-3.5 h-3.5" />
          Zeit nachtragen
        </button>
      </div>

      {nachtragOffen && (
        <NachtragFormular
          projekte={projekte}
          onAbbrechen={() => setNachtragOffen(false)}
          onSpeichern={(daten) => anlegen.mutate(daten)}
          laeuft={anlegen.isPending}
        />
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-white/[0.02] animate-pulse" />)}
        </div>
      ) : entries.length === 0 ? (
        <GlassCard>
          <p className="text-sm text-white/30 py-8 text-center">
            Keine Zeiten in diesem Zeitraum. Starte die Uhr auf einer Aufgabe oder trag Zeit nach.
          </p>
        </GlassCard>
      ) : (
        nachTag.map(([tag, liste]) => (
          <div key={tag}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <h3 className="text-[13px] font-semibold text-white/70">{tagLabel(tag)}</h3>
              <span className="text-[11px] text-white/25 tabular-nums">
                {formatHours(liste.reduce((s, e) => s + e.seconds, 0))}
              </span>
            </div>
            <GlassCard>
              <div className="divide-y divide-white/[0.05]">
                {liste.map(e => (
                  bearbeite === e.id ? (
                    <BearbeitenZeile
                      key={e.id}
                      entry={e}
                      projekte={projekte}
                      onAbbrechen={() => setBearbeite(null)}
                      onSpeichern={(data) => aendern.mutate({ id: e.id, data })}
                    />
                  ) : (
                    <div key={e.id} className="py-2.5 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] truncate">
                          {e.description || e.taskTitle || 'Ohne Bezeichnung'}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-white/30 tabular-nums">
                            {uhrzeit(e.startedAt)}{e.endedAt ? ` – ${uhrzeit(e.endedAt)}` : ' – läuft'}
                          </span>
                          {e.project && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.07] text-white/45 truncate max-w-[8rem]">
                              {e.project}
                            </span>
                          )}
                          {e.source === 'manual' && (
                            <span className="text-[10px] text-white/25">nachgetragen</span>
                          )}
                          {!e.billable && (
                            <span className="flex items-center gap-1 text-[10px] text-white/30">
                              <Ban className="w-2.5 h-2.5" /> nicht abrechenbar
                            </span>
                          )}
                          {e.invoicedAt && (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-300/70">
                              <Receipt className="w-2.5 h-2.5" /> abgerechnet
                            </span>
                          )}
                        </div>
                      </div>

                      <span className={clsx(
                        'text-[13px] tabular-nums flex-shrink-0',
                        e.running ? 'text-accent-light' : 'text-white/70',
                      )}>
                        {formatHours(e.seconds)}
                      </span>

                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        <button
                          onClick={() => aendern.mutate({ id: e.id, data: { billable: !e.billable } })}
                          title={e.billable ? 'Als nicht abrechenbar markieren' : 'Als abrechenbar markieren'}
                          className={clsx(
                            'p-1.5 rounded-lg transition-colors',
                            e.billable ? 'text-emerald-400/60 hover:bg-emerald-500/10' : 'text-white/20 hover:text-white/50',
                          )}
                        >
                          <Receipt className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setBearbeite(e.id)}
                          title="Bearbeiten"
                          className="p-1.5 rounded-lg text-white/25 hover:text-accent-light hover:bg-accent/10 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { if (confirm('Diesen Zeiteintrag löschen?')) loeschen.mutate(e.id); }}
                          title="Löschen"
                          className="p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                ))}
              </div>
            </GlassCard>
          </div>
        ))
      )}
    </div>
  );
}

function NachtragFormular({ projekte, onAbbrechen, onSpeichern, laeuft }: {
  projekte: string[];
  onAbbrechen: () => void;
  onSpeichern: (daten: { project: string; description: string; startedAt: string; minutes: number }) => void;
  laeuft: boolean;
}) {
  const [projekt, setProjekt] = useState('');
  const [text, setText] = useState('');
  const [start, setStart] = useState(() => toLocalInput(new Date(Date.now() - 3600000).toISOString()));
  const [minuten, setMinuten] = useState(60);

  return (
    <GlassCard>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <label className="block lg:col-span-2">
          <span className="block text-[10px] uppercase tracking-widest text-white/25 mb-1">Beschreibung</span>
          <input className="glass-input py-2 w-full" value={text} onChange={e => setText(e.target.value)} placeholder="Woran gearbeitet?" />
        </label>
        <label className="block">
          <span className="block text-[10px] uppercase tracking-widest text-white/25 mb-1">Projekt</span>
          <input
            className="glass-input py-2 w-full"
            value={projekt}
            onChange={e => setProjekt(e.target.value)}
            list="projekt-vorschlaege"
            placeholder="Projekt"
          />
          <datalist id="projekt-vorschlaege">
            {projekte.map(p => <option key={p} value={p} />)}
          </datalist>
        </label>
        <label className="block">
          <span className="block text-[10px] uppercase tracking-widest text-white/25 mb-1">Beginn</span>
          <input type="datetime-local" className="glass-input py-2 w-full" value={start} onChange={e => setStart(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-[10px] uppercase tracking-widest text-white/25 mb-1">Dauer (Minuten)</span>
          <input
            type="number"
            min={1}
            className="glass-input py-2 w-full"
            value={minuten}
            onChange={e => setMinuten(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onSpeichern({
            project: projekt,
            description: text,
            // Der Eingabewert ist lokale Zeit — als solche einlesen und dann
            // in ISO umrechnen, sonst wandert der Eintrag um zwei Stunden.
            startedAt: new Date(start).toISOString(),
            minutes: minuten,
          })}
          disabled={laeuft || minuten <= 0 || !start}
          className="btn-primary flex items-center gap-1.5 px-4 disabled:opacity-30"
        >
          <Check className="w-4 h-4" /> Speichern
        </button>
        <button onClick={onAbbrechen} className="btn-glass px-4 flex items-center gap-1.5">
          <X className="w-4 h-4" /> Abbrechen
        </button>
      </div>
    </GlassCard>
  );
}

function BearbeitenZeile({ entry, projekte, onAbbrechen, onSpeichern }: {
  entry: TimeEntry;
  projekte: string[];
  onAbbrechen: () => void;
  onSpeichern: (data: Record<string, unknown>) => void;
}) {
  const [text, setText] = useState(entry.description);
  const [projekt, setProjekt] = useState(entry.project);
  const [start, setStart] = useState(toLocalInput(entry.startedAt));
  const [minuten, setMinuten] = useState(Math.round(entry.seconds / 60));

  return (
    <div className="py-3 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <input className="glass-input py-2 sm:col-span-2" value={text} onChange={e => setText(e.target.value)} placeholder="Beschreibung" />
        <input className="glass-input py-2" value={projekt} onChange={e => setProjekt(e.target.value)} list="projekt-vorschlaege" placeholder="Projekt" />
        <datalist id="projekt-vorschlaege">{projekte.map(p => <option key={p} value={p} />)}</datalist>
        <input type="datetime-local" className="glass-input py-2" value={start} onChange={e => setStart(e.target.value)} />
        <input type="number" min={1} className="glass-input py-2" value={minuten} onChange={e => setMinuten(Number(e.target.value))} />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSpeichern({
            description: text,
            project: projekt,
            startedAt: new Date(start).toISOString(),
            minutes: minuten,
          })}
          className="btn-primary px-3 py-1.5 text-[13px] flex items-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5" /> Übernehmen
        </button>
        <button onClick={onAbbrechen} className="btn-glass px-3 py-1.5 text-[13px] flex items-center gap-1.5">
          <X className="w-3.5 h-3.5" /> Abbrechen
        </button>
      </div>
    </div>
  );
}
