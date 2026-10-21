/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Archive, Download, Lock, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { type Api, fmtDate, fmtSize } from './shared';

interface Backup { id: string; name: string; size: number; created: string; done: boolean; ok: boolean; locked: boolean }

export function BackupsPanel({ api, flash }: { api: Api; flash: (m: string) => void }) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [limit, setLimit] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api('/backups');
    if (r.error) { flash(r.error); return; }
    setBackups(r.backups || []); setLimit(r.limit || 0);
  }, [api, flash]);

  useEffect(() => { load(); }, [load]);
  // Ein laufendes Backup erscheint erst fertig in der Liste — solange eins offen ist, nachladen.
  useEffect(() => {
    if (!backups.some(b => !b.done)) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [backups, load]);

  const create = async () => {
    setBusy(true);
    const r = await api('/backups', { method: 'POST', body: JSON.stringify({}) });
    setBusy(false);
    if (r.ok) { flash(r.note || 'Backup gestartet'); load(); } else flash(r.error || 'Backup fehlgeschlagen');
  };
  const restore = async (b: Backup) => {
    if (!confirm(`Backup „${b.name}“ wiederherstellen? Der aktuelle Stand wird überschrieben!`)) return;
    const r = await api(`/backups/${encodeURIComponent(b.id)}/restore`, { method: 'POST' });
    flash(r.ok ? 'Wiederherstellung gestartet' : r.error || 'Fehler');
  };
  const remove = async (b: Backup) => {
    if (!confirm(`Backup „${b.name}“ löschen?`)) return;
    const r = await api(`/backups/${encodeURIComponent(b.id)}`, { method: 'DELETE' });
    if (r.error) flash(r.error); else load();
  };
  const download = async (b: Backup) => {
    const r = await api(`/backups/${encodeURIComponent(b.id)}/download`);
    if (r.url) window.open(r.url, '_blank'); else flash(r.error || 'Download nicht möglich');
  };

  const voll = limit > 0 && backups.length >= limit;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-white/40">{backups.length}{limit ? ` / ${limit}` : ''} Backup{backups.length !== 1 ? 's' : ''}{voll ? ' · Limit erreicht — erst eins löschen' : ''}</p>
        <button disabled={busy || voll} onClick={create} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-30 transition">
          <Plus className="w-4 h-4" /> {busy ? 'Starte…' : 'Backup erstellen'}
        </button>
      </div>
      <div className="glass-card rounded-2xl divide-y divide-white/[0.04]">
        {backups.length === 0 && <p className="text-sm text-white/30 p-5 text-center">Noch keine Backups.</p>}
        {backups.map(b => (
          <div key={b.id} className="flex items-center gap-3 px-4 py-3">
            <Archive className={`w-4 h-4 flex-shrink-0 ${b.done ? 'text-white/30' : 'text-amber-400 animate-pulse'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono text-white/75 truncate flex items-center gap-1.5">{b.name}{b.locked && <Lock className="w-3 h-3 text-white/30" />}</p>
              <p className="text-[11px] text-white/25">{b.done ? `${fmtDate(b.created)} · ${fmtSize(b.size)}` : 'wird erstellt…'}{b.done && !b.ok ? ' · fehlgeschlagen' : ''}</p>
            </div>
            {b.done && b.ok && <>
              <button onClick={() => download(b)} title="Herunterladen" className="p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.05] transition"><Download className="w-4 h-4" /></button>
              <button onClick={() => restore(b)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] text-amber-300/80 hover:bg-amber-500/10 transition"><RotateCcw className="w-3.5 h-3.5" /> Wiederherstellen</button>
            </>}
            <button onClick={() => remove(b)} disabled={b.locked} title={b.locked ? 'Gesperrt' : 'Löschen'} className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-20 transition"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
