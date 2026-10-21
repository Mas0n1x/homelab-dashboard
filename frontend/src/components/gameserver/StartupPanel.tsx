/*
 * Homelab Dashboard
 * Copyright (c) 2024-2026 DEV Mas0n1x.
 * Licensed under the MIT License.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Lock, RotateCw, Save, SlidersHorizontal } from 'lucide-react';
import { type Api, btnPrimary, inputCls } from './shared';

interface Variable { key: string; name: string; description: string; value: string; default: string; editable: boolean; rules: string }

export function StartupPanel({ api, flash }: { api: Api; flash: (m: string) => void }) {
  const [command, setCommand] = useState('');
  const [vars, setVars] = useState<Variable[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState('');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const r = await api('/startup');
    setLoaded(true);
    if (r.error) { flash(r.error); return; }
    setCommand(r.command || ''); setVars(r.variables || []); setEdits({});
  }, [api, flash]);
  useEffect(() => { load(); }, [load]);

  const save = async (v: Variable) => {
    setSaving(v.key);
    const r = await api('/startup', { method: 'PUT', body: JSON.stringify({ key: v.key, value: edits[v.key] }) });
    setSaving('');
    if (r.ok) { flash(`${v.name} gespeichert — gilt ab dem nächsten Start`); load(); } else flash(r.error || 'Speichern fehlgeschlagen');
  };

  return (
    <div className="space-y-4">
      {command && (
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2 text-xs text-white/50"><SlidersHorizontal className="w-4 h-4 text-orange-400/70" /> Startbefehl</div>
          <code className="block text-[12px] font-mono text-white/60 break-all whitespace-pre-wrap">{command}</code>
        </div>
      )}
      {loaded && vars.length === 0 && <p className="text-sm text-white/30 text-center py-6">Dieses Egg hat keine einstellbaren Variablen.</p>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 [&>*]:h-full">
        {vars.map(v => {
          const cur = edits[v.key] ?? v.value;
          const dirty = edits[v.key] !== undefined && edits[v.key] !== v.value;
          return (
            <div key={v.key} className="glass-card rounded-2xl p-5 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white/80 flex-1 truncate">{v.name}</p>
                {!v.editable && <Lock className="w-3.5 h-3.5 text-white/25" />}
                <span className="text-[10px] font-mono text-white/25">{v.key}</span>
              </div>
              {v.description && <p className="text-[12px] text-white/35 leading-snug flex-1">{v.description}</p>}
              <div className="flex items-center gap-2 mt-1">
                <input value={cur} disabled={!v.editable} onChange={e => setEdits(p => ({ ...p, [v.key]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && dirty && save(v)}
                  className={`${inputCls} flex-1 font-mono disabled:opacity-40`} />
                <button disabled={!dirty || saving === v.key} onClick={() => save(v)} className={btnPrimary}>
                  {saving === v.key ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                </button>
              </div>
              {v.rules && <p className="text-[10px] font-mono text-white/20 truncate" title={v.rules}>{v.rules}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
