/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useRef, useState } from 'react';
import { parseDocument } from 'yaml';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';

function humanize(key: string): string {
  return key.replace(/[_-]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, c => c.toUpperCase());
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 cursor-pointer ${checked ? 'bg-emerald-500/60' : 'bg-white/[0.12]'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 pointer-events-none ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function PrimitiveField({ label, value, onChange }: { label: string; value: any; onChange: (v: any) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.02] border border-white/[0.05] px-3.5 py-2.5">
      <p className="text-[13px] text-white/70 truncate flex-1 min-w-0">{label}</p>
      {typeof value === 'boolean' ? (
        <Toggle checked={value} onChange={onChange} />
      ) : typeof value === 'number' ? (
        <input type="number" value={value} onChange={e => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          className="w-28 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-1 text-[13px] text-white/80 outline-none focus:border-orange-400/40 text-right" />
      ) : (
        <input type="text" value={value ?? ''} onChange={e => onChange(e.target.value)}
          className="w-48 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-1 text-[13px] text-white/80 outline-none focus:border-orange-400/40 text-right" />
      )}
    </div>
  );
}

function ArrayField({ label, value, onChange }: { label: string; value: any[]; onChange: (v: any[]) => void }) {
  const [add, setAdd] = useState('');
  const simple = value.every(v => typeof v !== 'object' || v === null);
  if (!simple) {
    return (
      <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] px-3.5 py-2.5">
        <p className="text-[13px] text-white/70">{label}</p>
        <p className="text-[11px] text-white/25 mt-1">Komplexe Liste ({value.length} Einträge) — im Rohtext-Modus bearbeiten.</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] px-3.5 py-2.5">
      <p className="text-[13px] text-white/70 mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map((v, i) => (
          <span key={i} className="flex items-center gap-1 text-[12px] text-white/70 bg-white/[0.05] border border-white/[0.08] rounded-md pl-2 pr-1 py-0.5">
            {String(v)}
            <button onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-white/30 hover:text-red-400"><X className="w-3 h-3" /></button>
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

function Section({ title, depth, children }: { title: string; depth: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(depth < 1);
  return (
    <div className={depth > 0 ? 'border-l border-white/[0.06] pl-3' : ''}>
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 w-full text-left py-1.5 group">
        {open ? <ChevronDown className="w-4 h-4 text-white/30" /> : <ChevronRight className="w-4 h-4 text-white/30" />}
        <span className="text-xs uppercase tracking-widest text-orange-400/60 font-medium group-hover:text-orange-400/90 transition">{title}</span>
      </button>
      {open && <div className="space-y-2 pb-2 pt-1">{children}</div>}
    </div>
  );
}

function Nodes({ data, path, onSet, depth }: { data: any; path: (string | number)[]; onSet: (p: (string | number)[], v: any) => void; depth: number }) {
  if (data === null || typeof data !== 'object') return null;
  return (
    <>
      {Object.entries(data).map(([k, v]) => {
        const p = [...path, k];
        if (Array.isArray(v)) return <ArrayField key={k} label={humanize(k)} value={v} onChange={nv => onSet(p, nv)} />;
        if (v !== null && typeof v === 'object') return <Section key={k} title={humanize(k)} depth={depth}><Nodes data={v} path={p} onSet={onSet} depth={depth + 1} /></Section>;
        return <PrimitiveField key={k} label={humanize(k)} value={v} onChange={nv => onSet(p, nv)} />;
      })}
    </>
  );
}

export function YamlFormEditor({ content, onChange }: { content: string; onChange: (v: string) => void }) {
  const docRef = useRef<any>(null);
  const [, bump] = useState(0);
  if (!docRef.current) {
    try { docRef.current = parseDocument(content); } catch { docRef.current = null; }
  }
  const doc = docRef.current;
  if (!doc || doc.errors?.length) {
    return <div className="p-5 text-sm text-white/40">Diese Datei lässt sich nicht als Formular darstellen — bitte den Rohtext-Modus nutzen.</div>;
  }
  let data: any = {};
  try { data = doc.toJS() || {}; } catch { data = {}; }
  const onSet = (p: (string | number)[], v: any) => { doc.setIn(p, v); onChange(String(doc)); bump(n => n + 1); };

  if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
    return <div className="p-5 text-sm text-white/40">Keine Einstellungen erkannt — bitte den Rohtext-Modus nutzen.</div>;
  }
  return (
    <div className="max-h-[52vh] overflow-y-auto p-5 space-y-2">
      <Nodes data={data} path={[]} onSet={onSet} depth={0} />
    </div>
  );
}
