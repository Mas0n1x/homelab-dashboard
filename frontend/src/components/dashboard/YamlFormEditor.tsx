/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useRef, useState } from 'react';
import { parseDocument, isMap, isSeq, isScalar } from 'yaml';
import { ChevronDown, ChevronRight, Plus, X, Search } from 'lucide-react';

function humanize(key: string): string {
  return key.replace(/[_-]/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/\b\w/g, c => c.toUpperCase());
}
function cleanComment(raw?: string | null): string {
  if (!raw) return '';
  const lines = raw.split('\n')
    .map(s => s.replace(/^\s*#+/, ''))              // führende Rauten weg
    .map(s => s.replace(/[|#*>]+/g, ' '))            // Banner-Zeichen | # * > -> Leerzeichen
    .map(s => s.replace(/[-=+_~]{2,}/g, ' '))        // ASCII-Linien (---, ===, +++) -> Leerzeichen
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(s => /[a-zA-ZäöüÄÖÜ]{2,}/.test(s))       // nur Zeilen mit echten Wörtern
    .filter(s => !/^[A-Z0-9 .:'-]{4,}$/.test(s));    // reine GROSSBUCHSTABEN-Banner (Sektionstitel) raus
  const text = lines.join(' ').replace(/\s+/g, ' ').replace(/\s+([.,;:])/g, '$1').trim();
  if (text.replace(/[^a-zA-ZäöüÄÖÜ]/g, '').length < 3) return '';
  return text;
}
function shortComment(c: string): string {
  if (c.length <= 130) return c;
  const cut = c.slice(0, 130);
  const lastDot = cut.lastIndexOf('. ');
  return (lastDot > 60 ? cut.slice(0, lastDot + 1) : cut.trimEnd() + '…');
}
function keyOf(pair: any): string { return String(pair.key?.value ?? pair.key ?? ''); }
function commentOf(pair: any): string { return cleanComment(pair.key?.commentBefore || pair.value?.commentBefore || pair.commentBefore); }

function nodeMatches(value: any, key: string, filter: string): boolean {
  if (!filter) return true;
  if (key.toLowerCase().includes(filter) || humanize(key).toLowerCase().includes(filter)) return true;
  if (isMap(value)) return value.items.some((p: any) => nodeMatches(p.value, keyOf(p), filter));
  return false;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative w-10 h-[22px] rounded-full transition-colors flex-shrink-0 cursor-pointer ${checked ? 'bg-emerald-500/60' : 'bg-white/[0.12]'}`}>
      <span className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-transform duration-200 pointer-events-none ${checked ? 'translate-x-[18px]' : 'translate-x-0'}`} />
    </button>
  );
}

function Row({ label, comment, children }: { label: string; comment: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg px-3 py-2 hover:bg-white/[0.02] transition">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-white/75 truncate">{label}</p>
        {comment && <p title={comment} className="text-[11px] text-white/30 leading-snug mt-0.5 line-clamp-2">{shortComment(comment)}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function PrimitiveRow({ label, comment, value, onChange }: { label: string; comment: string; value: any; onChange: (v: any) => void }) {
  return (
    <Row label={label} comment={comment}>
      {typeof value === 'boolean' ? (
        <Toggle checked={value} onChange={onChange} />
      ) : typeof value === 'number' ? (
        <input type="number" value={value} onChange={e => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          className="w-32 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2.5 py-1 text-[13px] text-white/80 outline-none focus:border-orange-400/40 text-right tabular-nums" />
      ) : (
        <input type="text" value={value ?? ''} onChange={e => onChange(e.target.value)}
          className="w-48 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2.5 py-1 text-[13px] text-white/80 outline-none focus:border-orange-400/40 text-right" />
      )}
    </Row>
  );
}

function ArrayRow({ label, comment, value, onChange }: { label: string; comment: string; value: any[]; onChange: (v: any[]) => void }) {
  const [add, setAdd] = useState('');
  const simple = value.every(v => typeof v !== 'object' || v === null);
  if (!simple) return (
    <div className="rounded-lg px-3 py-2">
      <p className="text-[13px] text-white/75">{label}</p>
      {comment && <p title={comment} className="text-[11px] text-white/30 mt-0.5 line-clamp-2">{shortComment(comment)}</p>}
      <p className="text-[11px] text-white/25 mt-1">Komplexe Liste ({value.length}) — im Rohtext bearbeiten.</p>
    </div>
  );
  return (
    <div className="rounded-lg px-3 py-2">
      <p className="text-[13px] text-white/75">{label}</p>
      {comment && <p title={comment} className="text-[11px] text-white/30 leading-snug mt-0.5 mb-1.5 line-clamp-2">{shortComment(comment)}</p>}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map((v, i) => (
          <span key={i} className="flex items-center gap-1 text-[12px] text-white/70 bg-white/[0.05] border border-white/[0.08] rounded-md pl-2 pr-1 py-0.5">
            {String(v)}<button onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-white/30 hover:text-red-400"><X className="w-3 h-3" /></button>
          </span>
        ))}
        {value.length === 0 && <span className="text-[11px] text-white/25">leer</span>}
      </div>
      <div className="flex items-center gap-1.5">
        <input value={add} onChange={e => setAdd(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && add.trim()) { onChange([...value, add.trim()]); setAdd(''); } }}
          placeholder="Eintrag hinzufügen…" className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1 text-[12px] text-white/80 placeholder:text-white/25 outline-none focus:border-orange-400/40" />
        <button onClick={() => { if (add.trim()) { onChange([...value, add.trim()]); setAdd(''); } }} className="p-1.5 rounded-lg text-orange-300/80 hover:bg-orange-500/10"><Plus className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

function Section({ title, comment, depth, filtering, children }: { title: string; comment: string; depth: number; filtering: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const isOpen = open || filtering;
  return (
    <div className={depth > 0 ? 'border-l border-white/[0.06] pl-3 ml-1' : ''}>
      <button onClick={() => setOpen(o => !o)} className="flex items-start gap-1.5 w-full text-left py-1.5 group">
        {isOpen ? <ChevronDown className="w-4 h-4 text-white/30 mt-0.5 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-white/30 mt-0.5 flex-shrink-0" />}
        <span className="min-w-0">
          <span className="block text-xs uppercase tracking-widest text-orange-400/70 font-medium group-hover:text-orange-400 transition">{title}</span>
          {comment && !isOpen && <span title={comment} className="block text-[11px] text-white/25 truncate">{shortComment(comment)}</span>}
        </span>
      </button>
      {isOpen && <div className="pb-1.5">{children}</div>}
    </div>
  );
}

function MapNodes({ node, path, onSet, depth, filter }: { node: any; path: (string | number)[]; onSet: (p: (string | number)[], v: any) => void; depth: number; filter: string }) {
  if (!isMap(node)) return null;
  return (
    <>
      {node.items.map((pair: any, idx: number) => {
        const key = keyOf(pair); if (!key) return null;
        if (filter && !nodeMatches(pair.value, key, filter)) return null;
        const p = [...path, key];
        const comment = commentOf(pair);
        const val = pair.value;
        if (isMap(val)) return <Section key={key + idx} title={humanize(key)} comment={comment} depth={depth} filtering={!!filter}><MapNodes node={val} path={p} onSet={onSet} depth={depth + 1} filter={filter} /></Section>;
        if (isSeq(val)) return <ArrayRow key={key + idx} label={humanize(key)} comment={comment} value={val.toJSON()} onChange={nv => onSet(p, nv)} />;
        const raw = isScalar(val) ? val.value : val;
        return <PrimitiveRow key={key + idx} label={humanize(key)} comment={comment} value={raw} onChange={nv => onSet(p, nv)} />;
      })}
    </>
  );
}

export function YamlFormEditor({ content, onChange }: { content: string; onChange: (v: string) => void }) {
  const docRef = useRef<any>(null);
  const [, bump] = useState(0);
  const [filter, setFilter] = useState('');
  if (!docRef.current) { try { docRef.current = parseDocument(content); } catch { docRef.current = null; } }
  const doc = docRef.current;
  if (!doc || doc.errors?.length || !isMap(doc.contents)) {
    return <div className="p-5 text-sm text-white/40">Diese Datei lässt sich nicht als Formular darstellen — bitte den Rohtext-Modus nutzen.</div>;
  }
  const onSet = (p: (string | number)[], v: any) => { doc.setIn(p, v); onChange(String(doc)); bump(n => n + 1); };
  const f = filter.trim().toLowerCase();
  return (
    <div className="flex flex-col max-h-[54vh]">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.05] bg-white/[0.01]">
        <Search className="w-3.5 h-3.5 text-white/25" />
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Einstellung suchen…"
          className="flex-1 bg-transparent outline-none text-[13px] text-white/80 placeholder:text-white/25" />
        {filter && <button onClick={() => setFilter('')} className="text-white/25 hover:text-white/60"><X className="w-3.5 h-3.5" /></button>}
      </div>
      <div className="overflow-y-auto px-3 py-3 space-y-0.5">
        <MapNodes node={doc.contents} path={[]} onSet={onSet} depth={0} filter={f} />
      </div>
    </div>
  );
}
