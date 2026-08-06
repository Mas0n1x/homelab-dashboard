/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 *
 * Auswahllisten für Discord-Kanäle und -Rollen. Vorher standen in der
 * Bot-Steuerung überall nackte 18-stellige IDs, die man aus Discord kopieren
 * musste — hier kommen Namen aus dem laufenden Bot. Ist der Bot offline oder
 * die ID unbekannt, bleibt die manuelle Eingabe erhalten (nichts wird still
 * überschrieben).
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Hash, Folder, Volume2, MessagesSquare, AtSign, ChevronDown, Search,
  Keyboard, X, AlertTriangle, RefreshCw, Loader2,
} from 'lucide-react';
import { botCall } from '@/lib/api';

export type GuildChannel = { id: string; name: string; type?: string; parentId?: string | null };
export type GuildRole = { id: string; name: string; color?: string | null; managed?: boolean };

export type Directory = {
  channels: GuildChannel[];
  roles: GuildRole[];
  loading: boolean;
  error: string | null;
  reload: () => void;
};

/** Holt Kanäle + Rollen einmal pro Seite; `enabled` = Bot ist verbunden. */
export function useGuildDirectory(bot: string, enabled: boolean): Directory {
  const [channels, setChannels] = useState<GuildChannel[]>([]);
  const [roles, setRoles] = useState<GuildRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, r] = await Promise.all([
      botCall<GuildChannel[] | { error?: string }>(bot, '/channels'),
      botCall<GuildRole[] | { error?: string }>(bot, '/roles'),
    ]);
    setLoading(false);
    if (c.ok && Array.isArray(c.data)) setChannels(c.data); else setChannels([]);
    if (r.ok && Array.isArray(r.data)) setRoles(r.data); else setRoles([]);
    const err = !c.ok ? (c.data as any)?.error : !r.ok ? (r.data as any)?.error : null;
    setError(err || null);
  }, [bot]);

  useEffect(() => {
    if (!enabled) { setChannels([]); setRoles([]); setError(null); return; }
    load();
  }, [enabled, load]);

  return { channels, roles, loading, error, reload: load };
}

/* ─────────────────────────── Auswahl-Baustein ─────────────────────────── */

type Option = {
  id: string;
  name: string;
  group?: string | null;
  color?: string | null;
  icon: 'hash' | 'folder' | 'volume' | 'forum' | 'at';
};

const ICONS = { hash: Hash, folder: Folder, volume: Volume2, forum: MessagesSquare, at: AtSign };

function OptionLabel({ opt }: { opt: Option }) {
  const Icon = ICONS[opt.icon];
  return (
    <span className="flex items-center gap-1.5 min-w-0">
      {opt.color ? (
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: opt.color }} />
      ) : (
        <Icon className="w-3.5 h-3.5 text-white/35 flex-shrink-0" />
      )}
      <span className="truncate">{opt.name}</span>
    </span>
  );
}

