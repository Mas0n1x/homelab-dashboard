/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronRight, Download, Folder, FileCode, FileText, FolderPlus, Home, Pencil, Plus, RotateCw, Save, Trash2 } from 'lucide-react';
import { type Api, CodeEditor, btnPrimary, fmtDate, fmtSize } from './shared';

interface Entry { name: string; type: 'file' | 'dir'; size: number; modified?: string; editable: boolean }

const MAX_UPLOAD = 40 * 1024 * 1024;

export function FilesPanel({ api, flash }: { api: Api; flash: (m: string) => void }) {
  const [path, setPath] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState('');
  const [content, setContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const join = (name: string) => (path ? `${path}/${name}` : name);

  const load = useCallback(async (p: string) => {
    setLoading(true); setFile('');
    const r = await api(`/files?path=${encodeURIComponent(p)}`);
    setLoading(false);
    if (r.error) { flash(r.error); return; }
    setEntries(r.entries || []); setPath(r.path ?? p);
  }, [api, flash]);

  useEffect(() => { load(''); }, [load]);

  const open = async (name: string) => {
    const r = await api(`/file?path=${encodeURIComponent(join(name))}`);
    if (typeof r.content === 'string') { setFile(join(name)); setContent(r.content); setDirty(false); }
    else flash(r.error || 'Datei nicht lesbar');
  };

  const save = async () => {
    setSaving(true);
    const r = await api(`/file?path=${encodeURIComponent(file)}`, { method: 'PUT', body: JSON.stringify({ content }) });
    setSaving(false);
    if (r.error) { flash(r.error); return; }
    setDirty(false); flash('Datei gespeichert — evtl. Neustart nötig');
  };

  const upload = (f: File) => {
    if (f.size > MAX_UPLOAD) { flash('Datei zu groß (max. 40 MB) — größere Dateien bitte über SFTP'); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = String(reader.result).split(',')[1] || '';
      const r = await api('/upload', { method: 'POST', body: JSON.stringify({ path, name: f.name, dataBase64: b64 }) });
      setUploading(false);
      if (r.ok) { flash(`${r.name} hochgeladen (${fmtSize(r.size)})`); load(path); } else flash(r.error || 'Upload fehlgeschlagen');
    };
    reader.onerror = () => { setUploading(false); flash('Datei nicht lesbar'); };
    reader.readAsDataURL(f);
  };

  const mkdir = async () => {
    const name = prompt('Name des neuen Ordners:')?.trim();
    if (!name) return;
    const r = await api('/files/mkdir', { method: 'POST', body: JSON.stringify({ path, name }) });
    if (r.error) flash(r.error); else load(path);
  };

  const rename = async (e: Entry) => {
    const to = prompt(`Neuer Name für „${e.name}“:`, e.name)?.trim();
    if (!to || to === e.name) return;
    const r = await api('/files/rename', { method: 'POST', body: JSON.stringify({ path, from: e.name, to }) });
    if (r.error) flash(r.error); else load(path);
  };

  const remove = async (e: Entry) => {
    if (!confirm(`${e.type === 'dir' ? 'Ordner' : 'Datei'} „${e.name}“ wirklich löschen?${e.type === 'dir' ? ' Der gesamte Inhalt geht verloren.' : ''}`)) return;
    const r = await api('/files/delete', { method: 'POST', body: JSON.stringify({ path, names: [e.name] }) });
    if (r.error) flash(r.error); else load(path);
  };

  const download = async (e: Entry) => {
    const r = await api(`/files/download?path=${encodeURIComponent(join(e.name))}`);
    if (r.url) window.open(r.url, '_blank'); else flash(r.error || 'Download nicht möglich');
  };

  const crumbs = path ? path.split('/').filter(Boolean) : [];

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="flex items-center gap-1 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02] text-[13px] flex-wrap">
        <button onClick={() => load('')} className="flex items-center gap-1 text-white/50 hover:text-white transition"><Home className="w-3.5 h-3.5" /></button>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="w-3 h-3 text-white/20" />
            <button onClick={() => load(crumbs.slice(0, i + 1).join('/'))} className={i === crumbs.length - 1 && !file ? 'text-white' : 'text-white/50 hover:text-white transition'}>{c}</button>
          </span>
        ))}
        {file && <span className="flex items-center gap-1"><ChevronRight className="w-3 h-3 text-white/20" /><span className="text-white">{file.split('/').pop()}</span>{dirty && <span className="text-amber-400 ml-1">●</span>}</span>}
        <div className="ml-auto flex items-center gap-2">
          {file ? (
            <button disabled={!dirty || saving} onClick={save} className={btnPrimary}>{saving ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Speichern</button>
          ) : (
            <>
              <input ref={input} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = ''; }} />
              <button onClick={mkdir} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] bg-white/[0.04] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.07] transition"><FolderPlus className="w-3.5 h-3.5" /> Ordner</button>
              <button disabled={uploading} onClick={() => input.current?.click()} className={btnPrimary}>{uploading ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Hochladen</button>
            </>
          )}
        </div>
      </div>

      {file ? (
        <CodeEditor value={content} onChange={v => { setContent(v); setDirty(true); }} />
      ) : (
        <div className="max-h-[56vh] overflow-y-auto divide-y divide-white/[0.03]">
          {loading && <p className="text-sm text-white/30 p-6 text-center">Lade…</p>}
          {!loading && entries.length === 0 && <p className="text-sm text-white/30 p-6 text-center">Leerer Ordner.</p>}
          {entries.map(e => {
            const klickbar = e.type === 'dir' || e.editable;
            return (
              <div key={e.name} className="group flex items-center gap-3 px-4 py-2 hover:bg-white/[0.02] transition">
                <button onClick={() => e.type === 'dir' ? load(join(e.name)) : e.editable ? open(e.name) : undefined} disabled={!klickbar}
                  className={`flex flex-1 min-w-0 items-center gap-3 text-left ${klickbar ? '' : 'opacity-50 cursor-default'}`}>
                  {e.type === 'dir' ? <Folder className="w-4 h-4 text-amber-400/70 flex-shrink-0" /> : e.editable ? <FileCode className="w-4 h-4 text-cyan-400/60 flex-shrink-0" /> : <FileText className="w-4 h-4 text-white/25 flex-shrink-0" />}
                  <span className={`flex-1 text-[13px] font-mono truncate ${e.type === 'dir' ? 'text-white/80' : 'text-white/60'}`}>{e.name}</span>
                </button>
                {e.type === 'file' && <span className="text-[11px] text-white/25 tabular-nums w-20 text-right">{fmtSize(e.size)}</span>}
                <span className="hidden md:block text-[11px] text-white/20 w-36 text-right">{e.type === 'file' ? fmtDate(e.modified) : ''}</span>
                <div className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
                  {e.type === 'file' && <button onClick={() => download(e)} title="Herunterladen" className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.05]"><Download className="w-3.5 h-3.5" /></button>}
                  <button onClick={() => rename(e)} title="Umbenennen" className="p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.05]"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => remove(e)} title="Löschen" className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