function IdPicker({ label, value, onChange, options, unavailable, unavailableHint, emptyLabel }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  unavailable?: boolean;
  unavailableHint?: string;
  emptyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Manuelle Eingabe: erzwungen, wenn keine Liste da ist, sonst per Knopf.
  const [manual, setManual] = useState(false);
  const byManual = manual || unavailable;

  const selected = options.find(o => o.id === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.name.toLowerCase().includes(q) || o.id.includes(q));
  }, [options, query]);

  // Gruppen-Überschriften (Kategorien) nur einmal ausgeben.
  const rows: Array<{ head: string } | { opt: Option }> = [];
  let lastGroup: string | null | undefined;
  filtered.forEach(o => {
    if (o.group && o.group !== lastGroup) rows.push({ head: o.group });
    if (o.group) lastGroup = o.group;
    rows.push({ opt: o });
  });

  return (
    <div className="block min-w-0">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[12px] text-white/45 truncate">{label}</span>
        {!unavailable && (
          <button
            type="button"
            onClick={() => setManual(m => !m)}
            title={byManual ? 'Aus Liste wählen' : 'ID manuell eintragen'}
            className={`p-1 rounded-lg transition-colors ${byManual ? 'text-accent-light/80' : 'text-white/25 hover:text-white/60'}`}
          >
            <Keyboard className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {byManual ? (
        <>
          <input
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="ID einfügen"
            className="w-full px-3 py-2 rounded-xl bg-black/25 border border-white/[0.08] font-mono text-[12px] text-white/85 outline-none focus:border-accent/40 transition-colors"
          />
          {unavailable && unavailableHint && (
            <span className="flex items-center gap-1 text-[11px] text-amber-300/60 mt-1">
              <AlertTriangle className="w-3 h-3" /> {unavailableHint}
            </span>
          )}
        </>
      ) : (
        <div className="relative">
          <button
            type="button"
            onClick={() => { setOpen(o => !o); setQuery(''); }}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-black/25 border border-white/[0.08] text-sm text-left outline-none hover:border-white/[0.14] focus:border-accent/40 transition-colors"
          >
            {selected ? (
              <span className="text-white/85 min-w-0"><OptionLabel opt={selected} /></span>
            ) : value ? (
              <span className="flex items-center gap-1.5 min-w-0 text-amber-300/70">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="font-mono text-[12px] truncate">{value}</span>
              </span>
            ) : (
              <span className="text-white/30">{emptyLabel}</span>
            )}
            <ChevronDown className="w-4 h-4 text-white/30 flex-shrink-0" />
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl bg-[#0a0a18] border border-white/[0.12] shadow-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.07]">
                  <Search className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                  <input
                    autoFocus
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Suchen…"
                    className="flex-1 bg-transparent text-[13px] text-white/85 outline-none placeholder:text-white/25"
                  />
                  {value && (
                    <button
                      type="button"
                      onClick={() => { onChange(''); setOpen(false); }}
                      title="Auswahl entfernen"
                      className="p-1 rounded-lg text-white/30 hover:text-red-300 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto py-1 scrollbar-hide">
                  {rows.length === 0 && (
                    <div className="px-3 py-4 text-center text-[12px] text-white/30">Kein Treffer.</div>
                  )}
                  {rows.map((row, i) =>
                    'head' in row ? (
                      <div key={`h${i}`} className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-white/25 truncate">
                        {row.head}
                      </div>
                    ) : (
                      <button
                        key={row.opt.id}
                        type="button"
                        onClick={() => { onChange(row.opt.id); setOpen(false); }}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-[13px] text-left transition-colors ${
                          row.opt.id === value ? 'bg-accent/15 text-accent-light' : 'text-white/70 hover:bg-white/[0.06] hover:text-white/95'
                        }`}
                      >
                        <OptionLabel opt={row.opt} />
                      </button>
                    ),
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Kanäle & Rollen ─────────────────────────── */

const CHANNEL_ICON: Record<string, Option['icon']> = {
  text: 'hash', announcement: 'hash', voice: 'volume', forum: 'forum', category: 'folder',
};

export function ChannelPicker({ label, value, onChange, dir, kind = 'text' }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  dir: Directory;
  kind?: 'text' | 'category' | 'voice' | 'any';
}) {
  const categories = useMemo(
    () => new Map(dir.channels.filter(c => c.type === 'category').map(c => [c.id, c.name])),
    [dir.channels],
  );

  const options: Option[] = useMemo(() => dir.channels
    // Ältere Runtime-Antworten kennen kein `type` — die sind immer Textkanäle.
    .filter(c => {
      const t = c.type || 'text';
      if (kind === 'any') return true;
      if (kind === 'text') return t === 'text' || t === 'announcement' || t === 'forum';
      return t === kind;
    })
    .map(c => ({
      id: c.id,
      name: c.name,
      group: c.type === 'category' ? null : categories.get(c.parentId || '') || null,
      icon: CHANNEL_ICON[c.type || 'text'] || 'hash',
    })), [dir.channels, kind, categories]);

  return (
    <IdPicker
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      unavailable={options.length === 0}
      unavailableHint={dir.loading ? 'Lade Kanäle…' : 'Bot offline — Kanal-ID eintragen'}
      emptyLabel={kind === 'category' ? 'Kategorie wählen…' : 'Kanal wählen…'}
    />
  );
}

export function RolePicker({ label, value, onChange, dir }: {
  label: string; value: string; onChange: (v: string) => void; dir: Directory;
}) {
  const options: Option[] = useMemo(() => dir.roles.map(r => ({
    id: r.id,
    name: r.name,
    color: r.color && r.color !== '#000000' ? r.color : null,
    icon: 'at' as const,
  })), [dir.roles]);

  return (
    <IdPicker
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      unavailable={options.length === 0}
      unavailableHint={dir.loading ? 'Lade Rollen…' : 'Bot offline — Rollen-ID eintragen'}
      emptyLabel="Rolle wählen…"
    />
  );
}

/** Kleine Statuszeile mit Neu-laden-Knopf für die Auswahllisten. */
export function DirectoryStatus({ dir }: { dir: Directory }) {
  const empty = dir.channels.length === 0 && dir.roles.length === 0;
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <span className="text-[12px] text-white/35 flex items-center gap-1.5">
        {dir.loading ? (
          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Lade Kanäle und Rollen…</>
        ) : empty ? (
          <><AlertTriangle className="w-3.5 h-3.5 text-amber-300/60" /> Keine Listen verfügbar{dir.error ? ` (${dir.error})` : ' — Bot verbinden'}. IDs lassen sich weiterhin eintragen.</>
        ) : (
          <>{dir.channels.length} Kanäle · {dir.roles.length} Rollen aus dem Server geladen</>
        )}
      </span>
      <button
        type="button"
        onClick={dir.reload}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[12px] bg-white/[0.04] border border-white/[0.08] text-white/45 hover:text-white/80 hover:bg-white/[0.08] transition-colors"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${dir.loading ? 'animate-spin' : ''}`} /> Neu laden
      </button>
    </div>
  );
}
